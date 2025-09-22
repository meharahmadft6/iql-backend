// routes/teacherApplications.js
const express = require("express");
const {
  applyToPost,
  getContactInformation,
  checkApplicationStatus,
  getTeacherApplications,
  getApplicationsByTeacher,
} = require("../controllers/teacherApplications");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

router.route("/apply/:postId").post(protect, authorize("teacher"), applyToPost);
router
  .route("/contact/:applicationId")
  .get(protect, authorize("teacher"), getContactInformation);
router
  .route("/check/:postId")
  .get(protect, authorize("teacher"), checkApplicationStatus);

router.get("/allteachers", getTeacherApplications);

// Get applications for a specific teacher
router.get("/teacher/:teacherId", getApplicationsByTeacher);
module.exports = router;
