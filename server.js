
require("dotenv").config();

const express = require("express");
const app = express();

const cors = require("cors");
const cookieParser = require("cookie-parser");

const blogRoutes = require("./src/routes/blog.routes");
const clientRoutes = require("./src/routes/client.route");
const galleryRoutes = require("./src/routes/gallery.routes");
const teamRoutes = require("./src/routes/team.routes");
const authRouter = require("./src/routes/auth.routes");
const projectRoutes = require("./src/routes/project.route");

const connectDb = require("./src/config/db");

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());
app.use(cookieParser());

// Health check
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Your Tectonic server is healthy",
  });
});

// Routes
app.use("/api/projects", projectRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/team", teamRoutes);
app.use("/api/admin", authRouter);

// Database connection
connectDb().catch((error) => {
  console.error("Database connection failed:", error);
});

// Local development only
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Export Express app for Vercel
module.exports = app;
