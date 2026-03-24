const express = require("express");
const http = require("http");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const { initializeSocket } = require("../src/socket/socket");

dotenv.config();
connectDB();

const app = express();
const httpServer = http.createServer(app);

// Initialize Socket.io
initializeSocket(httpServer);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Super Admin routes
app.use("/api/superadmin/auth", require("./routes/superadmin.auth.routes"));
app.use("/api/superadmin", require("./routes/superadmin.management.routes"));

// Routes
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/members", require("./routes/member.routes"));
app.use("/api/elections", require("./routes/election.routes"));
app.use("/api/finances", require("./routes/finance.routes"));
app.use("/api/expenditures", require("./routes/expenditures"));
app.use("/api/notices", require("./routes/notice.routes"));
app.use("/api/notifications", require("./routes/notification.routes"));
app.use("/api/dashboard", require("./routes/dashboard.routes"));
app.use("/api/exports", require("./routes/export.routes"));

// Add these routes
app.use(
  "/api/superadmin/adverts",
  require("./routes/advert.superadmin.routes"),
);
app.use("/api/adverts", require("./routes/advert.user.routes"));

app.get("/", (req, res) => {
  res.json({ message: "AGMS API is running 🚀", status: "OK" });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(
    `✅ AGMS Server running on port ${PORT} in ${process.env.NODE_ENV} mode`,
  );
});
