
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const mongoose = require("mongoose");
const User = require("../models/auth.model");

// ==========================================
// 1. Allowed Modules & Actions
// ==========================================

const allowedModules = [
  "projects",
  "blogs",
  "clients",
  "gallery",
  "team",
];

const allowedActions = [
  "create",
  "read",
  "update",
  "delete",
];

// ==========================================
// 2. Generate Random Staff Login ID
// ==========================================

const generateStaffId = () => {
  const randomPart = crypto
    .randomBytes(4)
    .toString("hex")
    .substring(0, 6)
    .toUpperCase();

  return `TEC-${randomPart}`;
};

// ==========================================
// 3. Format & Validate Permissions
// ==========================================

const formatPermissions = (permissions) => {
  if (
    !permissions ||
    typeof permissions !== "object" ||
    Array.isArray(permissions)
  ) {
    throw new Error("Permissions must be a valid object.");
  }

  // Reject unknown modules
  const invalidModules = Object.keys(permissions).filter(
    (module) => !allowedModules.includes(module)
  );

  if (invalidModules.length > 0) {
    throw new Error(
      `Invalid modules: ${invalidModules.join(", ")}`
    );
  }

  const formattedPermissions = {};

  allowedModules.forEach((module) => {
    const modulePermissions = permissions[module] || {};

    if (
      typeof modulePermissions !== "object" ||
      modulePermissions === null ||
      Array.isArray(modulePermissions)
    ) {
      throw new Error(`Invalid permissions for ${module}.`);
    }

    const invalidActions = Object.keys(modulePermissions).filter(
      (action) => !allowedActions.includes(action)
    );

    if (invalidActions.length > 0) {
      throw new Error(
        `Invalid actions for ${module}: ${invalidActions.join(", ")}`
      );
    }

    formattedPermissions[module] = {};

    allowedActions.forEach((action) => {
      const value = modulePermissions[action];

      if (value !== undefined && typeof value !== "boolean") {
        throw new Error(
          `${module}.${action} must be true or false.`
        );
      }

      formattedPermissions[module][action] = value ?? false;
    });
  });

  return formattedPermissions;
};

// ==========================================
// 4. Check Valid MongoDB ID
// ==========================================

const isValidId = (id) => {
  return mongoose.Types.ObjectId.isValid(id);
};

// ==========================================
// 5. Find Staff Only
// ==========================================

const findStaffById = async (id) => {
  if (!isValidId(id)) {
    return null;
  }

  return User.findOne({
    _id: id,
    role: "staff",
  });
};

// ==========================================
// 6. CREATE STAFF
// POST /api/admin/users
// ==========================================

