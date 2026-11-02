
const Gallery = require("../models/gallery.model");

const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../services/cloudinaryUpload");


// 1. CREATE GALLERY - Upload Image
const createGallery = async (req, res) => {
  try {
    const { imageName } = req.body;

    // Validate image name
    if (!imageName || !imageName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Image name is required",
      });
    }

    // Validate uploaded file
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload an image",
      });
    }

    // Upload image to Cloudinary
    const image = await uploadToCloudinary(
      req.file.buffer,
      "gallery"
    );

    // Save image details in MongoDB
    const gallery = await Gallery.create({
      image,
      imageName: imageName.trim(),
    });

    return res.status(201).json({
      success: true,
      message: "Gallery image uploaded successfully",
      data: gallery,
    });

  } catch (error) {
    console.error("Create Gallery Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to upload gallery image",
      error: error.message,
    });
  }
};


// 2. GET ALL GALLERY IMAGES
const getGallery = async (req, res) => {
  try {
    const gallery = await Gallery.find().sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: gallery.length,
      data: gallery,
    });

  } catch (error) {
    console.error("Get Gallery Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch gallery images",
    });
  }
};


// 3. GET SINGLE GALLERY IMAGE
const getGalleryById = async (req, res) => {
  try {
    const gallery = await Gallery.findById(req.params.id);

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
    console.error("Get Gallery By ID Error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid gallery ID",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to fetch gallery image",
    });
  }
};


// 4. UPDATE GALLERY IMAGE
const updateGallery = async (req, res) => {
  try {
    const { imageName } = req.body;

    const gallery = await Gallery.findById(req.params.id);

    if (!gallery) {
      return res.status(404).json({
        success: false,
        message: "Gallery image not found",
      });
    }

    // Update image name if provided
    if (imageName !== undefined) {
      if (!imageName.trim()) {
        return res.status(400).json({
          success: false,
          message: "Image name cannot be empty",
        });
      }

      gallery.imageName = imageName.trim();
    }

    // If a new image is uploaded
    if (req.file) {
      const newImage = await uploadToCloudinary(
        req.file.buffer,
        "gallery"
      );

      const oldPublicId = gallery.image.publicId;

      gallery.image = newImage;

      await gallery.save();

      // Delete old image after successful database update
      await deleteFromCloudinary(oldPublicId);

    } else {
      await gallery.save();
    }

    return res.status(200).json({
      success: true,
      message: "Gallery updated successfully",
      data: gallery,
    });

  } catch (error) {
    console.error("Update Gallery Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update gallery image",
      error: error.message,
    });
  }
};


// 5. DELETE GALLERY IMAGE
const deleteGallery = async (req, res) => {
  try {
    const gallery = await Gallery.findById(req.params.id);

    if (!gallery) {
      return res.status(404).json({
        success: false,
        message: "Gallery image not found",
      });
    }

    // Delete image from Cloudinary
    await deleteFromCloudinary(gallery.image.publicId);

    // Delete record from MongoDB
    await Gallery.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Gallery image deleted successfully",
    });

  } catch (error) {
    console.error("Delete Gallery Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete gallery image",
    });
  }
};


module.exports = {
  createGallery,
  getGallery,
  getGalleryById,
  updateGallery,
  deleteGallery,
};
