const express = require("express");

const { upload } = require("../middlewares/upload");
const authentication = require("../middlewares/authentication");

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
// Public Routes
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
  getAllPosts
);

// Get blog by ID
router.get(
  "/admin/:id",
  authentication,
  getPostById
);


// ==========================================
// Public Single Blog
// IMPORTANT: Keep this after /admin routes
// ==========================================

router.get("/:slug", getPostBySlug);


// ==========================================
// Admin Write Routes
// ==========================================

// Create blog
router.post(
  "/",
  authentication,
  uploadCover,
  createPost
);

// Update blog
router.put(
  "/:id",
  authentication,
  uploadCover,
  updatePost
);

// Update status
router.patch(
  "/:id/status",
  authentication,
  updateStatus
);

// Toggle featured
router.patch(
  "/:id/featured",
  authentication,
  toggleFeatured
);

// Delete blog
router.delete(
  "/:id",
  authentication,
  deletePost
);


module.exports = router;