const createStaff = async (req, res) => {
  try {
    const { name, email, password, permissions } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required.",
      });
    }

    // Validate field types
    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid input data.",
      });
    }

    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      return res.status(400).json({
        success: false,
        message: "Name cannot be empty.",
      });
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email.",
      });
    }

    // Validate password
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters.",
      });
    }

    // Check duplicate email
    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered.",
      });
    }

    // Validate permissions
    let formattedPermissions;

    try {
      formattedPermissions = formatPermissions(permissions);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate unique Login ID.
    // Retry if a random ID collision occurs.
    let staff = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const loginId = generateStaffId();

      try {
        staff = await User.create({
          name: trimmedName,
          email: normalizedEmail,
          password: hashedPassword,
          loginId,
          role: "staff",
          permissions: formattedPermissions,
          status: "active",
          createdBy: req.user._id,
        });

        break;
      } catch (error) {
        const isLoginIdCollision =
          error.code === 11000 &&
          error.keyPattern?.loginId;

        if (isLoginIdCollision) {
          continue;
        }

        if (
          error.code === 11000 &&
          error.keyPattern?.email
        ) {
          return res.status(409).json({
            success: false,
            message: "This email is already registered.",
          });
        }

        throw error;
      }
    }

    if (!staff) {
      return res.status(500).json({
        success: false,
        message: "Could not generate a unique Login ID. Try again.",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Staff created successfully.",
      staff: {
        _id: staff._id,
        name: staff.name,
        email: staff.email,
        loginId: staff.loginId,
        role: staff.role,
        permissions: staff.permissions,
        status: staff.status,
        createdBy: staff.createdBy,
        createdAt: staff.createdAt,
      },
    });

  } catch (error) {
    console.error("Create Staff Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

// ==========================================
// 7. GET ALL STAFF
// GET /api/admin/users
// ==========================================

const getAllStaff = async (req, res) => {
  try {
    const staff = await User.find({
      role: "staff",
    })
      .select("-password")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Staff fetched successfully.",
      totalStaff: staff.length,
      staff,
    });

  } catch (error) {
    console.error("Get All Staff Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

// ==========================================
// 8. GET SINGLE STAFF
// GET /api/admin/users/:id
// ==========================================

const getStaffById = async (req, res) => {
  try {
    const staff = await findStaffById(req.params.id);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found.",
      });
    }

    return res.status(200).json({
      success: true,
      staff: {
        _id: staff._id,
        name: staff.name,
        email: staff.email,
        loginId: staff.loginId,
        role: staff.role,
        permissions: staff.permissions,
        status: staff.status,
        createdBy: staff.createdBy,
        lastLogin: staff.lastLogin,
        createdAt: staff.createdAt,
        updatedAt: staff.updatedAt,
      },
    });

  } catch (error) {
    console.error("Get Staff Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

// ==========================================
// 9. UPDATE STAFF
// PUT /api/admin/users/:id
// ==========================================

const updateStaff = async (req, res) => {
  try {
    const { name, email, permissions } = req.body;

    const staff = await findStaffById(req.params.id);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found.",
      });
    }

    // Update name
    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid name.",
        });
      }

      staff.name = name.trim();
    }

    // Update email
    if (email !== undefined) {
      if (typeof email !== "string") {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid email.",
        });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid email.",
        });
      }

      const existingEmail = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: staff._id },
      });

      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message: "This email is already registered.",
        });
      }

      staff.email = normalizedEmail;
    }

    // Update permissions
    if (permissions !== undefined) {
      try {
        staff.permissions = formatPermissions(permissions);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
    }

    await staff.save();

    return res.status(200).json({
      success: true,
      message: "Staff updated successfully.",
      staff: {
        _id: staff._id,
        name: staff.name,
        email: staff.email,
        loginId: staff.loginId,
        role: staff.role,
        permissions: staff.permissions,
        status: staff.status,
      },
    });

  } catch (error) {
    console.error("Update Staff Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

// ==========================================
// 10. RESET STAFF PASSWORD
// PATCH /api/admin/users/:id/password
// ==========================================

const resetStaffPassword = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || typeof password !== "string") {
      return res.status(400).json({
        success: false,
        message: "New password is required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters.",
      });
    }

    const staff = await findStaffById(req.params.id);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found.",
      });
    }

    staff.password = await bcrypt.hash(password, 12);

    await staff.save();

    return res.status(200).json({
      success: true,
      message: "Staff password reset successfully.",
    });

  } catch (error) {
    console.error("Reset Staff Password Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

// ==========================================
// 11. UPDATE STAFF STATUS
// PATCH /api/admin/users/:id/status
// ==========================================

const updateStaffStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be active or inactive.",
      });
    }

    const staff = await findStaffById(req.params.id);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found.",
      });
    }

    staff.status = status;

    await staff.save();

    return res.status(200).json({
      success: true,
      message: `Staff account ${status} successfully.`,
      staff: {
        _id: staff._id,
        name: staff.name,
        email: staff.email,
        loginId: staff.loginId,
        status: staff.status,
      },
    });

  } catch (error) {
    console.error("Update Staff Status Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

// ==========================================
// 12. DELETE STAFF
// DELETE /api/admin/users/:id
// ==========================================

const deleteStaff = async (req, res) => {
  try {
    const staff = await findStaffById(req.params.id);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff not found.",
      });
    }

    await User.deleteOne({
      _id: staff._id,
      role: "staff",
    });

    return res.status(200).json({
      success: true,
      message: "Staff deleted successfully.",
    });

  } catch (error) {
    console.error("Delete Staff Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

// ==========================================
// 13. EXPORT CONTROLLERS
// ==========================================

module.exports = {
  createStaff,
  getAllStaff,
  getStaffById,
  updateStaff,
  resetStaffPassword,
  updateStaffStatus,
  deleteStaff,
};
