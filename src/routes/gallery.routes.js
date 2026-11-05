
const express = require("express");
const router = express.Router();

const { upload } = require("../middlewares/upload");
const authentication = require("../middlewares/authentication");
const authorize = require("../middlewares/authorize");

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
router.get("/", getGallery);

// Get Single Gallery Image
router.get("/:id", getGalleryById);


// ==========================================
// ADMIN READ ROUTES
// ==========================================

// Get All Gallery Images (Admin)
router.get(
  "/admin/all",
  authentication,
  authorize("gallery", "read"),
  getGallery
);

// Get Single Gallery Image (Admin)
router.get(
  "/admin/:id",
  authentication,
  authorize("gallery", "read"),
  getGalleryById
);


// ==========================================
// ADMIN WRITE ROUTES
// ==========================================

// Create Gallery Image
router.post(
  "/",
  authentication,
  authorize("gallery", "create"),
  upload.single("image"),
  createGallery
);

// Update Gallery Image
router.put(
  "/:id",
  authentication,
  authorize("gallery", "update"),
  upload.single("image"),
  updateGallery
);

// Delete Gallery Image
router.delete(
  "/:id",
  authentication,
  authorize("gallery", "delete"),
  deleteGallery
);


module.exports = router;
