const mongoose = require("mongoose");
const teamSchema = new mongoose.Schema(
  {
    photo: {
      url: {
        type: String,
        required: [true, "Team member photo URL is required"],
        trim: true,
      },
      publicId: {
        type: String,
        required: [true, "Cloudinary public ID is required"],
        trim: true,
      },
    },

    name: {
      type: String,
      required: [true, "Team member name is required"],
      trim: true,
    },

    workEmail: {
      type: String,
      required: [true, "Team member work email is required"],
      trim: true,
      lowercase: true,
    },

    designation: {
      type: String,
      required: [true, "Team member designation is required"],
      trim: true,
    },

    education: {
      type: String,
      trim: true,
      default: "",
    },

    note: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate work email addresses
teamSchema.index({ workEmail: 1 }, { unique: true });

const Team = mongoose.model("Team", teamSchema);

module.exports = Team;
