const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  uploadTeacherFiles,
  uploadSingleTeacherFile,
} = require("../middleware/multer");
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
  getHomeTutors,
  getOnlineTeachers,
  getHomeworkHelpers,
  getTeachersBySubjectAndLocation,
} = require("../controllers/teacherController");

// Include other resource routers
const reviewRouter = require("../routes/reviews");

// Re-route into other resource routers
router.use("/:teacherId/reviews", reviewRouter);
router.route("/public").get(getAllPublicTeacherProfiles);
router.route("/public/:id").get(getPublicTeacherProfile);
router.route("/home-tutors").get(getHomeTutors);
router.route("/online-teachers").get(getOnlineTeachers);
router.route("/homework-helpers").get(getHomeworkHelpers);
router.route("/filter").get(getTeachersBySubjectAndLocation);

router.route("/").post(
  protect,
  authorize("teacher"),
  uploadTeacherFiles.fields([
    { name: "profilePhoto", maxCount: 1 },
    { name: "idProofFile", maxCount: 1 },
  ]),
  createTeacherProfile
);

router.route("/me").get(protect, authorize("teacher"), getMyProfile);
router.route("/all").get(protect, authorize("admin"), getAllTeacherProfiles);
router.route("/approve/:id").patch(protect, authorize("admin"), approveTeacher);

router
  .route("/:id")
  .get(getTeacher)
  .put(
    protect,
    authorize("teacher", "admin"),
    uploadSingleTeacherFile.single("profilePhoto"),
    updateTeacherProfile
  )
  .delete(protect, authorize("teacher", "admin"), deleteTeacherProfile);

module.exports = router;
