
const mongoose = require("mongoose");

const Client = require("../models/client.model");
const Project = require("../models/project.model");

const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../services/cloudinaryUpload");

const createAuditLog = require("../utils/createAuditLog");


// =====================================================
// CONFIGURATION
// =====================================================

const CLIENT_LOGO_FOLDER = "tectonic/clients";


// =====================================================
// HELPER FUNCTIONS
// =====================================================

// Parse JSON fields coming from FormData
const parseJSONField = (value, fieldName) => {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`Invalid JSON format for ${fieldName}`);
  }
};


// Convert FormData into usable client data
const parseClientData = (body) => {
  const data = { ...body };

  const jsonFields = [
    "location",
    "contacts",
    "work",
  ];

  jsonFields.forEach((field) => {
    if (data[field] !== undefined) {
      data[field] = parseJSONField(
        data[field],
        field
      );
    }
  });

  // Boolean conversion
  if (data.showOnWebsite !== undefined) {
    data.showOnWebsite =
      data.showOnWebsite === true ||
      data.showOnWebsite === "true";
  }

  // Number conversion
  if (data.displayOrder !== undefined) {
    data.displayOrder = Number(data.displayOrder);

    if (!Number.isFinite(data.displayOrder)) {
      throw new Error("Invalid displayOrder value");
    }
  }

  return data;
};


// Validate MongoDB ObjectId
const isValidId = (id) => {
  return mongoose.isValidObjectId(id);
};


// Common API error response
const sendError = (res, error) => {
  console.error("Client Controller Error:", error);

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
    return res.status(400).json({
      success: false,
      message: `Invalid value for ${error.path}`,
    });
  }

  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "Client with this name already exists",
    });
  }

  const statusCode =
    error.message?.startsWith("Invalid JSON") ||
    error.message?.startsWith("Invalid displayOrder")
      ? 400
      : 500;

  const message =
    process.env.NODE_ENV === "production" &&
    statusCode === 500
      ? "Server error"
      : error.message;

  return res.status(statusCode).json({
    success: false,
    message: message || "Server error",
  });
};


// Cloudinary cleanup without breaking the main operation
const safelyDeleteImage = async (publicId) => {
  if (!publicId) return;

  try {
    await deleteFromCloudinary(publicId);
  } catch (error) {
    console.error(
      "Cloudinary cleanup error:",
      error.message
    );
  }
};


// =====================================================
// CREATE CLIENT
// POST /api/clients
// =====================================================

const createClient = async (req, res) => {
  let uploadedLogo = null;

  try {
    const data = parseClientData(req.body);

    // Upload logo to Cloudinary
    if (req.file) {
      uploadedLogo = await uploadToCloudinary(
        req.file.buffer,
        CLIENT_LOGO_FOLDER
      );

      data.logo = uploadedLogo;
    }

    // Create client in MongoDB
    const client = await Client.create(data);

    // Activity Log
    await createAuditLog({
      req,
      module: "clients",
      action: "create",
      description: `Created client: ${client.name}`,
      targetId: client._id,
      targetName: client.name,
    });

    return res.status(201).json({
      success: true,
      message: "Client created successfully",
      data: client,
    });

  } catch (error) {
    // Rollback uploaded image if database operation fails
    if (uploadedLogo?.publicId) {
      await safelyDeleteImage(uploadedLogo.publicId);
    }

    return sendError(res, error);
  }
};


// =====================================================
// GET ALL CLIENTS
// GET /api/clients
// =====================================================

