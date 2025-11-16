const User = require("../models/User");
const PostRequirement = require("../models/PostRequirement");
const Review = require("../models/Review");
const CourseAccessRequest = require("../models/CourseAccessRequest");
const Wallet = require("../models/Wallet");
const ErrorResponse = require("../utils/errorResponse");
const mongoose = require("mongoose");

// @desc    Get student dashboard overview
// @route   GET /api/dashboard
// @access  Private (Student)
exports.getStudentDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get all counts in parallel for better performance
    const [
      postRequirements,
      approvedCourses,
      courseAccessRequests,
      wallet,
      recentReviews,
    ] = await Promise.all([
      // Post requirements count
      PostRequirement.find({ user: userId }).countDocuments(),

      // Approved courses count from user model
      User.findById(userId).select("approvedCourses"),

      // Course access requests count
      CourseAccessRequest.find({ student: userId }).countDocuments(),

      // Wallet balance
      Wallet.findOne({ user: userId }),

      // Recent reviews (if any)
      Review.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("teacher", "name speciality"),
    ]);

    // Calculate different status counts for course access requests
    const pendingRequests = await CourseAccessRequest.countDocuments({
      student: userId,
      status: "pending",
    });
    const approvedRequests = await CourseAccessRequest.countDocuments({
      student: userId,
      status: "approved",
    });
    const rejectedRequests = await CourseAccessRequest.countDocuments({
      student: userId,
      status: "rejected",
    });

    // Get recent post requirements
    const recentPostRequirements = await PostRequirement.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("description serviceType createdAt status subjects location");

    // Get recent course access requests
    const recentCourseRequests = await CourseAccessRequest.find({
      student: userId,
    })
      .sort({ requestedAt: -1 })
      .limit(5)
      .populate("course", "name")
      .populate("subject", "name");

    const dashboardData = {
      overview: {
        totalPostRequirements: postRequirements,
        totalApprovedCourses: approvedCourses?.approvedCourses?.length || 0,
        totalCourseRequests: courseAccessRequests,
        walletBalance: wallet?.balance || 0,
      },
      courseRequests: {
        pending: pendingRequests,
        approved: approvedRequests,
        rejected: rejectedRequests,
        total: courseAccessRequests,
      },
      recentActivity: {
        postRequirements: recentPostRequirements,
        courseRequests: recentCourseRequests,
        reviews: recentReviews,
      },
      quickStats: {
        activePostRequirements: await PostRequirement.countDocuments({
          user: userId,
          isVerified: true,
        }),
        completedCourses: approvedCourses?.approvedCourses?.length || 0,
        totalSpent: await calculateTotalSpent(userId),
        averageRating: await calculateAverageRating(userId),
      },
    };

    res.status(200).json({
      success: true,
      data: dashboardData,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    next(error);
  }
};

// @desc    Get detailed student statistics
// @route   GET /api/dashboard/stats
// @access  Private (Student)
exports.getStudentStats = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const stats = await Promise.all([
      // Post requirements by service type
      PostRequirement.aggregate([
        { $match: { user: new mongoose.Types.ObjectId(userId) } }, // Fixed: added 'new' keyword
        {
          $group: {
            _id: "$serviceType",
            count: { $sum: 1 },
          },
        },
      ]),

      // Course requests by status
      CourseAccessRequest.aggregate([
        { $match: { student: new mongoose.Types.ObjectId(userId) } }, // Fixed: added 'new' keyword
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),

      // Monthly post requirements (last 6 months)
      getMonthlyPostRequirements(userId),

      // Approved courses by subject
      getApprovedCoursesBySubject(userId),

      // Wallet transaction summary
      getWalletSummary(userId),
    ]);

    const [
      postRequirementsByType,
      courseRequestsByStatus,
      monthlyPosts,
      coursesBySubject,
      walletSummary,
    ] = stats;

    const detailedStats = {
      postRequirements: {
        byType: postRequirementsByType,
        monthlyTrend: monthlyPosts,
        total: await PostRequirement.countDocuments({ user: userId }),
      },
      courseAccess: {
        byStatus: courseRequestsByStatus,
        total: await CourseAccessRequest.countDocuments({ student: userId }),
      },
      learning: {
        bySubject: coursesBySubject,
        totalApproved: await User.findById(userId).then(
          (user) => user?.approvedCourses?.length || 0
        ),
      },
      wallet: walletSummary,
    };

    res.status(200).json({
      success: true,
      data: detailedStats,
    });
  } catch (error) {
    console.error("Stats error:", error);
    next(error);
  }
};

// Helper functions
const calculateTotalSpent = async (userId) => {
  const wallet = await Wallet.findOne({ user: userId });
  if (!wallet) return 0;

  const debitTransactions = wallet.transactions.filter(
    (transaction) =>
      transaction.type === "debit" || transaction.type === "purchase"
  );

  return debitTransactions.reduce((total, transaction) => {
    return total + Math.abs(transaction.amount);
  }, 0);
};

const calculateAverageRating = async (userId) => {
  const reviews = await Review.find({ user: userId });
  if (reviews.length === 0) return 0;

  const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
  return (totalRating / reviews.length).toFixed(1);
};

const getMonthlyPostRequirements = async (userId) => {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  return PostRequirement.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId), // Fixed: added 'new' keyword
        createdAt: { $gte: sixMonthsAgo },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        },
        count: { $sum: 1 },
      },
    },
    {
      $sort: { "_id.year": 1, "_id.month": 1 },
    },
    {
      $limit: 6,
    },
  ]);
};

const getApprovedCoursesBySubject = async (userId) => {
  const user = await User.findById(userId)
    .populate("approvedCourses.subject", "name")
    .select("approvedCourses");

  if (!user?.approvedCourses) return [];

  const subjectCount = {};
  user.approvedCourses.forEach((course) => {
    const subjectName = course.subject?.name || "Unknown";
    subjectCount[subjectName] = (subjectCount[subjectName] || 0) + 1;
  });

  return Object.entries(subjectCount).map(([name, count]) => ({
    _id: name,
    count,
  }));
};

const getWalletSummary = async (userId) => {
  const wallet = await Wallet.findOne({ user: userId });
  if (!wallet) return { balance: 0, transactionCount: 0 };

  const transactionCount = wallet.transactions.length;
  const creditCount = wallet.transactions.filter(
    (t) => t.type === "credit"
  ).length;
  const debitCount = wallet.transactions.filter(
    (t) => t.type === "debit" || t.type === "purchase"
  ).length;

  return {
    balance: wallet.balance,
    transactionCount,
    creditCount,
    debitCount,
    lastTransaction:
      wallet.transactions.length > 0
        ? wallet.transactions[wallet.transactions.length - 1].createdAt
        : null,
  };
};
