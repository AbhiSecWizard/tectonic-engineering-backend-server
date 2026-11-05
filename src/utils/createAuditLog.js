
const AuditLog = require("../models/AuditLog");

const createAuditLog = async ({
  req,
  module,
  action,
  description,
  targetId = null,
  targetName = null,
  metadata = {},
}) => {
  try {
    if (!req.user?._id) {
      console.error("Activity log skipped: authenticated user not found.");
      return;
    }

    await AuditLog.create({
      performedBy: req.user._id,
      module,
      action,
      description,
      targetId,
      targetName,
      metadata,
      ipAddress: req.ip,
      userAgent: req.get("user-agent") || null,
    });
  } catch (error) {
    // Logging failure should not break the main API operation
    console.error("Activity Log Error:", error.message);
  }
};

module.exports = createAuditLog;
