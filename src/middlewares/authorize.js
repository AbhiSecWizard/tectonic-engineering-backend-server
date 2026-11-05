
const authorize = (module, action) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized. Please login first.",
        });
      }

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

      // Validate module
      if (!allowedModules.includes(module)) {
        return res.status(400).json({
          success: false,
          message: "Invalid module name.",
        });
      }

      // Validate action
      if (!allowedActions.includes(action)) {
        return res.status(400).json({
          success: false,
          message: "Invalid permission action.",
        });
      }

      // Super Admin has full access
      if (req.user.role === "superadmin") {
        return next();
      }

      // Only staff can proceed beyond this point
      if (req.user.role !== "staff") {
        return res.status(403).json({
          success: false,
          message: "Access denied.",
        });
      }

      // Get module permissions
      const modulePermissions =
        req.user.permissions?.[module];

      // Check permission
      if (modulePermissions?.[action] !== true) {
        return res.status(403).json({
          success: false,
          message: `Access denied. You don't have permission to ${action} ${module}.`,
        });
      }

      next();

    } catch (error) {
      console.error("Authorization Error:", error);

      return res.status(500).json({
        success: false,
        message: "Authorization failed.",
      });
    }
  };
};

module.exports = authorize;
