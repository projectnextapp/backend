const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const Member = require("../models/Member.model");
const Group = require("../models/Group.model");

let io;
const onlineUsers = new Map();

const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error("Authentication error"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (decoded.type === "group") {
        socket.group = await Group.findById(decoded.id);
        socket.userType = "group";
        socket.userId = decoded.id;
        socket.groupId = decoded.id;
      } else {
        socket.member = await Member.findById(decoded.id).populate("group");
        socket.userType = "member";
        socket.userId = decoded.id;
        socket.groupId = socket.member?.group?._id || socket.member?.group;
      }

      next();
    } catch (err) {
      console.error("Socket auth error:", err);
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`✅ User connected: ${socket.userId}`);

    socket.join(`group:${socket.groupId}`);

    onlineUsers.set(socket.userId, {
      socketId: socket.id,
      userType: socket.userType,
      groupId: socket.groupId,
      name:
        socket.userType === "group" ? socket.group?.name : socket.member?.name,
      lastSeen: new Date(),
    });

    io.to(`group:${socket.groupId}`).emit("user:online", {
      userId: socket.userId,
      userType: socket.userType,
      name: onlineUsers.get(socket.userId).name,
    });

    const groupOnlineUsers = Array.from(onlineUsers.values())
      .filter((u) => u.groupId?.toString() === socket.groupId?.toString())
      .map((u) => ({ userId: u.socketId, userType: u.userType, name: u.name }));

    socket.emit("online:users", groupOnlineUsers);

    socket.on("chat:typing", (data) => {
      socket.to(`group:${socket.groupId}`).emit("chat:typing", {
        userId: socket.userId,
        name: onlineUsers.get(socket.userId)?.name,
        ...data,
      });
    });

    socket.on("chat:stop-typing", (data) => {
      socket.to(`group:${socket.groupId}`).emit("chat:stop-typing", {
        userId: socket.userId,
        ...data,
      });
    });

    socket.on("disconnect", () => {
      console.log(`❌ User disconnected: ${socket.userId}`);
      onlineUsers.delete(socket.userId);
      io.to(`group:${socket.groupId}`).emit("user:offline", {
        userId: socket.userId,
      });
    });

    socket.on("heartbeat", () => {
      const user = onlineUsers.get(socket.userId);
      if (user) {
        user.lastSeen = new Date();
        onlineUsers.set(socket.userId, user);
      }
    });
  });

  // console.log("✅ Socket.io initialized");
  console.log("✅ great connection");

  return io;
};

const emitToGroup = (groupId, event, data) => {
  if (!io) return;
  io.to(`group:${groupId}`).emit(event, data);
};

const emitToUser = (userId, event, data) => {
  if (!io) return;
  const user = onlineUsers.get(userId);
  if (user) io.to(user.socketId).emit(event, data);
};

const getOnlineUsers = (groupId) => {
  return Array.from(onlineUsers.values())
    .filter((u) => u.groupId?.toString() === groupId?.toString())
    .map((u) => ({
      userId: u.socketId,
      userType: u.userType,
      name: u.name,
      lastSeen: u.lastSeen,
    }));
};

module.exports = {
  initializeSocket,
  emitToGroup,
  emitToUser,
  getOnlineUsers,
  getIO: () => io,
};
