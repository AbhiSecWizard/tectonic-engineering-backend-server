const cloudinary = require("../config/cloudinary"); // adjust path if your config lives elsewhere

// Upload an in-memory buffer (from multer) to Cloudinary
const uploadToCloudinary = (buffer, folder = "projects") =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });

// Delete one image by publicId (never throws, so a failed delete won't break the request)
const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error(`Cloudinary delete failed for ${publicId}:`, err.message);
  }
};

module.exports = { uploadToCloudinary, deleteFromCloudinary };