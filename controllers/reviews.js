// controllers/reviewController.js
const Review = require("../models/Review");
const Teacher = require("../models/Teacher");
const Contact = require("../models/Contact");
const asyncHandler = require("../middleware/async");

// @desc    Get reviews for a teacher or all reviews
// @route   GET /api/v1/reviews
// @route   GET /api/v1/teachers/:teacherId/reviews
// @access  Public
exports.getTeacherReviews = asyncHandler(async (req, res) => {
  if (req.params.teacherId) {
    // Get reviews for specific teacher
    const reviews = await Review.find({ teacher: req.params.teacherId })
      .populate("user", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews,
    });
  } else {
    // Get all reviews (handled by advancedResults middleware)
    res.status(200).json(res.advancedResults);
  }
});

// @desc    Get single review
// @route   GET /api/v1/reviews/:id
// @access  Public
exports.getReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id)
    .populate("user", "name")
    .populate("teacher", "user speciality");

  if (!review) {
    return res.status(404).json({
      success: false,
      message: "Review not found",
    });
  }

  res.status(200).json({
    success: true,
    data: review,
  });
});

// @desc    Create review
// @route   POST /api/v1/reviews
// @route   POST /api/v1/teachers/:teacherId/reviews
// @access  Private (Student, Admin)
exports.createReview = asyncHandler(async (req, res) => {
  const teacherId = req.params.teacherId || req.body.teacher;
  const studentId = req.user.id;
  const { title, text, rating } = req.body;

  if (!teacherId) {
    return res.status(400).json({
      success: false,
      message: "Please provide a teacher ID",
    });
  }

  // ✅ Check if teacher exists
  const teacher = await Teacher.findById(teacherId);
  if (!teacher) {
    return res.status(404).json({
      success: false,
      message: "Teacher not found",
    });
  }

  // ✅ Check if student has contacted this teacher
  const contact = await Contact.findOne({
    student: studentId,
    teacher: teacherId,
    status: "contacted",
  });

  if (!contact && req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "You can only review teachers you have contacted",
    });
  }

  // ✅ Check if review already exists
  const existingReview = await Review.findOne({
    teacher: teacherId,
    user: studentId,
  });

  if (existingReview) {
    return res.status(400).json({
      success: false,
      message: "You have already reviewed this teacher",
    });
  }

  // ✅ Create review
  const review = await Review.create({
    title,
    text,
    rating,
    teacher: teacherId,
    user: studentId,
  });

  // Populate the created review
  await review.populate("user", "name");
  await review.populate("teacher", "user speciality");

  res.status(201).json({
    success: true,
    data: review,
    message: "Review submitted successfully",
  });
});

// @desc    Update review
// @route   PUT /api/v1/reviews/:id
// @access  Private (Student, Admin)
exports.updateReview = asyncHandler(async (req, res) => {
  let review = await Review.findById(req.params.id);

  if (!review) {
    return res.status(404).json({
      success: false,
      message: "Review not found",
    });
  }

  // Make sure user is review owner or admin
  if (review.user.toString() !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Not authorized to update this review",
    });
  }

  review = await Review.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  }).populate("user", "name");

  res.status(200).json({
    success: true,
    data: review,
    message: "Review updated successfully",
  });
});

// @desc    Delete review
// @route   DELETE /api/v1/reviews/:id
// @access  Private (Student, Admin)
exports.deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    return res.status(404).json({
      success: false,
      message: "Review not found",
    });
  }

  // Make sure user is review owner or admin
  if (review.user.toString() !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Not authorized to delete this review",
    });
  }

  await review.deleteOne();

  res.status(200).json({
    success: true,
    data: {},
    message: "Review deleted successfully",
  });
});
