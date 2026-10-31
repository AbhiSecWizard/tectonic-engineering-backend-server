const express = require("express");
const router = express.Router();

const { projectUpload } = require("../middlewares/upload");

const {
  createProject,
  getProjects,
  getWebsiteProjects,
  getProjectById,
  updateProject,
  toggleWebsiteVisibility,
  deleteProject,
} = require("../controllers/project.controller");


// CREATE PROJECT
router.post("/", projectUpload, createProject);


// GET ALL PROJECTS
router.get("/", getProjects);


// GET WEBSITE PROJECTS
router.get("/website", getWebsiteProjects);


// GET SINGLE PROJECT
router.get("/:id", getProjectById);


// UPDATE PROJECT
router.put("/:id", projectUpload, updateProject);


// TOGGLE WEBSITE VISIBILITY
router.patch("/:id/visibility", toggleWebsiteVisibility);


// DELETE PROJECT
router.delete("/:id", deleteProject);


module.exports = router;