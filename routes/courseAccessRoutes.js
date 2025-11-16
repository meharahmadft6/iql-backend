const express = require("express");
const router = express.Router();
const {
  requestCourseAccess,
  reviewAccessRequest,
  getStudentAccessRequests,
  getPendingAccessRequests,
  checkCourseAccess,
  getAccessRequestStats,
} = require("../controllers/courseAccessController");
const { protect, authorize } = require("../middleware/auth");

// Student routes
router.post("/request", protect, authorize("student"), requestCourseAccess);
router.get(
  "/my-requests",
  protect,
  authorize("student"),
  getStudentAccessRequests
);
router.get(
  "/check-access/:courseId/:subjectId/:examBoard",
  protect,
  checkCourseAccess
);

// Admin routes
router.get("/pending", protect, authorize("admin"), getPendingAccessRequests);
router.patch(
  "/:requestId/review",
  protect,
  authorize("admin"),
  reviewAccessRequest
);
// Add this route
router.get("/stats", protect, authorize("admin"), getAccessRequestStats);

module.exports = router;
