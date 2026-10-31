const mongoose = require("mongoose");
const Blog = require("../models/blog.model");
// The file that exports uploadToCloudinary and deleteFromCloudinary (adjust the path)
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../services/cloudinaryUpload");

// =========================
// Config
// =========================

const COVER_FOLDER = "blogs";

// Fields the admin is allowed to set
const TEXT_FIELDS = [
  "title",
  "slug",
  "excerpt",
  "coverImageAlt",
  "category",
  "author",
  "publishedAt",
  "readTime",
  "content",
  "status",
  "metaTitle",
  "metaDescription",
];

// These may be cleared by sending an empty string
const CLEARABLE_FIELDS = ["coverImageAlt", "metaTitle", "metaDescription"];

// What a blog card needs (no article body)
const CARD_FIELDS =
  "title slug excerpt coverImage coverImageAlt category author publishedAt readTime isFeatured";

const ADMIN_SORTS = [
  "-createdAt",
  "createdAt",
  "-publishedAt",
  "publishedAt",
  "title",
  "-title",
  "-views",
];

// =========================
// Helpers
// =========================

const isTrue = (value) => value === true || value === "true";

const fail = (res, status, message) =>
  res.status(status).json({ success: false, message });

// Visible on the website: published, and not scheduled for the future
const publishedFilter = (extra = {}) => ({
  ...extra,
  status: "published",
  publishedAt: { $lte: new Date() },
});

// tags can arrive as an array, a JSON string, or "a, b, c"
const parseTags = (value) => {
  let tags = value;

  if (typeof tags === "string") {
    try {
      tags = JSON.parse(tags);
    } catch {
      tags = tags.split(",");
    }
  }

  return (Array.isArray(tags) ? tags : [tags])
    .map((tag) => String(tag).trim())
    .filter(Boolean);
};

// Take only the allowed fields from req.body and fix their types
const pickPayload = (body) => {
  const payload = {};

  TEXT_FIELDS.forEach((field) => {
    if (body[field] === undefined) return;
    // skip empty strings so they can't cause enum, date or number cast errors
    if (body[field] === "" && !CLEARABLE_FIELDS.includes(field)) return;
    payload[field] = body[field];
  });

  if (body.tags !== undefined) payload.tags = parseTags(body.tags);
  if (body.isFeatured !== undefined) {
    payload.isFeatured = isTrue(body.isFeatured);
  }

  return payload;
};

const sendError = (res, error) => {
  if (error.name === "ValidationError") {
    const errors = Object.values(error.errors).map((e) => e.message);
    return res.status(400).json({ success: false, message: errors[0], errors });
  }

  if (error.name === "CastError") {
    return fail(res, 400, `Invalid value for ${error.path}`);
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0] || "field";
    return fail(res, 409, `An article with this ${field} already exists`);
  }

  console.error(error);
  const message =
    process.env.NODE_ENV === "production" ? "Server error" : error.message;
  return fail(res, 500, message || "Server error");
};

// Wraps a handler so any thrown error goes through sendError
const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    sendError(res, error);
  }
};

// Returns the article, or sends a 400/404 and returns null
const findPost = async (id, res) => {
  if (!mongoose.isValidObjectId(id)) {
    fail(res, 400, "Invalid article ID");
    return null;
  }

  const post = await Blog.findById(id);
  if (!post) fail(res, 404, "Article not found");
  return post;
};

const getPagination = (query, defaultLimit, maxLimit) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(
    Math.max(parseInt(query.limit, 10) || defaultLimit, 1),
    maxLimit
  );
  return { page, limit, skip: (page - 1) * limit };
};

const sendPage = (res, data, total, { page, limit }, extra = {}) =>
  res.json({
    success: true,
    count: data.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data,
    ...extra,
  });

// =========================
// PUBLIC
// =========================

