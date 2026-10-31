const mongoose = require("mongoose");
const Project = require("../models/project.model"); // adjust path to your model
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../services/cloudinaryUpload");

// =========================
// Helpers
// =========================

// Fields the client is allowed to set
const ALLOWED_FIELDS = [
  "code",
  "name",
  "client",
  "category",
  "structureType",
  "services",
  "description",
  "location",
  "specs",
  "status",
  "startDate",
  "expectedEndDate",
  "completedDate",
  "contractValue",
  "currency",
  "contactPerson",
  "leadEngineer",
  "team",
  "softwareUsed",
  "showOnWebsite",
  "notes",
];

const NESTED_FIELDS = ["location", "specs", "contactPerson"];
const ARRAY_FIELDS = ["services", "team", "softwareUsed"];

// multipart/form-data sends everything as strings, so try to JSON-parse
const parseValue = (value) => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const toArray = (value) => {
  const parsed = parseValue(value);
  if (Array.isArray(parsed)) return parsed;
  if (parsed === undefined || parsed === null || parsed === "") return [];
  return [parsed];
};

// Pull only allowed fields from req.body and normalise their types
const pickPayload = (body) => {
  const payload = {};

  ALLOWED_FIELDS.forEach((field) => {
    if (body[field] === undefined) return;

    if (ARRAY_FIELDS.includes(field)) {
      payload[field] = toArray(body[field]);
    } else if (NESTED_FIELDS.includes(field)) {
      const parsed = parseValue(body[field]);
      if (parsed && typeof parsed === "object") payload[field] = parsed;
    } else if (field === "showOnWebsite") {
      payload[field] = body[field] === true || body[field] === "true";
    } else if (body[field] === "") {
      // empty string -> leave unset (avoids ObjectId / Date / enum cast errors)
      return;
    } else {
      payload[field] = body[field];
    }
  });

  return payload;
};

const sendError = (res, error) => {
  if (error.name === "ValidationError") {
    const errors = Object.values(error.errors).map((e) => e.message);
    return res.status(400).json({ success: false, message: errors[0], errors });
  }

  if (error.name === "CastError") {
    return res
      .status(400)
      .json({ success: false, message: `Invalid value for ${error.path}` });
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0] || "field";
    return res
      .status(409)
      .json({ success: false, message: `A project with this ${field} already exists` });
  }

  console.error(error);
  return res
    .status(500)
    .json({ success: false, message: error.message || "Server error" });
};

const populateProject = (query) =>
  query
    .populate("client", "name")
    .populate("leadEngineer", "name email")
    .populate("team", "name email")
    .populate("createdBy", "name email");

// =========================
// CREATE
// POST /api/projects
// =========================

const createProject = async (req, res) => {
  const uploaded = []; // track uploads so we can roll back if save fails

  try {
    const payload = pickPayload(req.body);

    if (req.user?._id) payload.createdBy = req.user._id;

    const coverFile = req.files?.coverImage?.[0];
    const galleryFiles = req.files?.images || [];

    if (coverFile) {
      const cover = await uploadToCloudinary(coverFile.buffer);
      uploaded.push(cover.publicId);
      payload.coverImage = cover;
    }

    if (galleryFiles.length) {
      const images = await Promise.all(
        galleryFiles.map((file) => uploadToCloudinary(file.buffer))
      );
      images.forEach((img) => uploaded.push(img.publicId));
      payload.images = images;
    }

    const project = await Project.create(payload);

    res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: project,
    });
  } catch (error) {
    // roll back any images already uploaded
    await Promise.all(uploaded.map(deleteFromCloudinary));
    sendError(res, error);
  }
};

// =========================
// READ ALL (admin, with filters)
// GET /api/projects
// Query: page, limit, search, status, category, structureType, client,
//        leadEngineer, showOnWebsite, service, sort
// =========================

const getProjects = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      category,
      structureType,
      client,
      showOnWebsite,
      service,
      sort = "-createdAt",
    } = req.query;

    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (category) {
      filter.category = category;
    }

    if (structureType) {
      filter.structureType = structureType;
    }

    if (service) {
      filter.services = service;
    }

    if (client) {
      filter.client = {
        $regex: client,
        $options: "i",
      };
    }

    if (showOnWebsite !== undefined) {
      filter.showOnWebsite =
        showOnWebsite === "true";
    }

    if (search) {
      filter.$text = {
        $search: search,
      };
    }

    const pageNum = Math.max(
      parseInt(page, 10) || 1,
      1
    );

    const limitNum = Math.min(
      Math.max(parseInt(limit, 10) || 10, 1),
      100
    );

    const [projects, total] = await Promise.all([
      Project.find(filter)
        .sort(sort)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),

      Project.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: projects.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      data: projects,
    });

  } catch (error) {
    sendError(res, error);
  }
};
// =========================
// READ ALL (public website)
// GET /api/projects/website
// Query: category, page, limit
// =========================

