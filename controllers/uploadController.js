// controllers/uploadController.js
const AWS = require("aws-sdk");
const multer = require("multer");
const path = require("path");

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

// Configure multer for memory storage
const storage = multer.memoryStorage();

// Allowed file types
const allowedMimeTypes = {
  pdf: "application/pdf",
  images: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
  ],
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check if file is PDF
    if (file.mimetype === allowedMimeTypes.pdf) {
      cb(null, true);
    }
    // Check if file is an image
    else if (allowedMimeTypes.images.includes(file.mimetype)) {
      cb(null, true);
    }
    // Reject other file types
    else {
      cb(
        new Error(
          "Only PDF and image files (JPEG, PNG, GIF, WEBP, SVG) are allowed"
        ),
        false
      );
    }
  },
});

exports.uploadToS3 = [
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }

      // Determine folder based on file type
      let folder;
      if (req.file.mimetype === "application/pdf") {
        folder = "past-papers"; // PDFs go to past-papers folder
      } else {
        folder = "revision-notes"; // Images go to revision-notes folder
      }

      // You can also allow manual folder override via request body
      if (
        req.body.folder &&
        (req.body.folder === "past-papers" ||
          req.body.folder === "revision-notes")
      ) {
        folder = req.body.folder;
      }

      // Generate unique filename with original extension
      const fileExtension = path.extname(req.file.originalname);
      const baseName = path.basename(req.file.originalname, fileExtension);
      const fileName = `${folder}/${Date.now()}-${baseName.replace(
        /\s+/g,
        "-"
      )}${fileExtension}`;

      const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: fileName,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
        // Remove ACL parameter - bucket policies will handle access
      };

      const result = await s3.upload(params).promise();

      res.json({
        success: true,
        url: result.Location,
        key: result.Key,
        folder: folder,
        fileType: req.file.mimetype.startsWith("image/") ? "image" : "pdf",
        message: "File uploaded successfully",
      });
    } catch (error) {
      console.error("Error uploading to S3:", error);
      res.status(500).json({
        success: false,
        message: "Failed to upload file",
        error: error.message,
      });
    }
  },
];

// Optional: Separate endpoint for specific file types if needed
exports.uploadImageToS3 = [
  upload.single("image"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No image uploaded",
        });
      }

      // Force images to revision-notes folder
      const folder = "revision-notes";

      const fileExtension = path.extname(req.file.originalname);
      const baseName = path.basename(req.file.originalname, fileExtension);
      const fileName = `${folder}/${Date.now()}-${baseName.replace(
        /\s+/g,
        "-"
      )}${fileExtension}`;

      const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: fileName,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      };

      const result = await s3.upload(params).promise();

      res.json({
        success: true,
        url: result.Location,
        key: result.Key,
        folder: folder,
        message: "Image uploaded successfully",
      });
    } catch (error) {
      console.error("Error uploading image to S3:", error);
      res.status(500).json({
        success: false,
        message: "Failed to upload image",
        error: error.message,
      });
    }
  },
];
