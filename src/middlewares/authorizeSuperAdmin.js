
const authorizeSuperAdmin = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please login first.",
      });
    }

    if (req.user.role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Super Admin only.",
      });
    }

    next();

  } catch (error) {
    console.error("Super Admin Authorization Error:", error);

    return res.status(500).json({
      success: false,
      message: "Authorization failed.",
    });
  }
};

module.exports = authorizeSuperAdmin;
