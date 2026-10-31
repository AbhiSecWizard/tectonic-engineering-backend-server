const mongoose = require("mongoose");

const CATEGORIES = [
  "Design",
  "Peer Review",
  "Value Engineering",
  "Structural Audit",
  "Steel Detailing",
  "Cost Optimisation",
  "Case Study",
  "News",
];

const STATUSES = ["draft", "published", "archived"];

const WORDS_PER_MINUTE = 200;

// Cloudinary image: keep publicId so the file can be deleted later
const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { _id: false }
);

const slugify = (text) =>
  text
    .toString()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "");

const countWords = (html) =>
  html
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;

const blogSchema = new mongoose.Schema(
  {
    // ---- Fields used by BlogCard ----
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: 150,
    },

    // URL part, e.g. "why-peer-review-matters". Generated from the title if empty.
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      match: [
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug can only contain lowercase letters, numbers and hyphens",
      ],
    },

    excerpt: {
      type: String,
      required: [true, "Excerpt is required"],
      trim: true,
      maxlength: 300,
    },

    coverImage: imageSchema,
    coverImageAlt: { type: String, trim: true, maxlength: 150 },

    category: {
      type: String,
      enum: CATEGORIES,
      required: [true, "Category is required"],
      index: true,
    },

    // Name shown on the card
    author: {
      type: String,
      trim: true,
      default: "Tectonic Engineering",
    },

    publishedAt: Date,

    // Minutes. Calculated from the content if you don't set it.
    readTime: { type: Number, min: 1 },

    // ---- CRM fields ----
    // Full article body (HTML or Markdown, whichever your editor produces)
    content: {
      type: String,
      required: [
        function () {
          return this.status === "published";
        },
        "Content is required to publish an article",
      ],
    },

    status: {
      type: String,
      enum: STATUSES,
      default: "draft",
      index: true,
    },

    // Pin to the top as the featured post
    isFeatured: { type: Boolean, default: false },

    tags: [{ type: String, trim: true, lowercase: true }],

    // SEO
    metaTitle: { type: String, trim: true, maxlength: 70 },
    metaDescription: { type: String, trim: true, maxlength: 160 },

    views: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

blogSchema.index({ status: 1, publishedAt: -1 });
blogSchema.index(
  { title: "text", excerpt: "text", tags: "text" },
  { weights: { title: 5, tags: 3, excerpt: 1 } }
);

blogSchema.pre("validate", async function () {
  // Slug from the title, made unique by adding -2, -3 ...
  if (!this.slug && this.title) {
    const base = slugify(this.title);
    let candidate = base;
    let count = 1;

    while (
      await this.constructor.exists({ slug: candidate, _id: { $ne: this._id } })
    ) {
      count += 1;
      candidate = `${base}-${count}`;
    }
    this.slug = candidate;
  }

  // Read time from the content, unless it was set by hand
  if (this.content && this.isModified("content") && !this.isModified("readTime")) {
    this.readTime = Math.max(
      1,
      Math.ceil(countWords(this.content) / WORDS_PER_MINUTE)
    );
  }

  // The card shows an image, so a published article needs one
  if (this.status === "published" && !this.coverImage?.url) {
    this.invalidate("coverImage", "A cover image is required to publish");
  }
});

// Set the publish date the first time an article goes live
blogSchema.pre("save", function () {
  if (this.status === "published" && !this.publishedAt) {
    this.publishedAt = new Date();
  }
});

// Articles visible on the website: published, and not scheduled for the future
blogSchema.statics.findPublished = function (filter = {}) {
  return this.find({
    ...filter,
    status: "published",
    publishedAt: { $lte: new Date() },
  });
};

blogSchema.statics.CATEGORIES = CATEGORIES;
blogSchema.statics.STATUSES = STATUSES;

module.exports = mongoose.model("Blog", blogSchema);