
const mongoose = require("mongoose");

const Gallery = require("../models/gallery.model");

const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../services/cloudinaryUpload");

const createAuditLog = require("../utils/createAuditLog");


// =====================================================
// CONFIGURATION
// =====================================================

const GALLERY_FOLDER = "gallery";


// =====================================================
// HELPER FUNCTIONS
// =====================================================

// Validate MongoDB ObjectId
const isValidId = (id) => {
  return mongoose.isValidObjectId(id);
};


// Safely delete Cloudinary image
const safelyDeleteImage = async (publicId) => {
  if (!publicId) return;

  try {
    await deleteFromCloudinary(publicId);
  } catch (error) {
    console.error(
      "Cloudinary Image Cleanup Error:",
      error.message
    );
  }
};


// Common error handler
const sendError = (res, error) => {
  console.error("Gallery Controller Error:", error);

  if (error.name === "ValidationError") {
    const errors = Object.values(error.errors).map(
      (item) => item.message
    );

    return res.status(400).json({
      success: false,
      message: errors[0],
      errors,
    });
  }

  if (error.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid gallery ID",
    });
  }

  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "Gallery record already exists",
    });
  }

  return res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Server error"
        : error.message,
  });
};


// =====================================================
// CREATE GALLERY
// POST /api/gallery
// =====================================================

const createGallery = async (req, res) => {
  let uploadedImage = null;

  try {
    const { imageName } = req.body;

    // Validate image name
    if (
      typeof imageName !== "string" ||
      !imageName.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Image name is required",
      });
    }

    // Validate uploaded image
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload an image",
      });
    }

    // Upload image to Cloudinary
    uploadedImage = await uploadToCloudinary(
      req.file.buffer,
      GALLERY_FOLDER
    );

    // Save gallery record in MongoDB
    const gallery = await Gallery.create({
      image: uploadedImage,
      imageName: imageName.trim(),
    });

    // Activity Log
    await createAuditLog({
      req,
      module: "gallery",
      action: "create",
      description: `Uploaded gallery image: ${gallery.imageName}`,
      targetId: gallery._id,
      targetName: gallery.imageName,
    });

    return res.status(201).json({
      success: true,
      message: "Gallery image uploaded successfully",
      data: gallery,
    });

  } catch (error) {
    // Rollback uploaded image if database operation fails
    if (uploadedImage?.publicId) {
      await safelyDeleteImage(uploadedImage.publicId);
    }

    return sendError(res, error);
  }
};


// =====================================================
// GET ALL GALLERY IMAGES
// GET /api/gallery
// =====================================================

const getGallery = async (req, res) => {
  try {
    const gallery = await Gallery.find()
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: gallery.length,
      data: gallery,
    });

  } catch (error) {
    return sendError(res, error);
  }
};


// =====================================================
// GET SINGLE GALLERY IMAGE
// GET /api/gallery/:id
// =====================================================

const getGalleryById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid gallery ID",
      });
    }

    const gallery = await Gallery.findById(id);

    if (!gallery) {
      return res.status(404).json({
        success: false,
        message: "Gallery image not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: gallery,
    });

  } catch (error) {
    return sendError(res, error);
  }
};


// =====================================================
// UPDATE GALLERY IMAGE
// PUT /api/gallery/:id
// =====================================================

const updateGallery = async (req, res) => {
  let newImage = null;

  try {
    const { id } = req.params;
    const { imageName } = req.body;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid gallery ID",
      });
    }

    const gallery = await Gallery.findById(id);

    if (!gallery) {
      return res.status(404).json({
        success: false,
        message: "Gallery image not found",
      });
    }

    // Validate image name if provided
    if (imageName !== undefined) {
      if (
        typeof imageName !== "string" ||
        !imageName.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Image name cannot be empty",
        });
      }

      gallery.imageName = imageName.trim();
    }

    const oldPublicId = gallery.image?.publicId;

    // Upload replacement image
    if (req.file) {
      newImage = await uploadToCloudinary(
        req.file.buffer,
        GALLERY_FOLDER
      );

      gallery.image = newImage;
    }

    // Save updated gallery record
    await gallery.save();

    // Activity Log
    await createAuditLog({
      req,
      module: "gallery",
      action: "update",
      description: `Updated gallery image: ${gallery.imageName}`,
      targetId: gallery._id,
      targetName: gallery.imageName,
      metadata: {
        imageNameChanged: imageName !== undefined,
        imageChanged: Boolean(req.file),
      },
    });

    // Delete old image after successful database update
    if (req.file && oldPublicId) {
      await safelyDeleteImage(oldPublicId);
    }

    return res.status(200).json({
      success: true,
      message: "Gallery updated successfully",
      data: gallery,
    });

  } catch (error) {
    // Remove newly uploaded image if update fails
    if (newImage?.publicId) {
      await safelyDeleteImage(newImage.publicId);
    }

    return sendError(res, error);
  }
};


// =====================================================
// DELETE GALLERY IMAGE
// DELETE /api/gallery/:id
// =====================================================

const deleteGallery = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid gallery ID",
      });
    }

    const gallery = await Gallery.findById(id);

    if (!gallery) {
      return res.status(404).json({
        success: false,
        message: "Gallery image not found",
      });
    }

    // Store details before deletion
    const deletedGalleryId = gallery._id;
    const deletedImageName = gallery.imageName;
    const publicId = gallery.image?.publicId;

    // Delete record from MongoDB
    await gallery.deleteOne();

    // Activity Log
    await createAuditLog({
      req,
      module: "gallery",
      action: "delete",
      description: `Deleted gallery image: ${deletedImageName}`,
      targetId: deletedGalleryId,
      targetName: deletedImageName,
    });

    // Delete image from Cloudinary
    if (publicId) {
      await safelyDeleteImage(publicId);
    }

    return res.status(200).json({
      success: true,
      message: "Gallery image deleted successfully",
    });

  } catch (error) {
    return sendError(res, error);
  }
};


// =====================================================
// EXPORT CONTROLLERS
// =====================================================

module.exports = {
  createGallery,
  getGallery,
  getGalleryById,
  updateGallery,
  deleteGallery,
};
