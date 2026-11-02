const Team = require("../models/team.model");

const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../services/cloudinaryUpload");


// 1. CREATE TEAM MEMBER
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
    if (!name?.trim() || !workEmail?.trim() || !designation?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Name, work email and designation are required",
      });
    }

    // Validate photo
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Team member photo is required",
      });
    }

    // Check duplicate email
    const existingMember = await Team.findOne({
      workEmail: workEmail.trim().toLowerCase(),
    });

    if (existingMember) {
      return res.status(409).json({
        success: false,
        message: "A team member with this email already exists",
      });
    }

    // Upload photo to Cloudinary
    uploadedImage = await uploadToCloudinary(
      req.file.buffer,
      "team"
    );

    // Create team member
    const teamMember = await Team.create({
      photo: uploadedImage,
      name: name.trim(),
      workEmail: workEmail.trim().toLowerCase(),
      designation: designation.trim(),
      education: education?.trim() || "",
      note: note?.trim() || "",
    });

    return res.status(201).json({
      success: true,
      message: "Team member created successfully",
      data: teamMember,
    });

  } catch (error) {
    console.error("Create Team Member Error:", error);

    // Clean up uploaded image if database creation fails
    if (uploadedImage?.publicId) {
      await deleteFromCloudinary(uploadedImage.publicId);
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Work email already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create team member",
    });
  }
};


// 2. GET ALL TEAM MEMBERS
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
      message: "Failed to fetch team members",
    });
  }
};


// 3. GET TEAM MEMBER BY ID
const getTeamMemberById = async (req, res) => {
  try {
    const teamMember = await Team.findById(req.params.id);

    if (!teamMember) {
      return res.status(404).json({
        success: false,
        message: "Team member not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: teamMember,
    });

  } catch (error) {
    console.error("Get Team Member By ID Error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid team member ID",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to fetch team member",
    });
  }
};


// 4. UPDATE TEAM MEMBER
const updateTeamMember = async (req, res) => {
  let newUploadedImage;

  try {
    const {
      name,
      workEmail,
      designation,
      education,
      note,
    } = req.body;

    const teamMember = await Team.findById(req.params.id);

    if (!teamMember) {
      return res.status(404).json({
        success: false,
        message: "Team member not found",
      });
    }

    // Update text fields only when provided
    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Name cannot be empty",
        });
      }
      teamMember.name = name.trim();
    }

    if (workEmail !== undefined) {
      if (!workEmail.trim()) {
        return res.status(400).json({
          success: false,
          message: "Work email cannot be empty",
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
          message: "This work email is already in use",
        });
      }

      teamMember.workEmail = normalizedEmail;
    }

    if (designation !== undefined) {
      if (!designation.trim()) {
        return res.status(400).json({
          success: false,
          message: "Designation cannot be empty",
        });
      }
      teamMember.designation = designation.trim();
    }

    if (education !== undefined) {
      teamMember.education = education.trim();
    }

    if (note !== undefined) {
      teamMember.note = note.trim();
    }

    // Replace photo if a new one is uploaded
    const oldPublicId = teamMember.photo.publicId;

    if (req.file) {
      newUploadedImage = await uploadToCloudinary(
        req.file.buffer,
        "team"
      );

      teamMember.photo = newUploadedImage;
    }

    // Save updated member
    await teamMember.save();

    // Delete old image only after successful database update
    if (newUploadedImage && oldPublicId) {
      await deleteFromCloudinary(oldPublicId);
    }

    return res.status(200).json({
      success: true,
      message: "Team member updated successfully",
      data: teamMember,
    });

  } catch (error) {
    console.error("Update Team Member Error:", error);

    // Clean up newly uploaded image if update fails
    if (newUploadedImage?.publicId) {
      await deleteFromCloudinary(newUploadedImage.publicId);
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Work email already exists",
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid team member ID",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update team member",
    });
  }
};


// 5. DELETE TEAM MEMBER
const deleteTeamMember = async (req, res) => {
  try {
    const teamMember = await Team.findById(req.params.id);

    if (!teamMember) {
      return res.status(404).json({
        success: false,
        message: "Team member not found",
      });
    }

    // Delete photo from Cloudinary
    await deleteFromCloudinary(teamMember.photo.publicId);

    // Delete team member from MongoDB
    await Team.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Team member deleted successfully",
    });

  } catch (error) {
    console.error("Delete Team Member Error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid team member ID",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to delete team member",
    });
  }
};


module.exports = {
  createTeamMember,
  getTeamMembers,
  getTeamMemberById,
  updateTeamMember,
  deleteTeamMember,
};
