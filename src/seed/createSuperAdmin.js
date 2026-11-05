
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const User = require("../models/auth.model");

// ==========================================
// CREATE TWO SUPER ADMIN ACCOUNTS
// ==========================================

const createSuperAdmins = async () => {
  try {
    // Validate MongoDB connection
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing in .env");
    }

    // Super Admin configuration
    const admins = [
      {
        name: process.env.ADMIN_NAME,
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
      },
      {
        name: process.env.ADMIN2_NAME,
        email: process.env.ADMIN2_EMAIL,
        password: process.env.ADMIN2_PASSWORD,
      },
    ];

    // Validate all admin credentials
    for (const admin of admins) {
      if (!admin.name || !admin.email || !admin.password) {
        throw new Error(
          "Please provide name, email and password for both Super Admins."
        );
      }
    }

    const normalizedEmails = admins.map((admin) =>
      admin.email.trim().toLowerCase()
    );

    if (new Set(normalizedEmails).size !== normalizedEmails.length) {
      throw new Error("Both Super Admins must have different email addresses.");
    }

    // Connect MongoDB
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected successfully.");

    // Create or update accounts
    for (const adminData of admins) {
      const name = adminData.name.trim();
      const email = adminData.email.trim().toLowerCase();
      const password = adminData.password;

      const existingUser = await User.findOne({ email });

      if (existingUser) {
        if (existingUser.role !== "superadmin") {
          throw new Error(
            `Email ${email} already belongs to a non-superadmin account.`
          );
        }

        existingUser.name = name;
        existingUser.status = "active";

        await existingUser.save();

        console.log(`Existing Super Admin verified: ${email}`);

        continue;
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      await User.create({
        name,
        email,
        password: hashedPassword,
        role: "superadmin",
        status: "active",
      });

      console.log(`Super Admin created: ${email}`);
    }

    // Count Super Admin accounts
    const totalSuperAdmins = await User.countDocuments({
      role: "superadmin",
    });

    console.log("--------------------------------");
    console.log(`Total Super Admins: ${totalSuperAdmins}`);
    console.log("--------------------------------");
  } catch (error) {
    console.error("Super Admin Setup Error:", error.message);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
};

createSuperAdmins();
