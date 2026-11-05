
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

// ==========================================
// ROUTE IMPORTS
// ==========================================

const blogRoutes = require("./src/routes/blog.routes");
const clientRoutes = require("./src/routes/client.route");
const galleryRoutes = require("./src/routes/gallery.routes");
const teamRoutes = require("./src/routes/team.routes");
const userRoutes = require("./src/routes/user.routes");
const authRouter = require("./src/routes/auth.routes");
const auditLogRoutes = require("./src/routes/auditLog.routes");
const staffRoutes = require("./src/routes/staff.routes");
const projectRoutes = require("./src/routes/project.route");

// ==========================================
// DATABASE
// ==========================================

const connectDb = require("./src/config/db");

// ==========================================
// APP CONFIGURATION
// ==========================================

const app = express();

const PORT =  3000 || process.env.PORT

// ==========================================
// MIDDLEWARES
// ==========================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://tectonic-engineering-admin.vercel.app",
    ],
    credentials: true,
  })
);

// ==========================================
// API ROUTES
// ==========================================

app.use("/api/projects", projectRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/team", teamRoutes);

app.use("/api/admin", authRouter);
app.use("/api/admin/users", staffRoutes);
app.use("/api/admin/users", userRoutes);
app.use("/api/admin/activity-logs", auditLogRoutes);

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Tectonic backend server is running.",
  });
});

// ==========================================
// START SERVER AFTER DATABASE CONNECTION
// ==========================================

const startServer = async () => {
  try {
    await connectDb();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();
