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

const router = express.Router();


// ==============================
// WEBSITE CLIENTS
// GET /api/clients/website
// ==============================
router.get("/website", getWebsiteClients);


// ==============================
// CREATE CLIENT
// POST /api/clients
// logo -> single image
// ==============================
router.post(
  "/",
  upload.single("logo"),
  createClient
);


// ==============================
// GET ALL CLIENTS
// GET /api/clients
// ==============================
router.get(
  "/",
  getClients
);


// ==============================
// GET SINGLE CLIENT
// GET /api/clients/:id
// ==============================
router.get(
  "/:id",
  getClientById
);


// ==============================
// UPDATE CLIENT
// PUT /api/clients/:id
// new logo optional
// ==============================
router.put(
  "/:id",
  upload.single("logo"),
  updateClient
);


// ==============================
// DELETE CLIENT
// DELETE /api/clients/:id
// ==============================
router.delete(
  "/:id",
  deleteClient
);


module.exports = router;