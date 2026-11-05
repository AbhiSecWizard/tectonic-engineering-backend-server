
const express = require("express");
const router = express.Router();

const { projectUpload } = require("../middlewares/upload");
const authentication = require("../middlewares/authentication");
const authorize = require("../middlewares/authorize");

const {
  createProject,
  getProjects,
  getWebsiteProjects,
  getProjectById,
  updateProject,
  toggleWebsiteVisibility,
  deleteProject,
} = require("../controllers/project.controller");


// ==========================================
// PUBLIC ROUTES
// ==========================================

// GET WEBSITE PROJECTS
router.get(
  "/website",
  getWebsiteProjects
);


// ==========================================
// ADMIN READ ROUTES
// ==========================================

// GET ALL PROJECTS
router.get(
  "/",
  authentication,
  authorize("projects", "read"),
  getProjects
);

// GET SINGLE PROJECT
router.get(
  "/:id",
  authentication,
  authorize("projects", "read"),
  getProjectById
);


// ==========================================
// ADMIN WRITE ROUTES
// ==========================================

// CREATE PROJECT
router.post(
  "/",
  authentication,
  authorize("projects", "create"),
  projectUpload,
  createProject
);

// UPDATE PROJECT
router.put(
  "/:id",
  authentication,
  authorize("projects", "update"),
  projectUpload,
  updateProject
);

// TOGGLE WEBSITE VISIBILITY
router.patch(
  "/:id/visibility",
  authentication,
  authorize("projects", "update"),
  toggleWebsiteVisibility
);

// DELETE PROJECT
router.delete(
  "/:id",
  authentication,
  authorize("projects", "delete"),
  deleteProject
);


module.exports = router;
