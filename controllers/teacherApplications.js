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
  const levelOrder = [
    "Kindergarten",
    "Grade 1",
    "Grade 2",
    "Grade 3",
    "Grade 4",
    "Grade 5",
    "Grade 6",
    "Grade 7",
    "Grade 8",
    "Grade 9",
    "Grade 10",
    "Grade 11",
    "Grade 12",
    "Primary",
    "Secondary",
    "IGCSE",
    "O-Level",
    "AS-Level",
    "A-Level",
    "IB Middle Years",
    "IB Diploma",
    "Certificate",
    "Diploma",
    "Associate",
    "Bachelor's",
    "Master's",
    "PhD",
    "Postdoctoral",
    "Other",
  ];

  const teacherFromIndex = levelOrder.indexOf(teacherSubject.fromLevel);
  const teacherToIndex = levelOrder.indexOf(teacherSubject.toLevel);
  const postLevelIndex = levelOrder.indexOf(postLevel);

  return teacherFromIndex <= postLevelIndex && teacherToIndex >= postLevelIndex;
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

exports.getTeacherApplications = async (req, res) => {
  try {
    const applications = await TeacherApplication.find()
      .populate({
        path: "teacher",
        select:
          "speciality currentRole gender location phoneNumber languages profilePhoto", // only required fields
      })
      .populate({
        path: "postRequirement",
        populate: { path: "user", select: "name email" }, // if you want post owner details
      });

    res.status(200).json({
      success: true,
      count: applications.length,
      data: applications,
    });
  } catch (error) {
    console.error("Error fetching applications:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};

// Get applications by teacherId
exports.getApplicationsByTeacher = async (req, res) => {
  try {
    const { teacherId } = req.params;

    // Step 1: find teacher document by user id
    const teacher = await Teacher.findOne({ user: teacherId });
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher profile not found for this user",
      });
    }

    // Step 2: use teacher._id to fetch applications
    const applications = await TeacherApplication.find({ teacher: teacher._id })
      .populate({
        path: "teacher",
        select:
          "speciality currentRole gender location phoneNumber languages profilePhoto",
      })
      .populate({
        path: "postRequirement",
        populate: {
          path: "user",
          select: "name email phone",
        },
      })
      .sort({ appliedAt: -1 }); // Sort by most recent first

    // Step 3: Calculate statistics
    const stats = {
      total: applications.length,
      pending: applications.filter((app) => app.status === "pending").length,
      contacted: applications.filter((app) => app.status === "contacted")
        .length,
      accepted: applications.filter((app) => app.status === "accepted").length,
      rejected: applications.filter((app) => app.status === "rejected").length,
      totalCostSpent: applications.reduce(
        (sum, app) => sum + (app.applicationCost || 0),
        0
      ),
      thisMonth: applications.filter((app) => {
        const appliedDate = new Date(app.appliedAt);
        const currentDate = new Date();
        return (
          appliedDate.getMonth() === currentDate.getMonth() &&
          appliedDate.getFullYear() === currentDate.getFullYear()
        );
      }).length,
      thisWeek: applications.filter((app) => {
        const appliedDate = new Date(app.appliedAt);
        const currentDate = new Date();
        const weekAgo = new Date(
          currentDate.getTime() - 7 * 24 * 60 * 60 * 1000
        );
        return appliedDate >= weekAgo;
      }).length,
    };

    // Step 4: Add contact information for contacted/accepted applications
    const applicationsWithContact = applications.map((app) => {
      const appObj = app.toObject();

      // Add contact info if status allows it
      if (app.status === "contacted" || app.status === "accepted") {
        appObj.contactInfo = {
          student: {
            name: app.postRequirement.user.name,
            email: app.postRequirement.user.email,
            phone: app.postRequirement.phone || null,
          },
        };
      }

      return appObj;
    });

    res.status(200).json({
      success: true,
      count: applications.length,
      stats: stats,
      data: applicationsWithContact,
    });
  } catch (error) {
    console.error("Error fetching teacher applications:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
};
