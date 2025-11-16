// routes/upload.js
const express = require("express");
const router = express.Router();
const { uploadToS3 } = require("../controllers/uploadController");
const { protect, authorize } = require("../middleware/auth");

router.post("/s3", protect, authorize("admin"), uploadToS3);

module.exports = router;
