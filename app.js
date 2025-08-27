require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const AWS = require("aws-sdk");

const auth = require("./routes/authRoutes");
const teachers = require("./routes/teacherRoutes");
const reviews = require("./routes/reviews");
const postRequirements = require("./routes/postRequirementsRoutes");

const app = express();

// Configure AWS S3
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// ====== CORS (Apply FIRST, before routes) ======
app.use(
  cors({
    origin: [
      "http://localhost:3001",
      "https://infinityquotientlearning.vercel.app",
      "https://infinityquotientlearning.com",
      "https://www.infinityquotientlearning.com",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Ensure headers on ALL responses (fallback)
app.use((req, res, next) => {
  res.header(
    "Access-Control-Allow-Origin",
    "https://infinityquotientlearning.com",
    "http://localhost:3001",
    "https://infinityquotientlearning.vercel.app",
    "https://www.infinityquotientlearning.com"
  );
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS, PATCH"
  );
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// Body parser
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Logger
app.use(morgan("dev"));

// Cookie parser
app.use(cookieParser());

// // File uploading
// app.use(
//   fileupload({
//     useTempFiles: true,
//     tempFileDir: "/tmp/",
//     limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
//   })
// );

// Static folder
app.use(express.static(path.join(__dirname, "public")));

// Root test route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to Infinite Quotient Learning API",
    version: "1.0.0",
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Mount routes
app.use("/api/auth", auth);
app.use("/api/teachers", teachers);
app.use("/api/reviews", reviews);
app.use("/api/post-requirement", postRequirements);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error:
      process.env.NODE_ENV === "development" ? err.message : "Server Error",
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
  });
});

module.exports = app;
