
const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    // User who performed the action
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Module where action happened
    module: {
      type: String,
      enum: [
        "projects",
        "blogs",
        "clients",
        "gallery",
        "team",
        "users",
        "auth",
      ],
      required: true,
    },

    // Action performed
    action: {
      type: String,
      enum: [
        "create",
        "update",
        "delete",
        "status_change",
        "login",
        "logout",
      ],
      required: true,
    },

    // Human-readable activity description
    description: {
      type: String,
      required: true,
      trim: true,
    },

    // ID of the affected document, if applicable
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    // Name/title of the affected document
    targetName: {
      type: String,
      default: null,
      trim: true,
    },

    // Optional extra information
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Request information
    ipAddress: {
      type: String,
      default: null,
    },

    userAgent: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Efficient filtering and sorting
auditLogSchema.index({ performedBy: 1, createdAt: -1 });
auditLogSchema.index({ module: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

module.exports = AuditLog;
