
const mongoose = require("mongoose");
const Blog = require("../models/blog.model");

const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../services/cloudinaryUpload");

const createAuditLog = require("../utils/createAuditLog");

// ==========================================
// CONFIGURATION
// ==========================================

const COVER_FOLDER = "blogs";

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

const CLEARABLE_FIELDS = [
  "coverImageAlt",
  "metaTitle",
  "metaDescription",
];

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

// ==========================================
// HELPER FUNCTIONS
// ==========================================

const isTrue = (value) =>
  value === true || value === "true";

const fail = (res, status, message) => {
  return res.status(status).json({
    success: false,
    message,
  });
};


// Public website par sirf published blogs show honge
const publishedFilter = (extra = {}) => ({
  ...extra,
  status: "published",
  publishedAt: {
    $lte: new Date(),
  },
});


// Parse blog tags
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


// Pick only allowed fields
const pickPayload = (body) => {
  const payload = {};

  TEXT_FIELDS.forEach((field) => {
    if (body[field] === undefined) return;

    if (
      body[field] === "" &&
      !CLEARABLE_FIELDS.includes(field)
    ) {
      return;
    }

    payload[field] = body[field];
  });

  if (body.tags !== undefined) {
    payload.tags = parseTags(body.tags);
  }

  if (body.isFeatured !== undefined) {
    payload.isFeatured = isTrue(body.isFeatured);
  }

  return payload;
};


// Common error handler
const sendError = (res, error) => {
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
    return fail(
      res,
      400,
      `Invalid value for ${error.path}`
    );
  }

  if (error.code === 11000) {
    const field =
      Object.keys(error.keyPattern || {})[0] || "field";

    return fail(
      res,
      409,
      `An article with this ${field} already exists`
    );
  }

  console.error("Blog Controller Error:", error);

  const message =
    process.env.NODE_ENV === "production"
      ? "Server error"
      : error.message;

  return fail(res, 500, message || "Server error");
};


// Async error handler
const handle = (fn) => {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (error) {
      sendError(res, error);
    }
  };
};


// Find blog by ID
const findPost = async (id, res) => {
  if (!mongoose.isValidObjectId(id)) {
    fail(res, 400, "Invalid article ID");
    return null;
  }

  const post = await Blog.findById(id);

  if (!post) {
    fail(res, 404, "Article not found");
    return null;
  }

  return post;
};


// Pagination helper
const getPagination = (
  query,
  defaultLimit,
  maxLimit
) => {
  const page = Math.max(
    parseInt(query.page, 10) || 1,
    1
  );

  const limit = Math.min(
    Math.max(
      parseInt(query.limit, 10) || defaultLimit,
      1
    ),
    maxLimit
  );

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};


// Common pagination response
const sendPage = (
  res,
  data,
  total,
  { page, limit },
  extra = {}
) => {
  return res.json({
    success: true,
    count: data.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data,
    ...extra,
  });
};


// ==========================================
// PUBLIC CONTROLLERS
// ==========================================


// GET /api/blogs
// Get all published blogs
const getPublishedPosts = handle(async (req, res) => {
  const { category, search } = req.query;

  const filter = {};

  if (category) {
    filter.category = category;
  }

  if (search) {
    filter.$text = {
      $search: search,
    };
  }

  const pagination = getPagination(
    req.query,
    12,
    50
  );

  const published = publishedFilter(filter);

  const [posts, total] = await Promise.all([
    Blog.find(published)
      .select(CARD_FIELDS)
      .sort({
        isFeatured: -1,
        publishedAt: -1,
      })
      .skip(pagination.skip)
      .limit(pagination.limit),

    Blog.countDocuments(published),
  ]);

  sendPage(res, posts, total, pagination);
});


// GET /api/blogs/categories
// Get published blog categories
const getCategories = handle(async (req, res) => {
  const counts = await Blog.aggregate([
    {
      $match: publishedFilter(),
    },
    {
      $group: {
        _id: "$category",
        count: {
          $sum: 1,
        },
      },
    },
    {
      $sort: {
        count: -1,
      },
    },
  ]);

  return res.json({
    success: true,
    data: counts.map(({ _id, count }) => ({
      category: _id,
      count,
    })),
    all: Blog.CATEGORIES,
  });
});


