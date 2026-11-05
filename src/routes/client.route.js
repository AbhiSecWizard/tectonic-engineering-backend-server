
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
const authorize = require("../middlewares/authorize");

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
router.post(
  "/",
  authentication,
  authorize("clients", "create"),
  upload.single("logo"),
  createClient
);


// Get All Clients
// GET /api/clients
router.get(
  "/",
  authentication,
  authorize("clients", "read"),
  getClients
);


// Get Single Client
// GET /api/clients/:id
router.get(
  "/:id",
  authentication,
  authorize("clients", "read"),
  getClientById
);


// Update Client
// PUT /api/clients/:id
router.put(
  "/:id",
  authentication,
  authorize("clients", "update"),
  upload.single("logo"),
  updateClient
);


// Delete Client
// DELETE /api/clients/:id
router.delete(
  "/:id",
  authentication,
  authorize("clients", "delete"),
  deleteClient
);


module.exports = router;
