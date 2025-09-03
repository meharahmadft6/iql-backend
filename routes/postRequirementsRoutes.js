const express = require("express");
const { upload } = require("../middleware/multer"); // Import the specific upload function
const {
  createPostRequirement,
  getPostRequirements,
  getPostRequirement,
  updatePostRequirement,
  deletePostRequirement,
  getMyPostRequirements,
  getOnlineTeachingJobs,
  getHomeTeachingJobs,
  getAssignmentHelpPosts,
} = require("../controllers/postRequirementsController");

const {
  protect,
  optionalAuth,
  checkStudentRole,
} = require("../middleware/auth");
const { uploadRequirementImage } = require("../middleware/multer");
const router = express.Router();

// 📌 Add (POST)
router.post(
  "/",
  uploadRequirementImage.single("image"), // Use direct S3 upload
  optionalAuth,
  checkStudentRole,
  createPostRequirement
);

// 📌 Get All (GET)
// 📌 Get User’s Posts (protected)
router.get("/my-posts", protect, getMyPostRequirements);
router.get("/online-teaching-jobs", getOnlineTeachingJobs);
router.get("/home-teaching-jobs", getHomeTeachingJobs);
router.get("/assignment-help", getAssignmentHelpPosts);

// 📌 Get All (only verified student posts)
router.get("/", getPostRequirements);

// 📌 Get Single (GET)
router.get("/:id", getPostRequirement);

// 📌 Update (PUT)
router.put("/:id", protect, upload.single("image"), updatePostRequirement);

// 📌 Delete (DELETE)
router.delete("/:id", protect, deletePostRequirement);

module.exports = router;
