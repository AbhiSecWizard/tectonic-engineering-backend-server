
const express = require("express");
const router = express.Router();

const authentication = require("../middlewares/authentication");
const authorizeSuperAdmin = require("../middlewares/authorizeSuperAdmin");

const {
  createStaff,
  getAllStaff,
  getStaffById,
  updateStaff,
  resetStaffPassword,
  updateStaffStatus,
  deleteStaff,
} = require("../controllers/staff.controller");

// All staff management routes require authentication
// and Super Admin access.
router.use(authentication);
router.use(authorizeSuperAdmin);


router.use(authentication);
router.use(authorizeSuperAdmin);

// Only Super Admin can access these routes
router.post("/", createStaff);
router.get("/", getAllStaff);
router.get("/:id", getStaffById);
router.put("/:id", updateStaff);
router.patch("/:id/password", resetStaffPassword);
router.patch("/:id/status", updateStaffStatus);
router.delete("/:id", deleteStaff);

module.exports = router;
