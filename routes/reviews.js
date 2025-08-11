const express = require("express");
const router = express.Router({ mergeParams: true }); // Important: mergeParams allows access to parent route params
const {
  getReviews,
  getReview,
  addReview,
  updateReview,
  deleteReview,
} = require("../controllers/reviews");

const Review = require("../models/Review");
const advancedResults = require("../middleware/advancedResults");
const { protect, authorize } = require("../middleware/auth");

router
  .route("/")
  .get(
    advancedResults(Review, {
      path: "user",
      select: "name email",
    }),
    getReviews
  )
  .post(protect, authorize("student", "admin"), addReview);

router
  .route("/:id")
  .get(getReview)
  .put(protect, authorize("student", "admin"), updateReview)
  .delete(protect, authorize("student", "admin"), deleteReview);

module.exports = router;
