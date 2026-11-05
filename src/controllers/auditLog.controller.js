const AuditLog = require("../models/AuditLog");

const allowedModules = [
  "projects",
  "blogs",
  "clients",
  "gallery",
  "team",
  "users",
  "auth",
];

const allowedActions = [
  "create",
  "update",
  "delete",
  "status_change",
  "login",
  "logout",
];

// ==========================================
// GET ALL ACTIVITY LOGS
// GET /api/admin/activity-logs
// ==========================================

const getActivityLogs = async (req, res) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);

    const requestedLimit =
      Number.parseInt(req.query.limit, 10) || 20;

    const limit = Math.min(Math.max(requestedLimit, 1), 100);
    const skip = (page - 1) * limit;

    const { module, action, startDate, endDate } = req.query;

    const filter = {};

    // Module filter
    if (module) {
      if (!allowedModules.includes(module)) {
        return res.status(400).json({
          success: false,
          message: "Invalid module filter.",
        });
      }

      filter.module = module;
    }

    // Action filter
    if (action) {
      if (!allowedActions.includes(action)) {
        return res.status(400).json({
          success: false,
          message: "Invalid action filter.",
        });
      }

      filter.action = action;
    }

    // Date filters
    if (startDate || endDate) {
      filter.createdAt = {};

      if (startDate) {
        const start = new Date(`${startDate}T00:00:00.000Z`);

        if (Number.isNaN(start.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid start date.",
          });
        }

        filter.createdAt.$gte = start;
      }

      if (endDate) {
        const end = new Date(`${endDate}T00:00:00.000Z`);

        if (Number.isNaN(end.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid end date.",
          });
        }

        // Exclusive next-day boundary
        end.setUTCDate(end.getUTCDate() + 1);
        filter.createdAt.$lt = end;
      }
    }

    if (
      startDate &&
      endDate &&
      new Date(startDate) > new Date(endDate)
    ) {
      return res.status(400).json({
        success: false,
        message: "Start date cannot be after end date.",
      });
    }

    const [logs, totalLogs] = await Promise.all([
      AuditLog.find(filter)
        .populate("performedBy", "name email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      AuditLog.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Activity logs fetched successfully.",
      pagination: {
        totalLogs,
        currentPage: page,
        totalPages: Math.ceil(totalLogs / limit),
        limit,
      },
      logs,
    });
  } catch (error) {
    console.error("Get Activity Logs Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch activity logs.",
    });
  }
};

// ==========================================
// GET ACTIVITY LOG STATISTICS
// GET /api/admin/activity-logs/stats
// ==========================================

const getActivityLogStats = async (req, res) => {
  try {
    const now = new Date();

    const last24Hours = new Date(
      now.getTime() - 24 * 60 * 60 * 1000
    );

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalActivities,
      recentActivities,
      todayActivities,
      latestActivities,
    ] = await Promise.all([
      AuditLog.countDocuments(),

      AuditLog.countDocuments({
        createdAt: { $gte: last24Hours },
      }),

      AuditLog.countDocuments({
        createdAt: { $gte: startOfToday },
      }),

      AuditLog.find()
        .populate("performedBy", "name email role")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      message: "Activity statistics fetched successfully.",
      stats: {
        totalActivities,
        recentActivities,
        todayActivities,
      },
      latestActivities,
    });
  } catch (error) {
    console.error("Get Activity Log Stats Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch activity statistics.",
    });
  }
};

module.exports = {
  getActivityLogs,
  getActivityLogStats,
};