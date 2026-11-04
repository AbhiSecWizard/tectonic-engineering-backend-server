const express = require("express");

const {
  createClient,
  getClients,
  getClientById,
  getWebsiteClients,
  updateClient,
  deleteClient,
} = require("../controllers/client.controller");

const { upload } = require("../middlewares/upload");
const authentication = require("../middlewares/authentication");

const router = express.Router();


// ==========================================
// PUBLIC ROUTES
// ==========================================

// Website Clients
// GET /api/clients/website
router.get(
  "/website",
  getWebsiteClients
);


// ==========================================
// ADMIN ROUTES
// ==========================================

// Create Client
// POST /api/clients
// logo -> single image
router.post(
  "/",
  authentication,
  upload.single("logo"),
  createClient
);


// Get All Clients
// GET /api/clients
router.get(
  "/",
  authentication,
  getClients
);


// Get Single Client
// GET /api/clients/:id
router.get(
  "/:id",
  authentication,
  getClientById
);


// Update Client
// PUT /api/clients/:id
// new logo -> optional
router.put(
  "/:id",
  authentication,
  upload.single("logo"),
  updateClient
);


// Delete Client
// DELETE /api/clients/:id
router.delete(
  "/:id",
  authentication,
  deleteClient
);


module.exports = router;