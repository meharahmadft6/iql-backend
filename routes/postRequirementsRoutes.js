const express = require("express");
const {
  createPostRequirement,
  getPostRequirements,
  getPostRequirement,
  updatePostRequirement,
  deletePostRequirement,
} = require("../controllers/postRequirementsController");

const {
  protect,
  optionalAuth,
  checkStudentRole,
} = require("../middleware/auth");

const router = express.Router();

router
  .route("/")
  .get(getPostRequirements)
  .post(optionalAuth, checkStudentRole, createPostRequirement);

router
  .route("/:id")
  .get(getPostRequirement)
  .put(protect, updatePostRequirement)
  .delete(protect, deletePostRequirement);

module.exports = router;
