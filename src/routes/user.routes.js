
const express = require("express");

const router = express.Router();

const authentication = require("../middlewares/authentication");
const authorizeSuperAdmin = require("../middlewares/authorizeSuperAdmin");

const {
  createStaff,
  getAllStaff,
  getStaffById,
  updateStaff,
  updateStaffStatus,
  deleteStaff,
} = require("../controllers/user.controller");


// ==========================================
// GLOBAL PROTECTION
// ==========================================

// Every route below requires Super Admin authentication
router.use(authentication);
router.use(authorizeSuperAdmin);


// ==========================================
// STAFF MANAGEMENT ROUTES
// ==========================================

// Create Staff
// POST /api/admin/users
router.post(
  "/",
  createStaff
);


// Get All Staff
// GET /api/admin/users
router.get(
  "/",
  getAllStaff
);


// Update Staff Status
// PATCH /api/admin/users/:id/status
router.patch(
  "/:id/status",
  updateStaffStatus
);


// Get Staff By ID
// GET /api/admin/users/:id
router.get(
  "/:id",
  getStaffById
);


// Update Staff
// PUT /api/admin/users/:id
router.put(
  "/:id",
  updateStaff
);


// Permanently Delete Staff
// DELETE /api/admin/users/:id
router.delete(
  "/:id",
  deleteStaff
);


module.exports = router;
