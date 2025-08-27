const { S3Client } = require("@aws-sdk/client-s3");
const multerS3 = require("multer-s3-v3");
const multer = require("multer");
const dotenv = require("dotenv");

dotenv.config();

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// S3 storage
const s3Storage = multerS3({
  s3,
  bucket: process.env.AWS_STORAGE_BUCKET_NAME,
  key: (req, file, cb) => {
    cb(
      null,
      file.fieldname +
        "-" +
        Date.now() +
        "-" +
        file.originalname.toLowerCase().replace(/\s+/g, "-")
    );
  },
});

// Memory storage (for backward compatibility)
const memoryStorage = multer.memoryStorage();

// File filter for images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

// Create different upload configurations
const upload = multer({
  storage: memoryStorage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    fields: 500, // allow many form fields
    files: 1,
  },
});

// For teacher profile with multiple images
const uploadTeacherFiles = multer({
  storage: s3Storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 2, // Maximum 2 files (profilePhoto and idProofFile)
  },
});

// For single file upload (profile photo only)
// For single file upload (profile photo only) - UPDATED
const uploadSingleTeacherFile = multer({
  storage: multerS3({
    s3,
    bucket: process.env.AWS_STORAGE_BUCKET_NAME,
    key: (req, file, cb) => {
      // Save in profile-photos/ folder
      const filename =
        "profile-photos/" +
        Date.now() +
        "-" +
        file.originalname.toLowerCase().replace(/\s+/g, "-");
      cb(null, filename);
    },
  }),
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1, // Only 1 file
  },
});

// Utility functions for S3 operations
const getImageFromS3 = async (req, res) => {
  const { key } = req.params;

  const params = {
    Bucket: process.env.AWS_STORAGE_BUCKET_NAME,
    Key: key,
  };

  try {
    const data = await s3.getObject(params).promise();
    res.setHeader("Content-Type", data.ContentType);
    res.send(data.Body);
  } catch (err) {
    console.log(err);
    res.status(404).send("Image not found");
  }
};

const getSignedUrl = async (key) => {
  try {
    const url = s3.getSignedUrl("getObject", {
      Bucket: process.env.AWS_STORAGE_BUCKET_NAME,
      Key: key,
      Expires: 3600, // Link expires in 1 hour
    });
    return url;
  } catch (err) {
    console.error("Failed to generate signed URL:", err);
    return null;
  }
};

const uploadFile = async (file, prefix = "") => {
  const params = {
    Bucket: process.env.AWS_STORAGE_BUCKET_NAME,
    Key: prefix + Date.now() + "-" + file.originalname,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  try {
    const data = await s3.upload(params).promise();
    return data.Key;
  } catch (err) {
    console.error("Upload error:", err);
    throw new Error("File upload failed");
  }
};

const deleteFile = async (key) => {
  const params = {
    Bucket: process.env.AWS_STORAGE_BUCKET_NAME,
    Key: key,
  };

  try {
    await s3.deleteObject(params).promise();
  } catch (err) {
    console.error("Delete error:", err);
    throw new Error("File deletion failed");
  }
};
// For requirements image upload (direct to S3)
const uploadRequirementImage = multer({
  storage: multerS3({
    s3,
    bucket: process.env.AWS_STORAGE_BUCKET_NAME,
    key: (req, file, cb) => {
      // Save in requirements/ folder
      const filename =
        "requirements/" +
        Date.now() +
        "-" +
        file.originalname.toLowerCase().replace(/\s+/g, "-");
      cb(null, filename);
    },
  }),
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1, // Only 1 file
  },
});
// Export all functions and configurations
module.exports = {
  upload, // This is the default export for backward compatibility
  uploadTeacherFiles,
  uploadSingleTeacherFile,
  uploadRequirementImage,
  getImageFromS3,
  getSignedUrl,
  uploadFile,
  deleteFile,
};
