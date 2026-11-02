
const express = require("express");
const router = express.Router();

const { upload } = require("../middlewares/upload");

const {
  createTeamMember,
  getTeamMembers,
  getTeamMemberById,
  updateTeamMember,
  deleteTeamMember,
} = require("../controllers/team.controller");


// CREATE TEAM MEMBER
router.post("/", upload.single("photo"), createTeamMember);

// GET ALL TEAM MEMBERS
router.get("/", getTeamMembers);

// GET SINGLE TEAM MEMBER
router.get("/:id", getTeamMemberById);

// UPDATE TEAM MEMBER
router.put("/:id", upload.single("photo"), updateTeamMember);

// DELETE TEAM MEMBER
router.delete("/:id", deleteTeamMember);


module.exports = router;
