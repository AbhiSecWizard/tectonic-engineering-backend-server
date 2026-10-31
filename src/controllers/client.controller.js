const mongoose = require("mongoose");

const Client = require("../models/client.model");

const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../services/cloudinaryUpload");


// =====================================================
// Helper - Parse FormData
// =====================================================

const parseClientData = (body) => {
  const data = { ...body };

  // Objects / arrays FormData me string banke aate hain

  if (typeof data.location === "string") {
    data.location = JSON.parse(data.location);
  }

  if (typeof data.contacts === "string") {
    data.contacts = JSON.parse(data.contacts);
  }

  if (typeof data.work === "string") {
    data.work = JSON.parse(data.work);
  }

  // Boolean conversion
  if (data.showOnWebsite !== undefined) {
    data.showOnWebsite =
      data.showOnWebsite === true ||
      data.showOnWebsite === "true";
  }

  // Number conversion
  if (data.displayOrder !== undefined) {
    data.displayOrder = Number(data.displayOrder);
  }

  return data;
};


// =====================================================
// CREATE CLIENT
// POST /api/clients
// =====================================================

const createClient = async (req, res) => {
  let uploadedLogo = null;

  try {
    const data = parseClientData(req.body);

    // Upload logo
    if (req.file) {
      uploadedLogo = await uploadToCloudinary(
        req.file.buffer,
        "tectonic/clients"
      );

      data.logo = uploadedLogo;
    }

    const client = await Client.create(data);

    return res.status(201).json({
      success: true,
      message: "Client created successfully",
      data: client,
    });
  } catch (error) {

    // DB save fail hua but image upload ho chuki thi
    if (uploadedLogo?.publicId) {
      await deleteFromCloudinary(uploadedLogo.publicId);
    }

    console.error("Create client error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Client with this name already exists",
      });
    }

    return res.status(400).json({
      success: false,
      message: error.message,
    });
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


    // Website filter
    if (showOnWebsite !== undefined) {
      filter.showOnWebsite =
        showOnWebsite === "true";
    }


    // Search
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

    console.error("Get clients error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// =====================================================
// GET SINGLE CLIENT
// GET /api/clients/:id
// =====================================================

const getClientById = async (req, res) => {
  try {

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid client id",
      });
    }


    const client = await Client.findById(req.params.id)
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

    console.error("Get client error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// =====================================================
// WEBSITE CLIENTS
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

    console.error("Website clients error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// =====================================================
// UPDATE CLIENT
// PUT /api/clients/:id
// =====================================================

const updateClient = async (req, res) => {
  let newLogo = null;

  try {

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid client id",
      });
    }


    const client = await Client.findById(req.params.id);


    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }


    const data = parseClientData(req.body);

    const oldLogoPublicId =
      client.logo?.publicId;


    // ========================
    // New logo received
    // ========================

    if (req.file) {

      newLogo = await uploadToCloudinary(
        req.file.buffer,
        "tectonic/clients"
      );

      data.logo = newLogo;
    }


    // ========================
    // Update client
    // ========================

    Object.assign(client, data);

    await client.save();


    // ========================
    // Delete old logo
    // ========================

    if (
      req.file &&
      oldLogoPublicId
    ) {
      await deleteFromCloudinary(
        oldLogoPublicId
      );
    }


    return res.status(200).json({
      success: true,
      message: "Client updated successfully",
      data: client,
    });

  } catch (error) {

    // New image upload ho gayi but DB update fail hua
    if (newLogo?.publicId) {
      await deleteFromCloudinary(
        newLogo.publicId
      );
    }


    console.error("Update client error:", error);


    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Client with this name already exists",
      });
    }


    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


// =====================================================
// DELETE CLIENT
// DELETE /api/clients/:id
// =====================================================

const deleteClient = async (req, res) => {
  try {

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid client id",
      });
    }


    const client = await Client.findById(
      req.params.id
    );


    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }


    // Check client projects
    if (mongoose.models.Project) {

      const projectCount =
        await mongoose.models.Project.countDocuments({
          client: client._id,
        });


      if (projectCount > 0) {

        return res.status(409).json({
          success: false,

          message:
            `Cannot delete client because it has ${projectCount} project(s)`,
        });

      }
    }


    const logoPublicId =
      client.logo?.publicId;


    // Delete from database
    await client.deleteOne();


    // Delete logo from Cloudinary
    if (logoPublicId) {
      await deleteFromCloudinary(
        logoPublicId
      );
    }


    return res.status(200).json({
      success: true,
      message: "Client deleted successfully",
    });

  } catch (error) {

    console.error("Delete client error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// =====================================================
// EXPORT
// =====================================================

module.exports = {
  createClient,
  getClients,
  getClientById,
  getWebsiteClients,
  updateClient,
  deleteClient,
};