
const express = require("express");

const {
  loginAdmin,
  logoutAdmin,
  getAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
} = require("../controllers/auth.controller");

const authentication = require("../middlewares/authentication");

const router = express.Router();

// Public login
router.post("/login", loginAdmin);

// Protected routes
router.post("/logout", authentication, logoutAdmin);
router.get("/profile", authentication, getAdminProfile);

// Super Admin profile settings
router.put("/profile/update", authentication, updateAdminProfile);
router.put("/change-password", authentication, changeAdminPassword);

module.exports = router;
