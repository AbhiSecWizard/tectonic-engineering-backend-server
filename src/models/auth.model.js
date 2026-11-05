const mongoose = require("mongoose");

// ==========================================
// 1. Permission Schema
// ==========================================

const permissionSchema = new mongoose.Schema(
  {
    create: {
      type: Boolean,
      default: false,
    },

    read: {
      type: Boolean,
      default: false,
    },

    update: {
      type: Boolean,
      default: false,
    },

    delete: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: false,
  }
);

// ==========================================
// 2. User Schema
// ==========================================

const userSchema = new mongoose.Schema(
  {
    // User Name
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },

    // User Email
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please enter a valid email",
      ],
    },

    // Automatic Staff Login ID
    // Example: TEC-STAFF-001
    loginId: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      trim: true,
    },

    // User Password
    password: {
      type: String,
      required: [true, "Password is required"],
      select: false,
    },

    // User Role
    role: {
      type: String,
      enum: ["superadmin", "staff"],
      default: "staff",
      required: true,
    },

    // Module Permissions
    permissions: {
      projects: {
        type: permissionSchema,
        default: () => ({}),
      },

      blogs: {
        type: permissionSchema,
        default: () => ({}),
      },

      clients: {
        type: permissionSchema,
        default: () => ({}),
      },

      gallery: {
        type: permissionSchema,
        default: () => ({}),
      },

      team: {
        type: permissionSchema,
        default: () => ({}),
      },
    },

    // Account Status
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    // Who Created This User
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Last Login Time
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// ==========================================
// 3. Create User Model
// ==========================================

const User = mongoose.model("User", userSchema);

// ==========================================
// 4. Export Model
// ==========================================

module.exports = User;
