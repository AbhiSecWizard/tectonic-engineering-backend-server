
const mongoose = require("mongoose");
const Team = require("../models/team.model");

const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../services/cloudinaryUpload");

const createAuditLog = require("../utils/createAuditLog");

const TEAM_FOLDER = "team";


// ==========================================
// HELPER FUNCTIONS
// ==========================================

// Validate MongoDB ObjectId
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);


// Safely delete image from Cloudinary
const safelyDeleteImage = async (publicId) => {
  if (!publicId) return;

  try {
    await deleteFromCloudinary(publicId);
  } catch (error) {
    console.error("Cloudinary Image Delete Error:", error.message);
  }
};


// ==========================================
// 1. CREATE TEAM MEMBER
// POST /api/team
// ==========================================

const createTeamMember = async (req, res) => {
  let uploadedImage;

  try {
    const {
      name,
      workEmail,
      designation,
      education,
      note,
    } = req.body;

    // Validate required fields
    if (
      !name?.trim() ||
      !workEmail?.trim() ||
      !designation?.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, work email and designation are required.",
      });
    }

    // Validate photo
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Team member photo is required.",
      });
    }

    const normalizedEmail = workEmail.trim().toLowerCase();

    // Check duplicate email
    const existingMember = await Team.findOne({
      workEmail: normalizedEmail,
    });

    if (existingMember) {
      return res.status(409).json({
        success: false,
        message: "A team member with this email already exists.",
      });
    }

    // Upload image
    uploadedImage = await uploadToCloudinary(
      req.file.buffer,
      TEAM_FOLDER
    );

    // Create team member
    const teamMember = await Team.create({
      photo: uploadedImage,
      name: name.trim(),
      workEmail: normalizedEmail,
      designation: designation.trim(),
      education: education?.trim() || "",
      note: note?.trim() || "",
    });

    // Activity log
    await createAuditLog({
      req,
      module: "team",
      action: "create",
      description: `Created team member: ${teamMember.name}`,
      targetId: teamMember._id,
      targetName: teamMember.name,
    });

    return res.status(201).json({
      success: true,
      message: "Team member created successfully.",
      data: teamMember,
    });

  } catch (error) {
    console.error("Create Team Member Error:", error);

    // Cleanup uploaded image if database creation fails
    if (uploadedImage?.publicId) {
      await safelyDeleteImage(uploadedImage.publicId);
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Work email already exists.",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create team member.",
    });
  }
};


// ==========================================
// 2. GET ALL TEAM MEMBERS
// GET /api/team
// ==========================================

const getTeamMembers = async (req, res) => {
  try {
    const teamMembers = await Team.find().sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: teamMembers.length,
      data: teamMembers,
    });

  } catch (error) {
    console.error("Get Team Members Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch team members.",
    });
  }
};


// ==========================================
// 3. GET TEAM MEMBER BY ID
// GET /api/team/:id
// ==========================================

const getTeamMemberById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team member ID.",
      });
    }

    const teamMember = await Team.findById(id);

    if (!teamMember) {
      return res.status(404).json({
        success: false,
        message: "Team member not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: teamMember,
    });

  } catch (error) {
    console.error("Get Team Member By ID Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch team member.",
    });
  }
};


// ==========================================
// 4. UPDATE TEAM MEMBER
// PUT /api/team/:id
// ==========================================

const updateTeamMember = async (req, res) => {
  let newUploadedImage;

  try {
    const { id } = req.params;

    const {
      name,
      workEmail,
      designation,
      education,
      note,
    } = req.body;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team member ID.",
      });
    }

    const teamMember = await Team.findById(id);

    if (!teamMember) {
      return res.status(404).json({
        success: false,
        message: "Team member not found.",
      });
    }

    // Update name
    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Name cannot be empty.",
        });
      }

      teamMember.name = name.trim();
    }

    // Update work email
    if (workEmail !== undefined) {
      if (
        typeof workEmail !== "string" ||
        !workEmail.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Work email cannot be empty.",
        });
      }

      const normalizedEmail = workEmail.trim().toLowerCase();

      const existingMember = await Team.findOne({
        workEmail: normalizedEmail,
        _id: { $ne: teamMember._id },
      });

      if (existingMember) {
        return res.status(409).json({
          success: false,
          message: "This work email is already in use.",
        });
      }

      teamMember.workEmail = normalizedEmail;
    }

    // Update designation
    if (designation !== undefined) {
      if (
        typeof designation !== "string" ||
        !designation.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Designation cannot be empty.",
        });
      }

      teamMember.designation = designation.trim();
    }

    // Update education
    if (education !== undefined) {
      teamMember.education =
        typeof education === "string" ? education.trim() : "";
    }

    // Update note
    if (note !== undefined) {
      teamMember.note =
        typeof note === "string" ? note.trim() : "";
    }

    // Store old image details
    const oldPublicId = teamMember.photo?.publicId;

    // Upload replacement image if provided
    if (req.file) {
      newUploadedImage = await uploadToCloudinary(
        req.file.buffer,
        TEAM_FOLDER
      );

      teamMember.photo = newUploadedImage;
    }

    // Save updated document
    await teamMember.save();

    // Activity log
    await createAuditLog({
      req,
      module: "team",
      action: "update",
      description: `Updated team member: ${teamMember.name}`,
      targetId: teamMember._id,
      targetName: teamMember.name,
      metadata: {
        imageChanged: Boolean(newUploadedImage),
      },
    });

    // Delete old image only after successful database update
    if (newUploadedImage && oldPublicId) {
      await safelyDeleteImage(oldPublicId);
    }

    return res.status(200).json({
      success: true,
      message: "Team member updated successfully.",
      data: teamMember,
    });

  } catch (error) {
    console.error("Update Team Member Error:", error);

    // Remove newly uploaded image if update fails
    if (newUploadedImage?.publicId) {
      await safelyDeleteImage(newUploadedImage.publicId);
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Work email already exists.",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update team member.",
    });
  }
};


// ==========================================
// 5. DELETE TEAM MEMBER
// DELETE /api/team/:id
// ==========================================

const deleteTeamMember = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team member ID.",
      });
    }

    const teamMember = await Team.findById(id);

    if (!teamMember) {
      return res.status(404).json({
        success: false,
        message: "Team member not found.",
      });
    }

    const deletedMemberId = teamMember._id;
    const deletedMemberName = teamMember.name;
    const imagePublicId = teamMember.photo?.publicId;

    // Delete MongoDB document first
    await Team.findByIdAndDelete(id);

    // Activity log
    await createAuditLog({
      req,
      module: "team",
      action: "delete",
      description: `Deleted team member: ${deletedMemberName}`,
      targetId: deletedMemberId,
      targetName: deletedMemberName,
    });

    // Cleanup Cloudinary image
    await safelyDeleteImage(imagePublicId);

    return res.status(200).json({
      success: true,
      message: "Team member deleted successfully.",
    });

  } catch (error) {
    console.error("Delete Team Member Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete team member.",
    });
  }
};


// ==========================================
// EXPORT CONTROLLERS
// ==========================================

module.exports = {
  createTeamMember,
  getTeamMembers,
  getTeamMemberById,
  updateTeamMember,
  deleteTeamMember,
};
