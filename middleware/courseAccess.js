const User = require("../models/User");
const ErrorResponse = require("../utils/errorResponse");

exports.checkCourseAccess = async (req, res, next) => {
  try {
    const { courseId, subjectId, examBoard } = req.params;
    const studentId = req.user.id;

    // Check if user is admin (admins have full access)
    if (req.user.role === "admin") {
      return next();
    }

    // Check if student has access to this specific course/subject/examBoard
    const student = await User.findById(studentId);

    const hasAccess = student.approvedCourses.some(
      (approved) =>
        approved.course.toString() === courseId &&
        approved.subject.toString() === subjectId &&
        approved.examBoard === examBoard
    );

    if (!hasAccess) {
      return next(
        new ErrorResponse(
          "Access denied. Please request course access from administrator.",
          403
        )
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};
