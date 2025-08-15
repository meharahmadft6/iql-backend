const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getTeachers,
  getTeacher,
  getAllTeacherProfiles,
  createTeacherProfile,
  updateTeacherProfile,
  deleteTeacherProfile,
  getMyProfile,
  getAllPublicTeacherProfiles,
  getPublicTeacherProfile,
  approveTeacher,
} = require("../controllers/teacherController");

// Include other resource routers
const reviewRouter = require("../routes/reviews");

// Re-route into other resource routers
router.use("/:teacherId/reviews", reviewRouter);
router.route("/public").get(getAllPublicTeacherProfiles);
router.route("/public/:id").get(getPublicTeacherProfile);

router.route("/").post(protect, authorize("teacher"), createTeacherProfile);

router.route("/me").get(protect, authorize("teacher"), getMyProfile);
router.route("/all").get(protect, authorize("admin"), getAllTeacherProfiles);
router.route("/approve/:id").patch(protect, authorize("admin"), approveTeacher);

router
  .route("/:id")
  .get(getTeacher)
  .put(protect, authorize("teacher", "admin"), updateTeacherProfile)
  .delete(protect, authorize("teacher", "admin"), deleteTeacherProfile);

module.exports = router;
