const mongoose = require("mongoose");
const SuperAdmin = require("../src/models/SuperAdmin.model");
require("dotenv").config();

async function createSuperAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Check if super admin already exists
    const existing = await SuperAdmin.findOne({
      email: "superadmin@platform.com",
    });
    if (existing) {
      console.log(
        "⚠️  Super admin already exists with email: superadmin@platform.com",
      );
      console.log(
        "If you forgot the password, you can update it in the database.",
      );
      process.exit(0);
    }

    // Create super admin
    const superAdmin = await SuperAdmin.create({
      name: "Platform Administrator",
      email: "superadmin@platform.com",
      password: "ChangeMe123!",
      phone: "+2347089637195",
    });

    console.log("✅ Super Admin created successfully!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📧 Email:", superAdmin.email);
    console.log("🔑 Password: ChangeMe123!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(
      "⚠️  IMPORTANT: Change the password immediately after first login!",
    );
    console.log("");
    console.log("Login at: http://localhost:3000/superadmin/login");

    process.exit(0);
  } catch (err) {
    console.error("❌ Error creating super admin:", err.message);
    process.exit(1);
  }
}

createSuperAdmin();
