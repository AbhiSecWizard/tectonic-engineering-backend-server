
const mongoose = require("mongoose");

const gallerySchema = new mongoose.Schema(
  {
    image: {
      url: {
        type: String,
        required: [true, "Image URL is required"],
      },
      publicId: {
        type: String,
        required: [true, "Cloudinary public ID is required"],
      },
    },

    imageName: {
      type: String,
      required: [true, "Image name is required"],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);
const Gallery = mongoose.model("Gallery", gallerySchema);


module.exports = Gallery;
