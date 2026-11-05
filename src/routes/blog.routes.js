
const express = require("express");

const { upload } = require("../middlewares/upload");
const authentication = require("../middlewares/authentication");
const authorize = require("../middlewares/authorize");

const {
  getPublishedPosts,
  getCategories,
  getPostBySlug,
  getAllPosts,
  getPostById,
  createPost,
  updatePost,
  updateStatus,
  toggleFeatured,
  deletePost,
} = require("../controllers/blog.controller");

const router = express.Router();


// ==========================================
// Upload Cover Image Middleware
// ==========================================

const uploadCover = (req, res, next) => {
  upload.single("coverImage")(req, res, (error) => {
    if (!error) return next();

    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Cover image must be 5 MB or smaller"
        : error.message;

    return res.status(400).json({
      success: false,
      message,
    });
  });
};


// ==========================================
// Public Routes (No Authentication)
// ==========================================

// Get published blogs
router.get("/", getPublishedPosts);

// Get blog categories
router.get("/categories", getCategories);


// ==========================================
// Admin Read Routes
// ==========================================

// Get all blogs
router.get(
  "/admin/all",
  authentication,
  authorize("blogs", "read"),
  getAllPosts
);

// Get blog by ID
router.get(
  "/admin/:id",
  authentication,
  authorize("blogs", "read"),
  getPostById
);


// ==========================================
// Public Single Blog
// ==========================================

router.get("/:slug", getPostBySlug);


// ==========================================
// Admin Write Routes
// ==========================================

// Create blog
router.post(
  "/",
  authentication,
  authorize("blogs", "create"),
  uploadCover,
  createPost
);

// Update blog
router.put(
  "/:id",
  authentication,
  authorize("blogs", "update"),
  uploadCover,
  updatePost
);

// Update status
router.patch(
  "/:id/status",
  authentication,
  authorize("blogs", "update"),
  updateStatus
);

// Toggle featured
router.patch(
  "/:id/featured",
  authentication,
  authorize("blogs", "update"),
  toggleFeatured
);

// Delete blog
router.delete(
  "/:id",
  authentication,
  authorize("blogs", "delete"),
  deletePost
);


module.exports = router;
