require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const morgan = require("morgan");
const fileupload = require("express-fileupload");
const path = require("path");
const AWS = require("aws-sdk");

// Configure AWS S3
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Route files
const auth = require("./routes/authRoutes");
const teachers = require("./routes/teacherRoutes");
const reviews = require("./routes/reviews");
const postRequirements = require("./routes/postRequirementsRoutes");
const app = express();

// Body parser
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Logger
app.use(morgan("dev"));

// Cookie parser
app.use(cookieParser());

// File uploading
app.use(
  fileupload({
    useTempFiles: true,
    tempFileDir: "/tmp/",
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  })
);

// Static folder
app.use(express.static(path.join(__dirname, "public")));

// Enable CORS
app.use(
  cors({
    origin: [
      "http://localhost:3001",
      "https://infinityquotientlearning.vercel.app",
      "https://infinityquotientlearning.com",
      "https://infinityquotientlearning.com/teachers",
      "https://www.infinityquotientlearning.com", // Add this if you use www
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);

// Root test route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to Infinite Quotient Learning API",
    version: "1.0.0",
    documentation: "https://github.com/your-repo/docs",
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
app.use("/api/post-requiremnet", postRequirements);

// Error handling middleware (should be after all routes)
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