// GET /api/blogs/:slug
// Get single published blog
const getPostBySlug = handle(async (req, res) => {
  const post = await Blog.findOneAndUpdate(
    publishedFilter({
      slug: req.params.slug.toLowerCase(),
    }),
    {
      $inc: {
        views: 1,
      },
    },
    {
      new: true,
    }
  );

  if (!post) {
    return fail(res, 404, "Article not found");
  }

  const related = await Blog.find(
    publishedFilter({
      category: post.category,
      _id: {
        $ne: post._id,
      },
    })
  )
    .select(CARD_FIELDS)
    .sort("-publishedAt")
    .limit(3);

  return res.json({
    success: true,
    data: post,
    related,
  });
});


// ==========================================
// ADMIN CONTROLLERS
// ==========================================


// GET /api/blogs/admin/all
// Get all blogs for admin
const getAllPosts = handle(async (req, res) => {
  const {
    status,
    category,
    search,
    sort,
  } = req.query;

  const filter = {};

  if (status && Blog.STATUSES.includes(status)) {
    filter.status = status;
  }

  if (category) {
    filter.category = category;
  }

  if (search) {
    filter.$text = {
      $search: search,
    };
  }

  const pagination = getPagination(
    req.query,
    10,
    100
  );

  const sortBy = ADMIN_SORTS.includes(sort)
    ? sort
    : "-createdAt";

  const [posts, total, statusCounts] =
    await Promise.all([
      Blog.find(filter)
        .select("-content")
        .sort(sortBy)
        .skip(pagination.skip)
        .limit(pagination.limit),

      Blog.countDocuments(filter),

      Blog.aggregate([
        {
          $group: {
            _id: "$status",
            count: {
              $sum: 1,
            },
          },
        },
      ]),
    ]);

  const counts = Object.fromEntries(
    Blog.STATUSES.map((item) => [item, 0])
  );

  statusCounts.forEach(({ _id, count }) => {
    counts[_id] = count;
  });

  sendPage(res, posts, total, pagination, {
    counts,
  });
});


// GET /api/blogs/admin/:id
// Get single blog for admin
const getPostById = handle(async (req, res) => {
  const post = await findPost(
    req.params.id,
    res
  );

  if (!post) return;

  return res.json({
    success: true,
    data: post,
  });
});


// ==========================================
// CREATE BLOG
// POST /api/blogs
// ==========================================

const createPost = handle(async (req, res) => {
  let uploadedId = null;

  try {
    const payload = pickPayload(req.body);

    // Upload cover image
    if (req.file) {
      const cover = await uploadToCloudinary(
        req.file.buffer,
        COVER_FOLDER
      );

      uploadedId = cover.publicId;
      payload.coverImage = cover;
    }

    // Save blog in database
    const post = await Blog.create(payload);

    // Activity Log
    await createAuditLog({
      req,
      module: "blogs",
      action: "create",
      description: `Created blog: ${post.title}`,
      targetId: post._id,
      targetName: post.title,
    });

    return res.status(201).json({
      success: true,
      message: "Article created successfully",
      data: post,
    });

  } catch (error) {
    // Remove uploaded image if database operation fails
    if (uploadedId) {
      await deleteFromCloudinary(uploadedId);
    }

    throw error;
  }
});


// ==========================================
// UPDATE BLOG
// PUT /api/blogs/:id
// ==========================================

