const User = require("../models/User");
const ErrorResponse = require("../utils/errorResponse");
const asyncHandler = require("../middleware/async");
const Email = require("../utils/sendEmail");
const crypto = require("crypto");
const Teacher = require("../models/Teacher");
// @desc    Register user
// @route   POST /api/v1/auth/register
// @access  Public

exports.register = asyncHandler(async (req, res, next) => {
  const { name, email, password, role } = req.body;

  try {
    // Try to create the user
    const user = await User.create({
      name,
      email,
      password,
      role,
    });

    // If success, send token
    sendTokenResponse(user, 200, res);
  } catch (err) {
    // Check for duplicate key error
    if (err.code === 11000 && err.keyPattern?.email) {
      return res.status(400).json({
        success: false,
        message: "Email already exists. Please use a different one.",
      });
    }
++
    // For any other error
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Server Error. Please try again later.",
    });
  }
});

// @desc    Login user
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new ErrorResponse("Please provide an email and password", 400));
  }

  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    return next(new ErrorResponse("Invalid credentials", 401));
  }

  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    return next(new ErrorResponse("Invalid credentials", 401));
  }

  let profileExists = false;
  if (user.role === "teacher") {
    profileExists = !!(await Teacher.exists({ user: user._id }));
  }

  sendTokenResponse(user, 200, res, profileExists);
});

// @desc    Log user out / clear cookie
// @route   GET /api/v1/auth/logout
// @access  Private
exports.logout = asyncHandler(async (req, res, next) => {
  res.cookie("token", "none", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Get current logged in user
// @route   GET /api/v1/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res, next) => {
  try {
    // Check if req.user exists
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: No user ID provided.",
      });
    }

    // Find user by ID
    const user = await User.findById(req.user.id).select("-password"); // Exclude password if needed

    // If user not found
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Send success response
    res.status(200).json({
      success: true,
      data: user,
    });

  } catch (err) {
    console.error("Error fetching user profile:", err.message);
    
    // Handle invalid ObjectId (e.g., if req.user.id is malformed)
    if (err.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    // Default internal server error
    res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
});
// @desc    Update user details
// @route   PUT /api/auth/updatedetails
// @access  Private
exports.updateDetails = asyncHandler(async (req, res, next) => {
  const fieldsToUpdate = {
    name: req.body.name,
    email: req.body.email,
  };

  const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    data: user,
  });
});

// @desc    Update user password
// @route   PUT /api/v1/auth/updatepassword
// @access  Private
exports.updatePassword = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).select("+password");

  // Check current password
  if (!(await user.matchPassword(req.body.currentPassword))) {
    return next(new ErrorResponse("Current password is incorrect", 401));
  }

  // Update password
  user.password = req.body.newPassword;
  await user.save();

  // Send confirmation email
  try {
    const email = new Email(user, `${req.protocol}://${req.get("host")}/login`);
    await email.sendPasswordChangeConfirmation();
  } catch (err) {
    console.error("Password change confirmation email failed:", err);
  }

  sendTokenResponse(user, 200, res);
});

// @desc    Forgot password
// @route   POST /api/v1/auth/forgotpassword
// @access  Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return res.status(200).json({
      success: true,
      data: "If an account exists with this email, a reset link has been sent"
    });
  }

  const resetToken = user.getResetPasswordToken();
  await user.save({ validateBeforeSave: false });

const resetUrl = `${process.env.HOST}/reset-password/${resetToken}`;
console.log(resetUrl);
  try {
    const email = new Email(user, resetUrl);
    await email.sendPasswordReset();

    res.status(200).json({
      success: true,
      data: "Password reset link sent to email"
    });
  } catch (err) {
    console.error('Full controller error:', {
      error: err.message,
      stack: err.stack,
      userEmail: user.email,
      resetUrl
    });

    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });

    return next(new ErrorResponse(`Email could not be sent: ${err.message}`, 500));
  }
});

// @desc    Reset password
// @route   PUT /api/v1/auth/resetpassword/:token
// @access  Public
exports.resetPassword = asyncHandler(async (req, res, next) => {
  console.log("Request body:",req.body);
  const tokenParam = req.params.resettoken || req.params.token;
  if (!tokenParam) {
    return next(new ErrorResponse("Token not provided", 400));
  }

  const hashedToken = crypto
    .createHash("sha256")
    .update(tokenParam)
    .digest("hex");

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() }
  });

  if (!user) {
    return next(new ErrorResponse("Invalid or expired token", 400));
  }

  user.password = req.body.newPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  sendTokenResponse(user, 200, res);
});

// Get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res, profileExists = null) => {
  // Create token
  const token = user.getSignedJwtToken();

  const options = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };

  if (process.env.NODE_ENV === "production") {
    options.secure = true;
  }

  res
    .status(statusCode)
    .cookie("token", token, options)
    .json({
      success: true,
      token,
      role: user.role,
      profileExists, // <-- Added here
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
};