// GET /api/blogs
// Query: category, search, page, limit
// Featured article first, then newest. No article body.
const getPublishedPosts = handle(async (req, res) => {
  const { category, search } = req.query;

  const filter = {};
  if (category) filter.category = category;
  if (search) filter.$text = { $search: search };

  const pagination = getPagination(req.query, 12, 50);

  const [posts, total] = await Promise.all([
    Blog.find(publishedFilter(filter))
      .select(CARD_FIELDS)
      .sort({ isFeatured: -1, publishedAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    Blog.countDocuments(publishedFilter(filter)),
  ]);

  sendPage(res, posts, total, pagination);
});

// GET /api/blogs/categories
// Categories that have published articles, with counts (for the filter chips)
const getCategories = handle(async (req, res) => {
  const counts = await Blog.aggregate([
    { $match: publishedFilter() },
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  res.json({
    success: true,
    data: counts.map(({ _id, count }) => ({ category: _id, count })),
    all: Blog.CATEGORIES, // every allowed category, for admin dropdowns
  });
});

// GET /api/blogs/:slug
// Full article, plus up to 3 related articles. Adds 1 to the view count.
const getPostBySlug = handle(async (req, res) => {
  const post = await Blog.findOneAndUpdate(
    publishedFilter({ slug: req.params.slug.toLowerCase() }),
    { $inc: { views: 1 } },
    { new: true }
  );

  if (!post) return fail(res, 404, "Article not found");

  const related = await Blog.find(
    publishedFilter({ category: post.category, _id: { $ne: post._id } })
  )
    .select(CARD_FIELDS)
    .sort("-publishedAt")
    .limit(3);

  res.json({ success: true, data: post, related });
});

// =========================
// ADMIN (protected)
// =========================

// GET /api/blogs/admin/all
// Query: status, category, search, sort, page, limit
const getAllPosts = handle(async (req, res) => {
  const { status, category, search, sort } = req.query;

  const filter = {};
  if (status && Blog.STATUSES.includes(status)) filter.status = status;
  if (category) filter.category = category;
  if (search) filter.$text = { $search: search };

  const pagination = getPagination(req.query, 10, 100);
  const sortBy = ADMIN_SORTS.includes(sort) ? sort : "-createdAt";

  const [posts, total, statusCounts] = await Promise.all([
    Blog.find(filter)
      .select("-content")
      .sort(sortBy)
      .skip(pagination.skip)
      .limit(pagination.limit),
    Blog.countDocuments(filter),
    Blog.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  // { draft: 2, published: 6, archived: 0 } for the status tabs
  const counts = Object.fromEntries(Blog.STATUSES.map((s) => [s, 0]));
  statusCounts.forEach(({ _id, count }) => {
    counts[_id] = count;
  });

  sendPage(res, posts, total, pagination, { counts });
});

// GET /api/blogs/admin/:id
const getPostById = handle(async (req, res) => {
  const post = await findPost(req.params.id, res);
  if (post) res.json({ success: true, data: post });
});

// POST /api/blogs
// multipart/form-data, file field: coverImage  
const createPost = handle(async (req, res) => {
  let uploadedId; // rolled back if saving fails

  try {
    const payload = pickPayload(req.body);

    if (req.file) {
      const cover = await uploadToCloudinary(req.file.buffer, COVER_FOLDER);
      uploadedId = cover.publicId;
      payload.coverImage = cover;
    }

    const post = await Blog.create(payload);

    res.status(201).json({
      success: true,
      message: "Article created successfully",
      data: post,
    });
  } catch (error) {
    await deleteFromCloudinary(uploadedId);
    throw error;
  }
});

const updatePost = handle(async (req, res) => {
  const post = await findPost(req.params.id, res);
  if (!post) return;

  let uploadedId; // new upload, rolled back if the update fails
  let staleId; // old cover, deleted only after the save succeeds

  try {
    // set() + save() so the model's validation and hooks run
    post.set(pickPayload(req.body));

    if (req.file) {
      const cover = await uploadToCloudinary(req.file.buffer, COVER_FOLDER);
      uploadedId = cover.publicId;
      staleId = post.coverImage?.publicId;
      post.coverImage = cover;
    } else if (isTrue(req.body.removeCover) && post.coverImage?.publicId) {
      staleId = post.coverImage.publicId;
      post.coverImage = undefined;
    }

    await post.save();
    await deleteFromCloudinary(staleId);

    res.json({
      success: true,
      message: "Article updated successfully",
      data: post,
    });
  } catch (error) {
    await deleteFromCloudinary(uploadedId);
    throw error;
  }
});

// PATCH /api/blogs/:id/status
// Body: { status: "draft" | "published" | "archived", publishedAt?: date }
// Send a future publishedAt to schedule an article.
const updateStatus = handle(async (req, res) => {
  const { status, publishedAt } = req.body;

  if (!Blog.STATUSES.includes(status)) {
    return fail(
      res,
      400,
      `Status must be one of: ${Blog.STATUSES.join(", ")}`
    );
  }

  const post = await findPost(req.params.id, res);
  if (!post) return;

  post.status = status;
  if (publishedAt) post.publishedAt = publishedAt;

  // Validation runs here: publishing needs content and a cover image
  await post.save();

  res.json({
    success: true,
    message: `Article is now ${status}`,
    data: {
      _id: post._id,
      status: post.status,
      publishedAt: post.publishedAt,
    },
  });
});

// PATCH /api/blogs/:id/featured
const toggleFeatured = handle(async (req, res) => {
  const post = await findPost(req.params.id, res);
  if (!post) return;

  post.isFeatured = !post.isFeatured;
  await post.save();

  res.json({
    success: true,
    message: post.isFeatured ? "Article is now featured" : "Article is no longer featured",
    data: { _id: post._id, isFeatured: post.isFeatured },
  });
});

// DELETE /api/blogs/:id
const deletePost = handle(async (req, res) => {
  const post = await findPost(req.params.id, res);
  if (!post) return;

  const coverId = post.coverImage?.publicId;

  await post.deleteOne();
  await deleteFromCloudinary(coverId);

  res.json({ success: true, message: "Article deleted successfully" });
});

module.exports = {
  getPublishedPosts,
  getCategories,
  getPostBySlug,
  getAllPosts,
  getPostById,
  createPost,
  updatePost,
  updateStatus,
  toggleFeatured,
  deletePost,
};