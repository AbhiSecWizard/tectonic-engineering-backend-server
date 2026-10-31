const express = require("express");
const { upload } = require("../middlewares/upload")
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

// One cover image. Upload errors (too big, not an image) come back as JSON.
const uploadCover = (req, res, next) =>
  upload.single("coverImage")(req, res, (error) => {
    if (!error) return next();

    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Cover image must be 5 MB or smaller"
        : error.message;

    res.status(400).json({ success: false, message });
  });

// ---- Public ----
router.get("/", getPublishedPosts);
router.get("/categories", getCategories);

// ---- Admin (these must come before "/:slug") ----
router.get("/admin/all",  getAllPosts);
router.get("/admin/:id",  getPostById);

// ---- Public: single article ----
router.get("/:slug", getPostBySlug);

// ---- Admin: write ----
router.post("/",  uploadCover, createPost);
router.put("/:id",  uploadCover, updatePost);
router.patch("/:id/status",  updateStatus);
router.patch("/:id/featured",  toggleFeatured);
router.delete("/:id",  deletePost);

module.exports = router;

// In your server file:
