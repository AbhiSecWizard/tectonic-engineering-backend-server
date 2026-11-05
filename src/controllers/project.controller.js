
const mongoose = require("mongoose");
const Project = require("../models/project.model");

const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../services/cloudinaryUpload");

const createAuditLog = require("../utils/createAuditLog");


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


// Parse JSON values
const parseValue = (value) => {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};


// Convert value into array
const toArray = (value) => {
  const parsed = parseValue(value);

  if (Array.isArray(parsed)) return parsed;

  if (parsed === undefined || parsed === null || parsed === "") {
    return [];
  }

  return [parsed];
};


// Pick allowed fields from request body
const pickPayload = (body) => {
  const payload = {};

  ALLOWED_FIELDS.forEach((field) => {
    if (body[field] === undefined) return;

    if (ARRAY_FIELDS.includes(field)) {
      payload[field] = toArray(body[field]);
    } else if (NESTED_FIELDS.includes(field)) {
      const parsed = parseValue(body[field]);

      if (parsed && typeof parsed === "object") {
        payload[field] = parsed;
      }
    } else if (field === "showOnWebsite") {
      payload[field] =
        body[field] === true || body[field] === "true";
    } else if (body[field] === "") {
      return;
    } else {
      payload[field] = body[field];
    }
  });

  return payload;
};


// Error Handler
const sendError = (res, error) => {
  if (error.name === "ValidationError") {
    const errors = Object.values(error.errors).map((e) => e.message);

    return res.status(400).json({
      success: false,
      message: errors[0],
      errors,
    });
  }

  if (error.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: `Invalid value for ${error.path}`,
    });
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0] || "field";

    return res.status(409).json({
      success: false,
      message: `A project with this ${field} already exists`,
    });
  }

  console.error(error);

  return res.status(500).json({
    success: false,
    message: error.message || "Server error",
  });
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
  const uploaded = [];

  try {
    const payload = pickPayload(req.body);

    if (req.user?._id) {
      payload.createdBy = req.user._id;
    }

    const coverFile = req.files?.coverImage?.[0];
    const galleryFiles = req.files?.images || [];

    // Upload cover image
    if (coverFile) {
      const cover = await uploadToCloudinary(coverFile.buffer);

      uploaded.push(cover.publicId);
      payload.coverImage = cover;
    }

    // Upload gallery images
    if (galleryFiles.length) {
      const images = await Promise.all(
        galleryFiles.map((file) =>
          uploadToCloudinary(file.buffer)
        )
      );

      images.forEach((img) => uploaded.push(img.publicId));

      payload.images = images;
    }

    // Save project
    const project = await Project.create(payload);

    // ======================================
    // ACTIVITY LOG
    // ======================================

    await createAuditLog({
      req,
      module: "projects",
      action: "create",
      description: `Created project: ${project.name}`,
      targetId: project._id,
      targetName: project.name,
    });

    return res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: project,
    });

  } catch (error) {
    // Rollback uploaded images if save fails
    await Promise.all(uploaded.map(deleteFromCloudinary));

    sendError(res, error);
  }
};


// =========================
// READ ALL (ADMIN)
// GET /api/projects
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
      filter.showOnWebsite = showOnWebsite === "true";
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
// READ ALL (PUBLIC WEBSITE)
// GET /api/projects/website
// =========================

const getWebsiteProjects = async (req, res) => {
  try {
    const {
      category,
      page = 1,
      limit = 12,
    } = req.query;

    const filter = {
      showOnWebsite: true,
    };

    if (category) {
      filter.category = category;
    }

    const pageNum = Math.max(
      parseInt(page, 10) || 1,
      1
    );

    const limitNum = Math.min(
      Math.max(parseInt(limit, 10) || 12, 1),
      50
    );

    // Only expose public-safe fields
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

    return res.json({
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

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
    }

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
// =========================

const updateProject = async (req, res) => {
  const uploaded = [];

  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
    }

    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const payload = pickPayload(req.body);
    const oldPublicIdsToDelete = [];

    // Apply simple and array fields
    Object.entries(payload).forEach(([key, value]) => {
      if (NESTED_FIELDS.includes(key)) {
        Object.entries(value).forEach(([subKey, subValue]) => {
          project.set(`${key}.${subKey}`, subValue);
        });
      } else {
        project.set(key, value);
      }
    });

    // Cover image
    const coverFile = req.files?.coverImage?.[0];

    const removeCover =
      req.body.removeCover === true ||
      req.body.removeCover === "true";

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

    // Remove gallery images
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

    // Add gallery images
    const galleryFiles = req.files?.images || [];

    if (galleryFiles.length) {
      const newImages = await Promise.all(
        galleryFiles.map((file) =>
          uploadToCloudinary(file.buffer)
        )
      );

      newImages.forEach((img) => uploaded.push(img.publicId));

      project.images.push(...newImages);
    }

    // Save updated project
    await project.save();

    // Delete old images after successful save
    await Promise.all(
      oldPublicIdsToDelete.map(deleteFromCloudinary)
    );

    // ======================================
    // ACTIVITY LOG
    // ======================================

    await createAuditLog({
      req,
      module: "projects",
      action: "update",
      description: `Updated project: ${project.name}`,
      targetId: project._id,
      targetName: project.name,
      metadata: {
        updatedFields: Object.keys(payload),
        coverImageChanged: Boolean(coverFile || removeCover),
        galleryImagesAdded: galleryFiles.length,
        galleryImagesRemoved: removeImages.length,
      },
    });

    return res.json({
      success: true,
      message: "Project updated successfully",
      data: project,
    });

  } catch (error) {
    // Rollback newly uploaded images if update fails
    await Promise.all(uploaded.map(deleteFromCloudinary));

    sendError(res, error);
  }
};


// =========================
// TOGGLE WEBSITE VISIBILITY
// PATCH /api/projects/:id/visibility
// =========================

const toggleWebsiteVisibility = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
    }

    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Toggle visibility
    project.showOnWebsite = !project.showOnWebsite;

    await project.save();

    // ======================================
    // ACTIVITY LOG
    // ======================================

    await createAuditLog({
      req,
      module: "projects",
      action: "update",
      description: `Changed website visibility of project: ${project.name}`,
      targetId: project._id,
      targetName: project.name,
      metadata: {
        showOnWebsite: project.showOnWebsite,
      },
    });

    return res.json({
      success: true,
      message: `Project ${
        project.showOnWebsite
          ? "is now visible on"
          : "hidden from"
      } the website`,
      data: {
        _id: project._id,
        showOnWebsite: project.showOnWebsite,
      },
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
      return res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
    }

    const project = await Project.findById(id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Collect Cloudinary image IDs
    const publicIds = [
      project.coverImage?.publicId,
      ...project.images.map((img) => img.publicId),
    ].filter(Boolean);

    // Store details before deleting
    const deletedProjectId = project._id;
    const deletedProjectName = project.name;

    // Delete project from database
    await project.deleteOne();

    // Activity Log
    await createAuditLog({
      req,
      module: "projects",
      action: "delete",
      description: `Deleted project: ${deletedProjectName}`,
      targetId: deletedProjectId,
      targetName: deletedProjectName,
    });

    // Delete images from Cloudinary
    await Promise.all(
      publicIds.map(deleteFromCloudinary)
    );

    return res.json({
      success: true,
      message: "Project deleted successfully",
    });

  } catch (error) {
    sendError(res, error);
  }
};


// =========================
// EXPORTS
// =========================

module.exports = {
  createProject,
  getProjects,
  getWebsiteProjects,
  getProjectById,
  updateProject,
  toggleWebsiteVisibility,
  deleteProject,
};
