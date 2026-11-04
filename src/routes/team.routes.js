const express = require("express");
const router = express.Router();

const { upload } = require("../middlewares/upload");
const authentication = require("../middlewares/authentication");

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
// GET /api/team
router.get(
  "/",
  getTeamMembers
);


// GET SINGLE TEAM MEMBER
// GET /api/team/:id
router.get(
  "/:id",
  getTeamMemberById
);


// ==========================================
// ADMIN ROUTES
// ==========================================

// CREATE TEAM MEMBER
// POST /api/team
router.post(
  "/",
  authentication,
  upload.single("photo"),
  createTeamMember
);


// UPDATE TEAM MEMBER
// PUT /api/team/:id
router.put(
  "/:id",
  authentication,
  upload.single("photo"),
  updateTeamMember
);


// DELETE TEAM MEMBER
// DELETE /api/team/:id
router.delete(
  "/:id",
  authentication,
  deleteTeamMember
);


module.exports = router;