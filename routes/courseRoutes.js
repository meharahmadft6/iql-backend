// routes/courseRoutes.js
const express = require("express");
const router = express.Router();
const {
  createCourse,
  getCourses,
  getCourse,
  updateCourse,
  deleteCourse,
} = require("../controllers/courseController");
const { protect, authorize } = require("../middleware/auth");
const { optionalAuth } = require("../middleware/auth");

// Public routes
router.get("/", optionalAuth, getCourses);
router.get("/:id", optionalAuth, getCourse);

// Admin only routes
router.post("/", protect, authorize("admin"), createCourse);
router.put("/:id", protect, authorize("admin"), updateCourse);
router.delete("/:id", protect, authorize("admin"), deleteCourse);

module.exports = router;
