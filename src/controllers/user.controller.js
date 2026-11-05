
const bcrypt = require("bcryptjs");
const User = require("../models/auth.model");


// ==========================================
// ALLOWED MODULES
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
// VALIDATE AND FORMAT PERMISSIONS
// ==========================================

const formatPermissions = (permissions = {}) => {
  const formatted = {};

  for (const module of allowedModules) {
    formatted[module] = {};

    for (const action of allowedActions) {
      const value = permissions?.[module]?.[action];

      if (value !== undefined && typeof value !== "boolean") {
        throw new Error(
          `Invalid permission value: ${module}.${action} must be boolean`
        );
      }

      formatted[module][action] = value === true;
    }
  }

  return formatted;
};


// ==========================================
// CREATE STAFF
// POST /api/admin/users
// ==========================================

const createStaff = async (req, res) => {
  try {
    const { name, email, password, permissions } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const formattedPermissions = formatPermissions(permissions);

    const hashedPassword = await bcrypt.hash(password, 12);

    const staff = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "staff",
      permissions: formattedPermissions,
      status: "active",
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Staff account created successfully.",
      staff: {
        id: staff._id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        permissions: staff.permissions,
        status: staff.status,
        createdAt: staff.createdAt,
      },
    });

  } catch (error) {
    console.error("Create Staff Error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email already exists.",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create staff account.",
    });
  }
};


// ==========================================
// GET ALL STAFF
// GET /api/admin/users
// ==========================================

const getAllStaff = async (req, res) => {
  try {
    const staff = await User.find({ role: "staff" })
      .select("-password")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: staff.length,
      staff,
    });

  } catch (error) {
    console.error("Get Staff Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch staff accounts.",
    });
  }
};


// ==========================================
// GET STAFF BY ID
// GET /api/admin/users/:id
// ==========================================

const getStaffById = async (req, res) => {
  try {
    const staff = await User.findOne({
      _id: req.params.id,
      role: "staff",
    })
      .select("-password")
      .populate("createdBy", "name email");

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff account not found.",
      });
    }

    return res.status(200).json({
      success: true,
      staff,
    });

  } catch (error) {
    console.error("Get Staff By ID Error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid staff ID.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to fetch staff details.",
    });
  }
};


// ==========================================
// UPDATE STAFF
// PUT /api/admin/users/:id
// ==========================================

const updateStaff = async (req, res) => {
  try {
    const { name, email, password, permissions } = req.body;

    const staff = await User.findOne({
      _id: req.params.id,
      role: "staff",
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff account not found.",
      });
    }

    // Update name
    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Valid name is required.",
        });
      }

      staff.name = name.trim();
    }

    // Update email
    if (email !== undefined) {
      if (typeof email !== "string" || !email.trim()) {
        return res.status(400).json({
          success: false,
          message: "Valid email is required.",
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      const existingUser = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: staff._id },
      });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "Email already belongs to another account.",
        });
      }

      staff.email = normalizedEmail;
    }

    // Update password (optional)
    if (password !== undefined && password !== "") {
      if (typeof password !== "string" || password.length < 8) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 8 characters long.",
        });
      }

      staff.password = await bcrypt.hash(password, 12);
    }

    // Update permissions
    if (permissions !== undefined) {
      staff.permissions = formatPermissions(permissions);
    }

    await staff.save();

    return res.status(200).json({
      success: true,
      message: "Staff account updated successfully.",
      staff: {
        id: staff._id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        permissions: staff.permissions,
        status: staff.status,
        updatedAt: staff.updatedAt,
      },
    });

  } catch (error) {
    console.error("Update Staff Error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid staff ID.",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update staff account.",
    });
  }
};


// ==========================================
// UPDATE STAFF STATUS
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

    const staff = await User.findOneAndUpdate(
      {
        _id: req.params.id,
        role: "staff",
      },
      {
        $set: { status },
      },
      {
        new: true,
        runValidators: true,
      }
    ).select("-password");

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff account not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Staff account ${status} successfully.`,
      staff,
    });

  } catch (error) {
    console.error("Update Staff Status Error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid staff ID.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update staff status.",
    });
  }
};


// ==========================================
// DELETE STAFF
// DELETE /api/admin/users/:id
// ==========================================

const deleteStaff = async (req, res) => {
  try {
    const staff = await User.findOne({
      _id: req.params.id,
      role: "staff",
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff account not found.",
      });
    }

    await User.deleteOne({ _id: staff._id });

    return res.status(200).json({
      success: true,
      message: "Staff account permanently deleted.",
    });

  } catch (error) {
    console.error("Delete Staff Error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid staff ID.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to delete staff account.",
    });
  }
};


module.exports = {
  createStaff,
  getAllStaff,
  getStaffById,
  updateStaff,
  updateStaffStatus,
  deleteStaff,
};
