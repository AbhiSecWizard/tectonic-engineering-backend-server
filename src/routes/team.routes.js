
const express = require("express");
const router = express.Router();

const { upload } = require("../middlewares/upload");
const authentication = require("../middlewares/authentication");
const authorize = require("../middlewares/authorize");

const {
  createTeamMember,
  getTeamMembers,
  getTeamMemberById,
  updateTeamMember,
  deleteTeamMember,
} = require("../controllers/team.controller");


// ==========================================
// PUBLIC ROUTES
// ==========================================

// GET ALL TEAM MEMBERS
router.get(
  "/",
  getTeamMembers
);

// GET SINGLE TEAM MEMBER
router.get(
  "/:id",
  getTeamMemberById
);


// ==========================================
// ADMIN READ ROUTES
// ==========================================

// GET ALL TEAM MEMBERS (Admin)
router.get(
  "/admin/all",
  authentication,
  authorize("team", "read"),
  getTeamMembers
);

// GET SINGLE TEAM MEMBER (Admin)
router.get(
  "/admin/:id",
  authentication,
  authorize("team", "read"),
  getTeamMemberById
);


// ==========================================
// ADMIN WRITE ROUTES
// ==========================================

// CREATE TEAM MEMBER
router.post(
  "/",
  authentication,
  authorize("team", "create"),
  upload.single("photo"),
  createTeamMember
);

// UPDATE TEAM MEMBER
router.put(
  "/:id",
  authentication,
  authorize("team", "update"),
  upload.single("photo"),
  updateTeamMember
);

// DELETE TEAM MEMBER
router.delete(
  "/:id",
  authentication,
  authorize("team", "delete"),
  deleteTeamMember
);


module.exports = router;
