const ErrorResponse = require("../utils/errorResponse");
const asyncHandler = require("../middleware/async");
const Review = require("../models/Review");
const Teacher = require("../models/Teacher");

// @desc    Get reviews
// @route   GET /api/v1/reviews
// @route   GET /api/v1/teachers/:teacherId/reviews
// @access  Public
exports.getReviews = asyncHandler(async (req, res, next) => {
  if (req.params.teacherId) {
    const reviews = await Review.find({
      teacher: req.params.teacherId,
    }).populate({
      path: "user",
      select: "name email",
    });

    return res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews,
    });
  } else {
    res.status(200).json(res.advancedResults);
  }
});

// @desc    Get single review
// @route   GET /api/v1/reviews/:id
// @access  Public
exports.getReview = asyncHandler(async (req, res, next) => {
  const review = await Review.findById(req.params.id).populate({
    path: "user",
    select: "name email",
  });

  if (!review) {
    return next(
      new ErrorResponse(`No review found with the id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: review,
  });
});

// @desc    Add review
// @route   POST /api/v1/teachers/:teacherId/reviews
// @access  Private
exports.addReview = asyncHandler(async (req, res, next) => {
  req.body.teacher = req.params.teacherId;
  req.body.user = req.user.id;

  const teacher = await Teacher.findById(req.params.teacherId);

  if (!teacher) {
    return next(
      new ErrorResponse(
        `No teacher with the id of ${req.params.teacherId}`,
        404
      )
    );
  }

  // Check if user has already reviewed the teacher
  const existingReview = await Review.findOne({
    user: req.user.id,
    teacher: req.params.teacherId,
  });

  if (existingReview) {
    return next(
      new ErrorResponse(
        `User ${req.user.id} has already reviewed teacher ${req.params.teacherId}`,
        400
      )
    );
  }

  const review = await Review.create(req.body);

  res.status(201).json({
    success: true,
    data: review,
  });
});

// @desc    Update review
// @route   PUT /api/v1/reviews/:id
// @access  Private
exports.updateReview = asyncHandler(async (req, res, next) => {
  let review = await Review.findById(req.params.id);

  if (!review) {
    return next(
      new ErrorResponse(`No review with the id of ${req.params.id}`, 404)
    );
  }

  // Make sure review belongs to user or user is admin
  if (review.user.toString() !== req.user.id && req.user.role !== "admin") {
    return next(new ErrorResponse(`Not authorized to update review`, 401));
  }

  review = await Review.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: review,
  });
});

// @desc    Delete review
// @route   DELETE /api/v1/reviews/:id
// @access  Private
exports.deleteReview = asyncHandler(async (req, res, next) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    return next(
      new ErrorResponse(`No review with the id of ${req.params.id}`, 404)
    );
  }

  // Make sure review belongs to user or user is admin
  if (review.user.toString() !== req.user.id && req.user.role !== "admin") {
    return next(new ErrorResponse(`Not authorized to delete review`, 401));
  }

  await review.remove();

  res.status(200).json({
    success: true,
    data: {},
  });
});
