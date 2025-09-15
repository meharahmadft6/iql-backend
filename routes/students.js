const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const { getAllStudentsWithStats } = require("../controllers/studentController");

// Admin routes for student management
router
  .route("/admin")
  .get(protect, authorize("admin"), getAllStudentsWithStats);

module.exports = router;