const getClients = async (req, res) => {
  try {
    const {
      sector,
      status,
      search,
      showOnWebsite,
    } = req.query;

    const filter = {};

    // Sector filter
    if (sector) {
      filter.sector = sector;
    }

    // Status filter
    if (status) {
      filter.status = status;
    }

    // Website visibility filter
    if (showOnWebsite !== undefined) {
      filter.showOnWebsite =
        showOnWebsite === "true";
    }

    // Search by client name or short name
    if (search) {
      filter.$or = [
        {
          name: {
            $regex: search,
            $options: "i",
          },
        },
        {
          shortName: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    const clients = await Client.find(filter)
      .sort({
        displayOrder: 1,
        createdAt: -1,
      })
      .populate("projectCount");

    return res.status(200).json({
      success: true,
      count: clients.length,
      data: clients,
    });

  } catch (error) {
    return sendError(res, error);
  }
};


// =====================================================
// GET SINGLE CLIENT
// GET /api/clients/:id
// =====================================================

const getClientById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid client ID",
      });
    }

    const client = await Client.findById(id)
      .populate("projectCount")
      .populate("projects");

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: client,
    });

  } catch (error) {
    return sendError(res, error);
  }
};


// =====================================================
// GET WEBSITE CLIENTS
// GET /api/clients/website
// =====================================================

const getWebsiteClients = async (req, res) => {
  try {
    const clients = await Client.find({
      showOnWebsite: true,
      status: "active",
    })
      .select(
        "name shortName sector logo website work scope displayOrder"
      )
      .sort({
        displayOrder: 1,
        name: 1,
      })
      .lean();

    // Group clients according to sector
    const groupedClients = {
      government: [],
      private: [],
      international: [],
    };

    clients.forEach((client) => {
      if (groupedClients[client.sector]) {
        groupedClients[client.sector].push(client);
      }
    });

    return res.status(200).json({
      success: true,
      data: groupedClients,
    });

  } catch (error) {
    return sendError(res, error);
  }
};


// =====================================================
// UPDATE CLIENT
// PUT /api/clients/:id
// =====================================================

const updateClient = async (req, res) => {
  let newLogo = null;

  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid client ID",
      });
    }

    const client = await Client.findById(id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    const data = parseClientData(req.body);

    const updatedFields = Object.keys(data);

    const oldLogoPublicId =
      client.logo?.publicId;

    // Upload replacement logo
    if (req.file) {
      newLogo = await uploadToCloudinary(
        req.file.buffer,
        CLIENT_LOGO_FOLDER
      );

      data.logo = newLogo;
    }

    // Update client fields
    Object.assign(client, data);

    // Save updated client
    await client.save();

    // Activity Log
    await createAuditLog({
      req,
      module: "clients",
      action: "update",
      description: `Updated client: ${client.name}`,
      targetId: client._id,
      targetName: client.name,
      metadata: {
        updatedFields,
        logoChanged: Boolean(req.file),
      },
    });

    // Delete old logo only after successful database save
    if (req.file && oldLogoPublicId) {
      await safelyDeleteImage(oldLogoPublicId);
    }

    return res.status(200).json({
      success: true,
      message: "Client updated successfully",
      data: client,
    });

  } catch (error) {
    // Remove newly uploaded image if update fails
    if (newLogo?.publicId) {
      await safelyDeleteImage(newLogo.publicId);
    }

    return sendError(res, error);
  }
};


// =====================================================
// DELETE CLIENT
// DELETE /api/clients/:id
// =====================================================

const deleteClient = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid client ID",
      });
    }

    const client = await Client.findById(id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    // Check whether this client has associated projects
    const projectCount = await Project.countDocuments({
      client: client._id,
    });

    if (projectCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete client because it has ${projectCount} project(s)`,
      });
    }

    const logoPublicId = client.logo?.publicId;

    // Store details before deleting
    const deletedClientId = client._id;
    const deletedClientName = client.name;

    // Delete client from database
    await client.deleteOne();

    // Activity Log
    await createAuditLog({
      req,
      module: "clients",
      action: "delete",
      description: `Deleted client: ${deletedClientName}`,
      targetId: deletedClientId,
      targetName: deletedClientName,
    });

    // Delete logo from Cloudinary
    if (logoPublicId) {
      await safelyDeleteImage(logoPublicId);
    }

    return res.status(200).json({
      success: true,
      message: "Client deleted successfully",
    });

  } catch (error) {
    return sendError(res, error);
  }
};


// =====================================================
// EXPORT CONTROLLERS
// =====================================================

module.exports = {
  createClient,
  getClients,
  getClientById,
  getWebsiteClients,
  updateClient,
  deleteClient,
};
