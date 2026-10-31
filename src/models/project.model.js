const mongoose = require("mongoose");

// ======================================================
// CONSTANTS
// ======================================================

const CATEGORIES = [
  "Statues",
  "Industrial & Energy",
  "Railway",
  "Commercial",
  "Residential",
  "Infrastructure",
];

const SERVICES = [
  "Structural Design & Drafting",
  "Structural Peer Review",
  "Value Engineering",
  "Structural Audit",
  "Cost Optimisation",
  "BOQ & Bar Bending Schedule",
  "Detail Fabrication Drawing",
  "General Arrangement Drawing",
  "Connection Design",
];

const STRUCTURE_TYPES = [
  "RCC",
  "Steel",
  "PEB",
  "Composite",
  "Other",
];

const SOFTWARE = [
  "STAAD Pro",
  "ETABS",
  "SAFE",
  "AutoCAD",
  "Tekla Structures",
  "IDEA StatiCa",
];

const STATUSES = [
  "Upcoming",
  "Ongoing",
  "On Hold",
  "Completed",
  "Cancelled",
];

// ======================================================
// IMAGE SCHEMA
// ======================================================

const imageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },

    publicId: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    _id: false,
  }
);

// ======================================================
// PROJECT SCHEMA
// ======================================================

const projectSchema = new mongoose.Schema(
  {
    // -------------------------
    // BASIC INFORMATION
    // -------------------------

    code: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true,
    },

    name: {
      type: String,
      required: [true, "Project name is required"],
      trim: true,
      maxlength: [150, "Project name cannot exceed 150 characters"],
    },

    client: {
      type: String,
      required: [true, "Client name is required"],
      trim: true,
      maxlength: [150, "Client name cannot exceed 150 characters"],
    },

    category: {
      type: String,
      enum: CATEGORIES,
      required: [true, "Category is required"],
    },

    structureType: {
      type: String,
      enum: STRUCTURE_TYPES,
    },

    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },

    // -------------------------
    // SERVICES
    // -------------------------

    services: {
      type: [
        {
          type: String,
          enum: SERVICES,
        },
      ],

      validate: {
        validator: function (value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: "Select at least one service",
      },
    },

    // -------------------------
    // LOCATION
    // -------------------------

    location: {
      city: {
        type: String,
        trim: true,
      },

      state: {
        type: String,
        trim: true,
      },

      country: {
        type: String,
        trim: true,
        default: "India",
      },
    },

    // -------------------------
    // PROJECT SPECIFICATIONS
    // -------------------------

    specs: {
      size: {
        type: String,
        trim: true,
      },

      floors: {
        type: String,
        trim: true,
      },
    },

    // -------------------------
    // STATUS & DATES
    // -------------------------

    status: {
      type: String,
      enum: STATUSES,
      default: "Upcoming",
    },

    startDate: {
      type: Date,
    },

    expectedEndDate: {
      type: Date,
    },

    completedDate: {
      type: Date,
    },

    // -------------------------
    // FINANCIAL
    // -------------------------

    contractValue: {
      type: Number,
      min: [0, "Contract value cannot be negative"],
    },

    currency: {
      type: String,
      default: "INR",
      uppercase: true,
      trim: true,
    },

    // -------------------------
    // CONTACT PERSON
    // -------------------------

    contactPerson: {
      name: {
        type: String,
        trim: true,
      },

      phone: {
        type: String,
        trim: true,
      },

      email: {
        type: String,
        trim: true,
        lowercase: true,
      },
    },

    // -------------------------
    // SOFTWARE
    // -------------------------

    softwareUsed: [
      {
        type: String,
        enum: SOFTWARE,
      },
    ],

    // -------------------------
    // WEBSITE
    // -------------------------

    showOnWebsite: {
      type: Boolean,
      default: false,
    },

    // -------------------------
    // COVER IMAGE
    // -------------------------

    coverImage: {
      url: {
        type: String,
        trim: true,
      },

      publicId: {
        type: String,
        trim: true,
      },
    },

    // -------------------------
    // GALLERY IMAGES
    // -------------------------

    images: {
      type: [imageSchema],
      default: [],
    },

    // -------------------------
    // NOTES
    // -------------------------

    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// ======================================================
// TEXT SEARCH INDEX
// ======================================================

projectSchema.index({
  name: "text",
  description: "text",
});

// ======================================================
// DATE VALIDATION
// ======================================================

projectSchema.pre("validate", function () {
  if (
    this.startDate &&
    this.expectedEndDate &&
    this.expectedEndDate < this.startDate
  ) {
    this.invalidate(
      "expectedEndDate",
      "Expected end date cannot be before start date"
    );
  }
});

// ======================================================
// AUTOMATIC COMPLETED DATE
// ======================================================

projectSchema.pre("save", function () {
  if (!this.isModified("status")) {
    return;
  }

  if (this.status === "Completed" && !this.completedDate) {
    this.completedDate = new Date();
  }

  if (this.status !== "Completed") {
    this.completedDate = undefined;
  }
});

// ======================================================
// MODEL
// ======================================================

const Project = mongoose.model("Project", projectSchema);

module.exports = Project;