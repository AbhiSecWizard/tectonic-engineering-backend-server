const mongoose = require("mongoose");

const SECTORS = ["government", "private", "international"];
const STATUSES = ["active", "prospect", "inactive"];

const GSTIN_REGEX =
  /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;


// ========================
// Logo Schema
// ========================

const imageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
    },

    publicId: {
      type: String,
      required: true,
    },
  },
  {
    _id: false,
  }
);


// ========================
// Contact Schema
// ========================

const contactSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Contact name is required"],
      trim: true,
      maxlength: 100,
    },

    designation: {
      type: String,
      trim: true,
      maxlength: 100,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Enter a valid contact email"],
    },

    phone: {
      type: String,
      trim: true,
      maxlength: 20,
    },

    isPrimary: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: true,
  }
);


// ========================
// Client Schema
// ========================

const clientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Client name is required"],
      trim: true,
      maxlength: 150,
    },

    shortName: {
      type: String,
      trim: true,
      maxlength: 40,
    },

    sector: {
      type: String,
      enum: SECTORS,
      required: [true, "Sector is required"],
      index: true,
    },

    status: {
      type: String,
      enum: STATUSES,
      default: "active",
      index: true,
    },

    logo: {
      type: imageSchema,
      default: undefined,
    },

    website: {
      type: String,
      trim: true,
      maxlength: 200,
    },

    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      match: [GSTIN_REGEX, "Enter a valid 15-character GSTIN"],
    },

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

    contacts: {
      type: [contactSchema],
      default: [],
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },

    // ========================
    // Website
    // ========================

    showOnWebsite: {
      type: Boolean,
      default: false,
    },

    displayOrder: {
      type: Number,
      default: 0,
    },

    work: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],
      default: [],
    },

    scope: {
      type: String,
      trim: true,
      maxlength: 200,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
    },
    toObject: {
      virtuals: true,
    },
  }
);


// ========================
// Indexes
// ========================

clientSchema.index(
  { name: 1 },
  {
    unique: true,
    collation: {
      locale: "en",
      strength: 2,
    },
  }
);

clientSchema.index({
  showOnWebsite: 1,
  displayOrder: 1,
});


// ========================
// Project Virtual
// ========================

clientSchema.virtual("projects", {
  ref: "Project",
  localField: "_id",
  foreignField: "client",
});

clientSchema.virtual("projectCount", {
  ref: "Project",
  localField: "_id",
  foreignField: "client",
  count: true,
});


// ========================
// Validation
// ========================

clientSchema.pre("validate", function () {
  const primaryContacts = this.contacts.filter(
    (contact) => contact.isPrimary
  );

  if (primaryContacts.length > 1) {
    this.invalidate(
      "contacts",
      "Only one contact can be marked as primary"
    );
  }
});


// ========================
// Static values
// ========================

clientSchema.statics.SECTORS = SECTORS;
clientSchema.statics.STATUSES = STATUSES;


module.exports = mongoose.model("Client", clientSchema);