const express = require("express");
const router = express.Router();

const { projectUpload } = require("../middlewares/upload");
const authentication = require("../middlewares/authentication");

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
// GET /api/projects/website
router.get(
  "/website",
  getWebsiteProjects
);


// ==========================================
// ADMIN ROUTES
// ==========================================

// CREATE PROJECT
// POST /api/projects
router.post(
  "/",
  authentication,
  projectUpload,
  createProject
);


// GET ALL PROJECTS
// GET /api/projects
router.get(
  "/",
  authentication,
  getProjects
);


// GET SINGLE PROJECT
// GET /api/projects/:id
router.get(
  "/:id",
  authentication,
  getProjectById
);


// UPDATE PROJECT
// PUT /api/projects/:id
router.put(
  "/:id",
  authentication,
  projectUpload,
  updateProject
);


// TOGGLE WEBSITE VISIBILITY
// PATCH /api/projects/:id/visibility
router.patch(
  "/:id/visibility",
  authentication,
  toggleWebsiteVisibility
);


// DELETE PROJECT
// DELETE /api/projects/:id
router.delete(
  "/:id",
  authentication,
  deleteProject
);


module.exports = router;