const express = require("express");
const router = express.Router();

const authentication = require("../middlewares/authentication");
const authorizeSuperAdmin = require("../middlewares/authorizeSuperAdmin");

const {
  getActivityLogs,
  getActivityLogStats,
} = require("../controllers/auditLog.controller");

// Protect all activity log routes
router.use(authentication);
router.use(authorizeSuperAdmin);

// GET /api/admin/activity-logs/stats
router.get("/stats", getActivityLogStats);

// GET /api/admin/activity-logs
router.get("/", getActivityLogs);

module.exports = router;