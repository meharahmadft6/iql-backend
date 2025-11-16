const CourseAccessRequest = require("../models/CourseAccessRequest");
const User = require("../models/User");
const ErrorResponse = require("../utils/errorResponse");

// Student requests course access
exports.requestCourseAccess = async (req, res, next) => {
  try {
    const { courseId, subjectId, examBoard, reviewNotes } = req.body;
    const studentId = req.user.id;

    // Check if request already exists
    const existingRequest = await CourseAccessRequest.findOne({
      student: studentId,
      course: courseId,
      subject: subjectId,
      examBoard: examBoard,
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: "Access request already submitted",
        data: existingRequest,
      });
    }

    // Create new request with review notes
    const accessRequest = new CourseAccessRequest({
      student: studentId,
      course: courseId,
      subject: subjectId,
      examBoard: examBoard,
      reviewNotes: reviewNotes || "", // Save the review notes
    });

    await accessRequest.save();

    // Populate the request data
    await accessRequest.populate("course", "name level");
    await accessRequest.populate("subject", "name category");
    await accessRequest.populate("student", "name email");

    res.status(201).json({
      success: true,
      message: "Course access request submitted successfully",
      data: accessRequest,
    });
  } catch (error) {
    next(error);
  }
};
// Admin approves/rejects course access
exports.reviewAccessRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { status, reviewNotes } = req.body;
    const adminId = req.user.id;

    const accessRequest = await CourseAccessRequest.findById(requestId)
      .populate("student")
      .populate("course")
      .populate("subject");

    if (!accessRequest) {
      return next(new ErrorResponse("Access request not found", 404));
    }

    // Update request status
    accessRequest.status = status;
    accessRequest.reviewedAt = new Date();
    accessRequest.reviewedBy = adminId;
    accessRequest.reviewNotes = reviewNotes;

    await accessRequest.save();

    // If approved, add to student's approved courses
    if (status === "approved") {
      await User.findByIdAndUpdate(accessRequest.student._id, {
        $addToSet: {
          approvedCourses: {
            course: accessRequest.course._id,
            subject: accessRequest.subject._id,
            examBoard: accessRequest.examBoard,
            approvedAt: new Date(),
            approvedBy: adminId,
          },
        },
      });
    }

    // If rejected, remove from approved courses (if it was there)
    if (status === "rejected") {
      await User.findByIdAndUpdate(accessRequest.student._id, {
        $pull: {
          approvedCourses: {
            course: accessRequest.course._id,
            subject: accessRequest.subject._id,
            examBoard: accessRequest.examBoard,
          },
        },
      });
    }

    res.status(200).json({
      success: true,
      message: `Access request ${status} successfully`,
      data: accessRequest,
    });
  } catch (error) {
    next(error);
  }
};

// Get student's access requests
exports.getStudentAccessRequests = async (req, res, next) => {
  try {
    const studentId = req.user.id;

    const accessRequests = await CourseAccessRequest.find({
      student: studentId,
    })
      .populate("course", "name level")
      .populate("subject", "name category")
      .sort({ requestedAt: -1 });

    res.status(200).json({
      success: true,
      data: accessRequests,
    });
  } catch (error) {
    next(error);
  }
};

// Get all pending requests (for admin)
exports.getPendingAccessRequests = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const accessRequests = await CourseAccessRequest.find({
      status: "pending",
    })
      .populate("course", "name level")
      .populate("subject", "name category")
      .populate("student", "name email")
      .sort({ requestedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await CourseAccessRequest.countDocuments({
      status: "pending",
    });

    res.status(200).json({
      success: true,
      count: accessRequests.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      data: accessRequests,
    });
  } catch (error) {
    next(error);
  }
};

// Check if student has access to specific course/subject/examBoard
exports.checkCourseAccess = async (req, res, next) => {
  try {
    const { courseId, subjectId, examBoard } = req.params;
    const studentId = req.user.id;

    console.log("Checking access for:", {
      studentId,
      courseId,
      subjectId,
      examBoard,
    });

    const student = await User.findById(studentId);

    console.log("Student approved courses:", student.approvedCourses);
    console.log("Looking for:", {
      courseId,
      subjectId,
      examBoard,
    });

    // Check both user's approved courses and approved access requests
    const hasAccessInUser = student.approvedCourses.some(
      (approved) =>
        approved.course.toString() === courseId &&
        approved.subject.toString() === subjectId &&
        approved.examBoard === examBoard
    );

    const approvedRequest = await CourseAccessRequest.findOne({
      student: studentId,
      course: courseId,
      subject: subjectId,
      examBoard: examBoard,
      status: "approved",
    });

    const hasAccess = hasAccessInUser || !!approvedRequest;

    console.log("Access check results:", {
      hasAccessInUser,
      approvedRequestExists: !!approvedRequest,
      finalHasAccess: hasAccess,
    });

    const pendingRequest = await CourseAccessRequest.findOne({
      student: studentId,
      course: courseId,
      subject: subjectId,
      examBoard: examBoard,
      status: "pending",
    });

    res.status(200).json({
      success: true,
      data: {
        hasAccess,
        pendingRequest: !!pendingRequest,
        requestStatus: pendingRequest
          ? "pending"
          : hasAccess
          ? "approved"
          : "none",
      },
    });
  } catch (error) {
    next(error);
  }
};
// Get access request statistics
exports.getAccessRequestStats = async (req, res, next) => {
  try {
    const totalRequests = await CourseAccessRequest.countDocuments();
    const pendingRequests = await CourseAccessRequest.countDocuments({
      status: "pending",
    });
    const approvedRequests = await CourseAccessRequest.countDocuments({
      status: "approved",
    });
    const rejectedRequests = await CourseAccessRequest.countDocuments({
      status: "rejected",
    });

    // Get recent requests (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentRequests = await CourseAccessRequest.countDocuments({
      requestedAt: { $gte: sevenDaysAgo },
    });

    res.status(200).json({
      success: true,
      data: {
        totalRequests,
        pendingRequests,
        approvedRequests,
        rejectedRequests,
        recentRequests,
      },
    });
  } catch (error) {
    next(error);
  }
};
