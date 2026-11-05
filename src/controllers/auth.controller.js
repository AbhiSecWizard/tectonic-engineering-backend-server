
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/auth.model");

// ==========================================
// 1. GENERATE JWT TOKEN
// ==========================================

const generateToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing.");
  }

  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// ==========================================
// 2. COOKIE OPTIONS
// ==========================================

const getCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  };
};

// ==========================================
// 3. SAFE USER RESPONSE
// ==========================================

const formatUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  loginId: user.loginId || null,
  role: user.role,
  permissions: user.permissions,
  status: user.status,
  lastLogin: user.lastLogin,
});

// ==========================================
// 4. LOGIN ADMIN / STAFF
// Email + Login ID
// ==========================================

const loginAdmin = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (
      typeof identifier !== "string" ||
      !identifier.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email/Login ID and password are required.",
      });
    }

    const normalizedIdentifier = identifier.trim();

    const user = await User.findOne({
      $or: [
        { email: normalizedIdentifier.toLowerCase() },
        { loginId: normalizedIdentifier.toUpperCase() },
      ],
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email/Login ID or password.",
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive.",
      });
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email/Login ID or password.",
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    res.cookie("adminToken", token, getCookieOptions());

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      user: formatUser(user),
    });

  } catch (error) {
    console.error("Login Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

// ==========================================
// 5. LOGOUT ADMIN / STAFF
// ==========================================

const logoutAdmin = async (req, res) => {
  try {
    res.clearCookie("adminToken", getCookieOptions());

    return res.status(200).json({
      success: true,
      message: "Logged out successfully.",
    });

  } catch (error) {
    console.error("Logout Error:", error);

    return res.status(500).json({
      success: false,
      message: "Logout failed.",
    });
  }
};

// ==========================================
// 6. GET LOGGED-IN USER PROFILE
// ==========================================

const getAdminProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive.",
      });
    }

    return res.status(200).json({
      success: true,
      user: formatUser(user),
    });

  } catch (error) {
    console.error("Get Profile Error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not fetch profile.",
    });
  }
};

// ==========================================
// 7. UPDATE OWN PROFILE
// Name + Email
// Super Admin Only
// ==========================================

const updateAdminProfile = async (req, res) => {
  try {
    // Check Super Admin role
    if (req.user.role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Only Super Admins can update this profile.",
      });
    }

    const { name, email } = req.body;

    // Validate input
    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !email.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Name and email are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    // Find only the logged-in user's account
    const user = await User.findById(req.user._id);

    if (!user || user.role !== "superadmin") {
      return res.status(404).json({
        success: false,
        message: "Super Admin account not found.",
      });
    }

    // Check duplicate email excluding own account
    const existingUser = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: user._id },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "This email is already in use.",
      });
    }

    // Update own profile
    user.name = name.trim();
    user.email = normalizedEmail;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      user: formatUser(user),
    });

  } catch (error) {
    console.error("Update Profile Error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This email is already in use.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Could not update profile.",
    });
  }
};

// ==========================================
// 8. CHANGE OWN PASSWORD
// Super Admin Only
// ==========================================

const changeAdminPassword = async (req, res) => {
  try {
    // Check Super Admin role
    if (req.user.role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Only Super Admins can change this password.",
      });
    }

    const {
      currentPassword,
      newPassword,
      confirmPassword,
    } = req.body;

    // Validate password fields
    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string" ||
      typeof confirmPassword !== "string" ||
      !currentPassword ||
      !newPassword ||
      !confirmPassword
    ) {
      return res.status(400).json({
        success: false,
        message: "All password fields are required.",
      });
    }

    // Minimum password length
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters.",
      });
    }

    // Confirm password
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "New password and confirm password do not match.",
      });
    }

    // New password must be different
    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password.",
      });
    }

    // Fetch only logged-in Super Admin
    const user = await User.findById(req.user._id).select("+password");

    if (!user || user.role !== "superadmin") {
      return res.status(404).json({
        success: false,
        message: "Super Admin account not found.",
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect.",
      });
    }

    // Hash new password
    user.password = await bcrypt.hash(newPassword, 12);

    await user.save();

    // Clear current browser session
    res.clearCookie("adminToken", getCookieOptions());

    return res.status(200).json({
      success: true,
      message: "Password changed successfully. Please login again.",
    });

  } catch (error) {
    console.error("Change Password Error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not change password.",
    });
  }
};

// ==========================================
// 9. EXPORT CONTROLLERS
// ==========================================

module.exports = {
  loginAdmin,
  logoutAdmin,
  getAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
};
