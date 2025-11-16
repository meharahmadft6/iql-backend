// controllers/courseController.js
const Course = require("../models/Course");
const SubjectResources = require("../models/SubjectResources");
const ErrorResponse = require("../utils/errorResponse");

exports.updateCourse = async (req, res, next) => {
  try {
    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!course) {
      return next(new ErrorResponse("Course not found", 404));
    }

    res.status(200).json({
      success: true,
      data: course,
    });
  } catch (error) {
    next(error);
  }
};

// 📋 Get all courses (with search)
exports.getCourses = async (req, res, next) => {
  try {
    const { level, search, page = 1, limit = 10 } = req.query;

    let query = { isActive: true };

    if (level) query.level = level;
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const courses = await Course.find(query)
      .populate("subjectExamBoards.subject", "name category level")
      .populate("createdBy", "name email")
      .sort({ name: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Course.countDocuments(query);

    res.status(200).json({
      success: true,
      count: courses.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      data: courses,
    });
  } catch (error) {
    next(error);
  }
};

// 🔍 Get single course with resources (Public)
exports.getCourse = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate("subjectExamBoards.subject", "name category level")
      .populate("createdBy", "name email");

    if (!course) {
      return next(new ErrorResponse("Course not found", 404));
    }

    // Get all subject resources for this course
    const subjectResources = await SubjectResources.find({
      course: req.params.id,
    }).populate("subject", "name category level");

    res.status(200).json({
      success: true,
      data: {
        course,
        subjectResources,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.createCourse = async (req, res, next) => {
  try {
    const courseData = {
      ...req.body,
      createdBy: req.user.id,
    };

    const course = new Course(courseData);
    await course.save();

    // Populate the subject data before sending response
    await course.populate("subjectExamBoards.subject", "name category level");

    res.status(201).json({
      success: true,
      data: course,
    });
  } catch (error) {
    next(error);
  }
};

// ✏️ Update course (Admin only)
exports.updateCourse = async (req, res, next) => {
  try {
    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      {
        new: true,
        runValidators: true,
      }
    ).populate("subjectExamBoards.subject", "name category level");

    if (!course) {
      return next(new ErrorResponse("Course not found", 404));
    }

    res.status(200).json({
      success: true,
      data: course,
    });
  } catch (error) {
    next(error);
  }
};

// ❌ Delete course (Admin only)
exports.deleteCourse = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return next(new ErrorResponse("Course not found", 404));
    }

    // Soft delete by setting isActive to false
    course.isActive = false;
    course.updatedAt = Date.now();
    await course.save();

    res.status(200).json({
      success: true,
      message: "Course deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
