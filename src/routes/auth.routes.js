// routes/authAdmin.route.js

const express = require("express");

const {
  loginAdmin,
  logoutAdmin,
  getAdminProfile,
} = require("../controllers/auth.controller");

const authentication = require("../middlewares/authentication");

const router = express.Router();


// Login
router.post("/login", loginAdmin);

// Logout
router.post("/logout", authentication, logoutAdmin);

// Get logged-in admin profile
router.get("/profile", authentication, getAdminProfile);


module.exports = router;