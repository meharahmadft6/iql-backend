const User = require("../models/User");
const StudentPost = require("../models/PostRequirement");

// @desc    Get all students with post counts and statistics for admin
// @route   GET /api/students/admin/all-with-stats
// @access  Private/Admin
exports.getAllStudentsWithStats = async (req, res, next) => {
  try {
    // Get all students with their post counts
    const students = await User.find({ role: "student" }).select(
      "-password -verificationToken -resetPasswordToken"
    );

    const studentsWithPostCounts = await Promise.all(
      students.map(async (student) => {
        const postCount = await StudentPost.countDocuments({
          user: student._id,
        });

        return {
          ...student.toObject(),
          postCount,
        };
      })
    );

    // Get statistics
    const totalStudents = students.length;
    const verifiedStudents = students.filter(
      (student) => student.isVerified
    ).length;
    const unverifiedStudents = totalStudents - verifiedStudents;
    const totalPosts = await StudentPost.countDocuments();

    // Get most active students
    const mostActiveStudents = await StudentPost.aggregate([
      {
        $group: {
          _id: "$user",
          postCount: { $sum: 1 },
        },
      },
      { $sort: { postCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          _id: 0,
          userId: "$user._id",
          name: "$user.name",
          email: "$user.email",
          isVerified: "$user.isVerified",
          postCount: 1,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        students: {
          count: studentsWithPostCounts.length,
          data: studentsWithPostCounts,
        },
        statistics: {
          totalStudents,
          verifiedStudents,
          unverifiedStudents,
          totalPosts,
          mostActiveStudents,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get student details with all posts for admin
// @route   GET /api/students/admin/:id
// @access  Private/Admin
exports.getStudentDetails = async (req, res, next) => {
  try {
    const student = await User.findById(req.params.id).select(
      "-password -verificationToken -resetPasswordToken"
    );

    if (!student || student.role !== "student") {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const posts = await StudentPost.find({ user: req.params.id });

    res.status(200).json({
      success: true,
      data: {
        student,
        posts,
        postCount: posts.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Keep individual endpoints for flexibility
exports.getAllStudents = async (req, res, next) => {
  try {
    const students = await User.find({ role: "student" }).select(
      "-password -verificationToken -resetPasswordToken"
    );

    const studentsWithPostCounts = await Promise.all(
      students.map(async (student) => {
        const postCount = await StudentPost.countDocuments({
          user: student._id,
        });

        return {
          ...student.toObject(),
          postCount,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: studentsWithPostCounts.length,
      data: studentsWithPostCounts,
    });
  } catch (error) {
    next(error);
  }
};

exports.getStudentStats = async (req, res, next) => {
  try {
    const totalStudents = await User.countDocuments({ role: "student" });
    const verifiedStudents = await User.countDocuments({
      role: "student",
      isVerified: true,
    });
    const totalPosts = await StudentPost.countDocuments();

    const mostActiveStudents = await StudentPost.aggregate([
      {
        $group: {
          _id: "$user",
          postCount: { $sum: 1 },
        },
      },
      { $sort: { postCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          _id: 0,
          userId: "$user._id",
          name: "$user.name",
          email: "$user.email",
          isVerified: "$user.isVerified",
          postCount: 1,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalStudents,
        verifiedStudents,
        unverifiedStudents: totalStudents - verifiedStudents,
        totalPosts,
        mostActiveStudents,
      },
    });
  } catch (error) {
    next(error);
  }
};
