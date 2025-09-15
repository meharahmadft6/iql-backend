// controllers/teacherApplications.js
const asyncHandler = require("../middleware/async");
const ErrorResponse = require("../utils/errorResponse");
const TeacherApplication = require("../models/TeacherApplication");
const Teacher = require("../models/Teacher");
const PostRequirement = require("../models/PostRequirement");
const Wallet = require("../models/Wallet");
const User = require("../models/User");
const mongoose = require("mongoose");

// @desc    Apply to a student post requirement
// @route   POST /api/applications/apply/:postId
// @access  Private (Teacher)
exports.applyToPost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const teacherId = req.user.id;

  // ✅ Check if teacher has a complete profile
  const teacherProfile = await Teacher.findOne({ user: teacherId });
  if (!teacherProfile) {
    return res.status(400).json({
      success: false,
      message: "Please complete your teacher profile first",
    });
  }

  if (!teacherProfile.isApproved) {
    return res.status(400).json({
      success: false,
      message: "Your teacher profile is not approved yet",
    });
  }

  // ✅ Check if post requirement exists
  const postRequirement = await PostRequirement.findById(postId).populate(
    "user"
  );
  if (!postRequirement) {
    return res.status(404).json({
      success: false,
      message: "Post requirement not found",
    });
  }

  // ✅ Check if teacher has already applied
  const existingApplication = await TeacherApplication.findOne({
    teacher: teacherProfile._id,
    postRequirement: postId,
  });

  if (existingApplication) {
    return res.status(400).json({
      success: false,
      message: "You have already applied to this post",
    });
  }

  // ✅ Check if teacher has required subjects
  const hasMatchingSubject = teacherProfile.subjects.some((teacherSubject) => {
    return postRequirement.subjects.some((postSubject) => {
      return (
        teacherSubject.name.toLowerCase() === postSubject.name.toLowerCase() &&
        this.checkLevelMatch(teacherSubject, postSubject.level)
      );
    });
  });

  if (!hasMatchingSubject) {
    return res.status(400).json({
      success: false,
      message: "Your subjects don't match the post requirements",
    });
  }

  // ✅ Check language compatibility
  const hasCommonLanguage = teacherProfile.languages.some((teacherLang) =>
    postRequirement.languages.includes(teacherLang)
  );

  if (!hasCommonLanguage) {
    return res.status(400).json({
      success: false,
      message: "You don't share a common language with the student",
    });
  }

  // ✅ Check teacher's wallet balance
  const teacherWallet = await Wallet.findOne({
    user: new mongoose.Types.ObjectId(teacherId),
  });

  if (!teacherWallet) {
    return res.status(404).json({
      success: false,
      message: "Wallet not found for this teacher",
    });
  }

  const applicationCost = this.calculateApplicationCost(postRequirement);

  if (teacherWallet.balance < applicationCost) {
    return res.status(400).json({
      success: false,
      message: "Insufficient coins to apply to this post",
    });
  }

  // ✅ Check student's wallet
  const studentWallet = await Wallet.findOne({
    user: postRequirement.user._id,
  });
  const contactCost = 50; // constant

  if (!studentWallet) {
    return res.status(404).json({
      success: false,
      message: "Student wallet not found",
    });
  }

  if (studentWallet.balance < contactCost) {
    return res.status(400).json({
      success: false,
      message: "Student doesn't have enough coins for contact",
    });
  }

  // ✅ Deduct coins from teacher wallet
  teacherWallet.balance -= applicationCost;
  teacherWallet.transactions.push({
    type: "debit",
    amount: applicationCost,
    description: `Applied to post: ${postRequirement.description.substring(
      0,
      50
    )}...`,
    reference: postId,
    transactionModel: "PostRequirement",
  });

  await teacherWallet.save();

  // ✅ Create application
  const application = await TeacherApplication.create({
    teacher: teacherProfile._id,
    postRequirement: postId,
    applicationCost,
  });

  res.status(201).json({
    success: true,
    data: application,
    message: "Application submitted successfully",
  });
});

exports.getContactInformation = asyncHandler(async (req, res, next) => {
  const { applicationId } = req.params;
  const teacherId = req.user.id;

  // Find application
  const application = await TeacherApplication.findById(applicationId)
    .populate({
      path: "postRequirement",
      populate: {
        path: "user",
        select: "name email phone",
      },
    })
    .populate({
      path: "teacher",
      populate: { path: "user", select: "name email" },
    });

  if (!application) {
    return next(new ErrorResponse("Application not found", 404));
  }

  // Check teacher authorization
  if (application.teacher.user._id.toString() !== teacherId) {
    return next(
      new ErrorResponse("Not authorized to access this application", 401)
    );
  }

  // Allow only if status is accepted or already contacted
  if (!["accepted", "contacted"].includes(application.status)) {
    return next(
      new ErrorResponse("Application not yet accepted by student", 400)
    );
  }

  // If first time, update to contacted
  if (application.status === "accepted") {
    application.status = "contacted";
    application.contactedAt = Date.now();
    await application.save();
  }

  // Return student’s contact info
  res.status(200).json({
    success: true,
    data: {
      student: {
        name: application.postRequirement.user.name,
        email: application.postRequirement.user.email,
        phone:
          application.postRequirement.user.phone ||
          application.postRequirement.phone,
      },
    },
  });
});

// Helper function to calculate application cost
exports.calculateApplicationCost = (postRequirement) => {
  // Base cost between 40-70 coins based on post complexity
  const baseCost = 40;
  const complexityFactor = Math.min(postRequirement.subjects.length, 3); // Max 3 subjects considered
  const additionalCost = complexityFactor * 10;

  return Math.min(baseCost + additionalCost, 40); // Cap at 70 coins
};

// Helper function to check if teacher's level matches post requirement
exports.checkLevelMatch = (teacherSubject, postLevel) => {
  // This is a simplified implementation - you might want to expand this
  // based on your specific level matching logic
  const levelHierarchy = {
    Beginner: 1,
    Intermediate: 2,
    Advanced: 3,
    Expert: 4,
    // Add more levels as needed
  };

  // For now, assume teacher can teach the level if they have the same or higher level
  return (
    levelHierarchy[teacherSubject.toLevel] >= levelHierarchy[postLevel] ||
    levelHierarchy[teacherSubject.fromLevel] <= levelHierarchy[postLevel]
  );
};

exports.checkApplicationStatus = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const teacherId = req.user.id;

  // Find teacher profile
  const teacherProfile = await Teacher.findOne({ user: teacherId });
  if (!teacherProfile) {
    return res.status(404).json({
      success: false,
      message: "Teacher profile not found",
    });
  }

  // Check if application exists
  const application = await TeacherApplication.findOne({
    teacher: teacherProfile._id,
    postRequirement: postId,
  });

  if (!application) {
    return res.status(404).json({
      success: false,
      message: "No application found for this post",
    });
  }

  res.status(200).json({
    success: true,
    data: application,
  });
});
