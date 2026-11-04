const express = require("express");

const router = express.Router();

const { upload } = require("../middlewares/upload");
const authentication = require("../middlewares/authentication");

const {
  createGallery,
  getGallery,
  getGalleryById,
  updateGallery,
  deleteGallery,
} = require("../controllers/gallery.controller");


// ==========================================
// PUBLIC ROUTES
// ==========================================

// Get All Gallery Images
// GET /api/gallery
router.get(
  "/",
  getGallery
);


// Get Single Gallery Image
// GET /api/gallery/:id
router.get(
  "/:id",
  getGalleryById
);


// ==========================================
// ADMIN ROUTES
// ==========================================

// Create Gallery Image
// POST /api/gallery
router.post(
  "/",
  authentication,
  upload.single("image"),
  createGallery
);


// Update Gallery Image
// PUT /api/gallery/:id
router.put(
  "/:id",
  authentication,
  upload.single("image"),
  updateGallery
);


// Delete Gallery Image
// DELETE /api/gallery/:id
router.delete(
  "/:id",
  authentication,
  deleteGallery
);


module.exports = router;