const getWebsiteProjects = async (req, res) => {
  try {
    const { category, page = 1, limit = 12 } = req.query;

    const filter = { showOnWebsite: true };
    if (category) filter.category = category;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 50);

    // Only expose fields safe for the public (no financials / contacts / notes)
    const [projects, total] = await Promise.all([
      Project.find(filter)
        .select(
          "name category structureType services description location specs status coverImage images createdAt"
        )
        .sort("-createdAt")
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum),
      Project.countDocuments(filter),
    ]);

    res.json({
      success: true,
      count: projects.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      data: projects,
    });
  } catch (error) {
    sendError(res, error);
  }
};

// =========================
// READ ONE
// GET /api/projects/:id
// =========================

const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;

    // Check valid MongoDB ObjectId
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
    }

    // Find project directly
    // NO populate()
    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: project,
    });
  } catch (error) {
    console.error("Get Project By ID Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

// =========================
// UPDATE
// PUT /api/projects/:id
// Extra body fields:
//   removeImages  -> array (or JSON string) of publicIds to delete from gallery
//   removeCover   -> "true" to delete the current cover image
// Files: coverImage (replaces cover), images (appended to gallery)
// =========================

const updateProject = async (req, res) => {
  const uploaded = [];

  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid project ID" });
    }

    // findById + save() so the pre("save") / pre("validate") hooks run
    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const payload = pickPayload(req.body);
    const oldPublicIdsToDelete = [];

    // Apply simple + array fields
    Object.entries(payload).forEach(([key, value]) => {
      if (NESTED_FIELDS.includes(key)) {
        // merge nested objects instead of wiping untouched keys
        Object.entries(value).forEach(([subKey, subValue]) => {
          project.set(`${key}.${subKey}`, subValue);
        });
      } else {
        project.set(key, value);
      }
    });

    // ---- Cover image ----
    const coverFile = req.files?.coverImage?.[0];
    const removeCover = req.body.removeCover === true || req.body.removeCover === "true";

    if (coverFile) {
      const cover = await uploadToCloudinary(coverFile.buffer);
      uploaded.push(cover.publicId);
      if (project.coverImage?.publicId) {
        oldPublicIdsToDelete.push(project.coverImage.publicId);
      }
      project.coverImage = cover;
    } else if (removeCover && project.coverImage?.publicId) {
      oldPublicIdsToDelete.push(project.coverImage.publicId);
      project.coverImage = undefined;
    }

    // ---- Gallery: remove ----
    const removeImages = toArray(req.body.removeImages);
    if (removeImages.length) {
      project.images = project.images.filter((img) => {
        if (removeImages.includes(img.publicId)) {
          oldPublicIdsToDelete.push(img.publicId);
          return false;
        }
        return true;
      });
    }

    // ---- Gallery: add ----
    const galleryFiles = req.files?.images || [];
    if (galleryFiles.length) {
      const newImages = await Promise.all(
        galleryFiles.map((file) => uploadToCloudinary(file.buffer))
      );
      newImages.forEach((img) => uploaded.push(img.publicId));
      project.images.push(...newImages);
    }

    await project.save();

    // Only delete old images after the DB save succeeded
    await Promise.all(oldPublicIdsToDelete.map(deleteFromCloudinary));

    res.json({
      success: true,
      message: "Project updated successfully",
      data: project,
    });
  } catch (error) {
    // roll back newly uploaded images if the update failed
    await Promise.all(uploaded.map(deleteFromCloudinary));
    sendError(res, error);
  }
};

// =========================
// TOGGLE WEBSITE VISIBILITY
// PATCH /api/projects/:id/website
// =========================

const toggleWebsiteVisibility = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid project ID" });
    }

    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    project.showOnWebsite = !project.showOnWebsite;
    await project.save();

    res.json({
      success: true,
      message: `Project ${project.showOnWebsite ? "is now visible on" : "hidden from"} the website`,
      data: { _id: project._id, showOnWebsite: project.showOnWebsite },
    });
  } catch (error) {
    sendError(res, error);
  }
};

// =========================
// DELETE
// DELETE /api/projects/:id
// =========================

const deleteProject = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: "Invalid project ID" });
    }

    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    // Collect every Cloudinary image tied to this project
    const publicIds = [
      project.coverImage?.publicId,
      ...project.images.map((img) => img.publicId),
    ].filter(Boolean);

    await project.deleteOne();
    await Promise.all(publicIds.map(deleteFromCloudinary));

    res.json({ success: true, message: "Project deleted successfully" });
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = {
  createProject,
  getProjects,
  getWebsiteProjects,
  getProjectById,
  updateProject,
  toggleWebsiteVisibility,
  deleteProject,
};