const User = require("../models/User");
const ErrorResponse = require("../utils/errorResponse");
const asyncHandler = require("../middleware/async");
const Email = require("../utils/sendEmail");
const crypto = require("crypto");
const Teacher = require("../models/Teacher");
const { initializeWallet } = require("../middleware/wallet");
const Wallet = require("../models/Wallet");
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

    // Generate verification token
    const verificationToken = user.getVerificationToken();
    await user.save({ validateBeforeSave: false });
    await initializeWallet(user._id);
    // Create verification URL
    const frontendUrl =
      process.env.NODE_ENV === "production"
        ? process.env.HOST
        : process.env.FRONTEND_URL;

    const verificationUrl = `${frontendUrl}/verify-email/${verificationToken}`;
    try {
      // Send verification email
      const emailService = new Email(user, null, null, verificationUrl);
      await emailService.sendVerificationEmail();

      res.status(200).json({
        success: true,
        message:
          "Registration successful. Please check your email to verify your account.",
      });
    } catch (emailError) {
      console.error("Email sending error:", emailError);
      // If email fails, still respond with success but note the issue
      res.status(200).json({
        success: true,
        message:
          "Registration successful. Verification email could not be sent. Please contact support.",
      });
    }
  } catch (err) {
    // Check for duplicate key error
    if (err.code === 11000 && err.keyPattern?.email) {
      return res.status(400).json({
        success: false,
        message: "Email already exists. Please use a different one.",
      });
    }

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

  const user = await User.findOne({ email }).select(
    "name email role isVerified password"
  );

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

  // ✅ Fetch wallet balance
  const wallet = await Wallet.findOne({ user: user._id });
  const balance = wallet ? wallet.balance : 0;

  sendTokenResponse(user, 200, res, profileExists, balance);
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
    const wallet = await Wallet.findOne({ user: req.user.id });
    const balance = wallet ? wallet.balance : 0;

    // If user not found
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }
    res.status(200).json({
      success: true,
      data: user,
      walletBalance: balance,
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
  console.log("Request email for password reset:", req.body.email);
  console.log("User found for password reset:", user);
  if (!user) {
    return res.status(200).json({
      success: true,
      data: "If an account exists with this email, a reset link has been sent",
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
      data: "Password reset link sent to email",
    });
  } catch (err) {
    console.error("Full controller error:", {
      error: err.message,
      stack: err.stack,
      userEmail: user.email,
      resetUrl,
    });

    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new ErrorResponse(`Email could not be sent: ${err.message}`, 500)
    );
  }
});

// @desc    Reset password
// @route   PUT /api/v1/auth/resetpassword/:token
// @access  Public
exports.resetPassword = asyncHandler(async (req, res, next) => {
  console.log("Request body:", req.body);
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
    resetPasswordExpire: { $gt: Date.now() },
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
const sendTokenResponse = (
  user,
  statusCode,
  res,
  profileExists = null,
  balance = 0
) => {
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
      profileExists,
      walletBalance: balance, // ✅ Added wallet balance
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
    });
};
exports.verifyEmail = asyncHandler(async (req, res, next) => {
  const { token } = req.params;

  if (!token) {
    return next(new ErrorResponse("Invalid verification token", 400));
  }

  // Hash the token to compare with stored hash
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  // Find user with matching token and not expired
  const user = await User.findOne({
    verificationToken: hashedToken,
    verificationExpire: { $gt: Date.now() },
  });

  if (!user) {
    return next(
      new ErrorResponse("Invalid or expired verification token", 400)
    );
  }

  // Update user verification status
  user.isVerified = true;
  user.verificationToken = undefined;
  user.verificationExpire = undefined;
  await user.save();

  res.status(200).json({
    success: true,
    message: "Email verified successfully. You can now log in.",
  });
});

// @desc    Resend verification email
// @route   POST /api/v1/auth/resend-verification
// @access  Public
exports.resendVerification = asyncHandler(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new ErrorResponse("Please provide an email", 400));
  }

  const user = await User.findOne({ email });

  if (!user) {
    return next(new ErrorResponse("User not found", 404));
  }

  if (user.isVerified) {
    return next(new ErrorResponse("Email is already verified", 400));
  }

  // Generate new verification token
  const verificationToken = user.getVerificationToken();
  await user.save({ validateBeforeSave: false });

  // Create verification URL
  const verificationUrl = `${req.protocol}://${req.get(
    "host"
  )}/api/auth/verify-email/${verificationToken}`;

  try {
    // Send verification email
    const emailService = new Email(user, verificationUrl);
    await emailService.sendVerificationEmail();

    res.status(200).json({
      success: true,
      message: "Verification email sent successfully.",
    });
  } catch (error) {
    console.error("Email sending error:", error);
    return next(new ErrorResponse("Email could not be sent", 500));
  }
});

exports.resendVerificationRequest = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  if (user.isVerified) {
    return res.status(400).json({
      success: false,
      message: "Account is already verified",
    });
  }

  // Check if verification token is still valid
  if (user.verificationExpire && user.verificationExpire > Date.now()) {
    return res.status(400).json({
      success: false,
      message:
        "Verification email already sent. Please wait before requesting another one.",
    });
  }

  // Generate new verification token
  const verificationToken = user.getVerificationToken();
  await user.save({ validateBeforeSave: false });

  // Create verification URL
  const frontendUrl =
    process.env.NODE_ENV === "production"
      ? process.env.HOST
      : process.env.FRONTEND_URL;

  const verificationUrl = `${frontendUrl}/verify-email/${verificationToken}`;

  try {
    // Send verification email
    const emailService = new Email(user, null, null, verificationUrl);
    await emailService.sendVerificationEmail();

    res.status(200).json({
      success: true,
      message: "Verification email sent successfully",
    });
  } catch (emailError) {
    console.error("Email sending error:", emailError);

    // Reset the token if email fails
    user.verificationToken = undefined;
    user.verificationExpire = undefined;
    await user.save({ validateBeforeSave: false });

    return res.status(500).json({
      success: false,
      message: "Email could not be sent. Please try again later.",
    });
  }
});
