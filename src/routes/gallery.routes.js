const express = require("express");

const router = express.Router();

const { upload } = require("../middlewares/upload");

const {
  createGallery,
  getGallery,
  getGalleryById,
  updateGallery,
  deleteGallery,
} = require("../controllers/gallery.controller");
// CREATE GALLERY IMAGE

router.post("/", upload.single("image"), createGallery);
// GET ALL GALLERY IMAGES

router.get("/", getGallery);
// GET SINGLE GALLERY IMAGE

router.get("/:id", getGalleryById);
// UPDATE GALLERY IMAGE

router.put("/:id", upload.single("image"), updateGallery);
// DELETE GALLERY IMAGE

router.delete("/:id", deleteGallery);

module.exports = router;