const updatePost = handle(async (req, res) => {
  const post = await findPost(
    req.params.id,
    res
  );

  if (!post) return;

  let uploadedId = null;
  let staleId = null;

  try {
    const payload = pickPayload(req.body);

    const updatedFields = Object.keys(payload);

    // Update normal fields
    post.set(payload);

    // Replace or remove cover image
    if (req.file) {
      const cover = await uploadToCloudinary(
        req.file.buffer,
        COVER_FOLDER
      );

      uploadedId = cover.publicId;
      staleId = post.coverImage?.publicId;

      post.coverImage = cover;

    } else if (
      isTrue(req.body.removeCover) &&
      post.coverImage?.publicId
    ) {
      staleId = post.coverImage.publicId;
      post.coverImage = undefined;
    }

    // Save updated blog
    await post.save();

    // Activity Log
    await createAuditLog({
      req,
      module: "blogs",
      action: "update",
      description: `Updated blog: ${post.title}`,
      targetId: post._id,
      targetName: post.title,
      metadata: {
        updatedFields,
        coverImageChanged: Boolean(
          req.file || isTrue(req.body.removeCover)
        ),
      },
    });

    // Delete old image after successful database save
    if (staleId) {
      await deleteFromCloudinary(staleId);
    }

    return res.json({
      success: true,
      message: "Article updated successfully",
      data: post,
    });

  } catch (error) {
    // Remove newly uploaded image if update fails
    if (uploadedId) {
      await deleteFromCloudinary(uploadedId);
    }

    throw error;
  }
});


// ==========================================
// UPDATE BLOG STATUS
// PATCH /api/blogs/:id/status
// ==========================================

const updateStatus = handle(async (req, res) => {
  const { status, publishedAt } = req.body;

  if (!Blog.STATUSES.includes(status)) {
    return fail(
      res,
      400,
      `Status must be one of: ${Blog.STATUSES.join(", ")}`
    );
  }

  const post = await findPost(
    req.params.id,
    res
  );

  if (!post) return;

  const previousStatus = post.status;

  post.status = status;

  if (publishedAt) {
    post.publishedAt = publishedAt;
  }

  // Model validation runs here
  await post.save();

  // Activity Log
  await createAuditLog({
    req,
    module: "blogs",
    action: "status_change",
    description: `Changed blog status: ${post.title} (${previousStatus} → ${status})`,
    targetId: post._id,
    targetName: post.title,
    metadata: {
      previousStatus,
      newStatus: status,
      publishedAt: post.publishedAt,
    },
  });

  return res.json({
    success: true,
    message: `Article is now ${status}`,
    data: {
      _id: post._id,
      status: post.status,
      publishedAt: post.publishedAt,
    },
  });
});


// ==========================================
// TOGGLE FEATURED BLOG
// PATCH /api/blogs/:id/featured
// ==========================================

const toggleFeatured = handle(async (req, res) => {
  const post = await findPost(
    req.params.id,
    res
  );

  if (!post) return;

  post.isFeatured = !post.isFeatured;

  await post.save();

  // Activity Log
  await createAuditLog({
    req,
    module: "blogs",
    action: "update",
    description: `${
      post.isFeatured ? "Featured" : "Unfeatured"
    } blog: ${post.title}`,
    targetId: post._id,
    targetName: post.title,
    metadata: {
      isFeatured: post.isFeatured,
    },
  });

  return res.json({
    success: true,
    message: post.isFeatured
      ? "Article is now featured"
      : "Article is no longer featured",
    data: {
      _id: post._id,
      isFeatured: post.isFeatured,
    },
  });
});


// ==========================================
// DELETE BLOG
// DELETE /api/blogs/:id
// ==========================================

const deletePost = handle(async (req, res) => {
  const post = await findPost(
    req.params.id,
    res
  );

  if (!post) return;

  const coverId = post.coverImage?.publicId;

  // Store details before deleting
  const deletedPostId = post._id;
  const deletedPostTitle = post.title;

  // Delete blog from database
  await post.deleteOne();

  // Activity Log
  await createAuditLog({
    req,
    module: "blogs",
    action: "delete",
    description: `Deleted blog: ${deletedPostTitle}`,
    targetId: deletedPostId,
    targetName: deletedPostTitle,
  });

  // Delete image from Cloudinary
  if (coverId) {
    await deleteFromCloudinary(coverId);
  }

  return res.json({
    success: true,
    message: "Article deleted successfully",
  });
});


// ==========================================
// EXPORT CONTROLLERS
// ==========================================

module.exports = {
  // Public
  getPublishedPosts,
  getCategories,
  getPostBySlug,

  // Admin
  getAllPosts,
  getPostById,
  createPost,
  updatePost,
  updateStatus,
  toggleFeatured,
  deletePost,
};
