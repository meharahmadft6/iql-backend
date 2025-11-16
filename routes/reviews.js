const express = require("express");
const router = express.Router({ mergeParams: true });
const {
  createReview,
  getTeacherReviews,
  getReview,
  updateReview,
  deleteReview,
} = require("../controllers/reviews"); // Make sure path is correct

const Review = require("../models/Review");
const advancedResults = require("../middleware/advancedResults");
const { protect, authorize } = require("../middleware/auth");
const asyncHandler = require("../middleware/async");

// Re-route into other resource routers
// This allows you to use both /api/v1/reviews and /api/v1/teachers/:teacherId/reviews

// Add this route before the existing routes
router.get(
  "/my-reviews",
  protect,
  authorize("student", "admin"),
  asyncHandler(async (req, res) => {
    const reviews = await Review.find({ user: req.user.id })
      .populate({
        path: "teacher",
        select: "user speciality",
        populate: {
          path: "user",
          select: "name email",
        },
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews,
    });
  })
);

router
  .route("/")
  .get(
    advancedResults(Review, {
      path: "user",
      select: "name",
    }),
    getTeacherReviews // This will handle both general reviews and teacher-specific reviews
  )
  .post(protect, authorize("student", "admin"), createReview);

router
  .route("/:id")
  .get(getReview)
  .put(protect, authorize("student", "admin"), updateReview)
  .delete(protect, authorize("student", "admin"), deleteReview);

module.exports = router;
