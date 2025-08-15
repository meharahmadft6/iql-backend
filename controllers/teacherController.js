const Teacher = require("../models/Teacher");
const User = require("../models/User");
const ErrorResponse = require("../utils/errorResponse");
const asyncHandler = require("../middleware/async");
const { uploadFile, getSignedUrl, deleteFile } = require("../utils/s3");

// Helper function to populate teacher with signed URLs
const populateWithSignedUrls = async (teacher) => {
  if (!teacher) return teacher;

  const teacherObj = teacher.toObject ? teacher.toObject() : teacher;

  // Get signed URLs for photos
  teacherObj.profilePhotoUrl = await getSignedUrl(teacher.profilePhoto);
  teacherObj.idProofUrl = await getSignedUrl(teacher.idProofFile);

  // Remove S3 keys from response
  delete teacherObj.profilePhoto;
  delete teacherObj.idProofFile;

  return teacherObj;
};

// @desc    Get all teachers (admin only)
// @route   GET /api/v1/teachers
// @access  Private/Admin
exports.getTeachers = asyncHandler(async (req, res, next) => {
  // Get teachers without signed URLs first
  let teachers = await Teacher.find().populate({
    path: "user",
    select: "name email",
  });

  // Process each teacher to add signed URLs
  teachers = await Promise.all(
    teachers.map(async (teacher) => {
      // Only show profile if approved or if the request is from the owner or admin
      if (
        !teacher.isApproved &&
        (!req.user ||
          (req.user.role !== "admin" &&
            teacher.user.toString() !== req.user.id))
      ) {
        return null; // Skip unapproved profiles for non-owners/admins
      }
      return await populateWithSignedUrls(teacher);
    })
  );

  // Filter out null values (unapproved profiles)
  teachers = teachers.filter((teacher) => teacher !== null);

  res.status(200).json({
    success: true,
    count: teachers.length,
    data: teachers,
  });
});

// @desc    Get single teacher
// @route   GET /api/v1/teachers/:id
// @access  Public
exports.getTeacher = asyncHandler(async (req, res, next) => {
  const teacher = await Teacher.findById(req.params.id).populate({
    path: "user",
    select: "name email",
  });

  if (!teacher) {
    return next(
      new ErrorResponse(`Teacher not found with id of ${req.params.id}`, 404)
    );
  }

  // Only show profile if approved or if the request is from the owner or admin
  // if (
  //   !teacher.isApproved &&
  //   (!req.user ||
  //     (req.user.role !== "admin" && teacher.user.toString() !== req.user.id))
  // ) {
  //   return next(
  //     new ErrorResponse(`This teacher profile is not approved yet`, 403)
  //   );
  // }

  const teacherWithUrls = await populateWithSignedUrls(teacher);
  // console.log(teacherWithUrls);
  res.status(200).json({
    success: true,
    data: teacherWithUrls,
  });
});

// @desc    Create teacher profile
// @route   POST /api/v1/teachers
// @access  Private (Teacher only)
exports.createTeacherProfile = asyncHandler(async (req, res, next) => {
  // Check if user is a teacher
  if (req.user.role !== "teacher") {
    return next(
      new ErrorResponse(
        `User with role ${req.user.role} is not authorized to create a teacher profile`,
        403
      )
    );
  }

  // Check if profile already exists
  const existingProfile = await Teacher.findOne({ user: req.user.id });
  if (existingProfile) {
    return next(
      new ErrorResponse(
        `Teacher profile already exists for user ${req.user.id}`,
        400
      )
    );
  }

  // Add user to req.body
  req.body.user = req.user.id;

  // Validate required files
  if (!req.files?.profilePhoto || !req.files?.idProofFile) {
    return next(
      new ErrorResponse("Please upload both profile photo and ID proof", 400)
    );
  }

  try {
    // Parse array fields from strings to objects
    if (typeof req.body.subjects === "string") {
      req.body.subjects = JSON.parse(req.body.subjects);
    }
    if (typeof req.body.education === "string") {
      req.body.education = JSON.parse(req.body.education);
    }
    if (typeof req.body.experience === "string") {
      req.body.experience = JSON.parse(req.body.experience);
    }

    // Parse boolean fields
    req.body.willingToTravel = req.body.willingToTravel === "true";
    req.body.availableForOnline = req.body.availableForOnline === "true";
    req.body.hasDigitalPen = req.body.hasDigitalPen === "true";
    req.body.helpsWithHomework = req.body.helpsWithHomework === "true";
    req.body.currentlyEmployed = req.body.currentlyEmployed === "true";

    // Parse languages string to array
    if (typeof req.body.languages === "string") {
      req.body.languages = req.body.languages
        .split(",")
        .map((lang) => lang.trim());
    }

    // Parse numeric fields
    req.body.fee = Number(req.body.fee);
    req.body.totalExperience = Number(req.body.totalExperience);
    req.body.teachingExperience = Number(req.body.teachingExperience);
    req.body.onlineTeachingExperience = Number(
      req.body.onlineTeachingExperience
    );

    // Upload files to S3
    const [profilePhotoKey, idProofKey] = await Promise.all([
      uploadFile(req.files.profilePhoto, "profile-photos/"),
      uploadFile(req.files.idProofFile, "id-proofs/"),
    ]);

    // Add file keys to request body
    req.body.profilePhoto = profilePhotoKey;
    req.body.idProofFile = idProofKey;

    // Create teacher profile
    const teacher = await Teacher.create(req.body);

    // Generate signed URLs for the response
    const [profilePhotoUrl, idProofUrl] = await Promise.all([
      getSignedUrl(profilePhotoKey),
      getSignedUrl(idProofKey),
    ]);

    // Prepare response data
    const responseData = {
      ...teacher.toObject(),
      profilePhotoUrl,
      idProofUrl,
    };

    // Remove S3 keys from response
    delete responseData.profilePhoto;
    delete responseData.idProofFile;

    res.status(201).json({
      success: true,
      data: responseData,
    });
  } catch (err) {
    // Clean up any uploaded files if creation fails
    if (req.body.profilePhoto) await deleteFile(req.body.profilePhoto);
    if (req.body.idProofFile) await deleteFile(req.body.idProofFile);

    return next(
      new ErrorResponse(`Profile creation failed: ${err.message}`, 500)
    );
  }
});
// @desc    Update teacher profile
// @route   PUT /api/v1/teachers/:id
// @access  Private (Teacher owner or admin)
exports.updateTeacherProfile = asyncHandler(async (req, res, next) => {
  let teacher = await Teacher.findById(req.params.id);

  if (!teacher) {
    return next(
      new ErrorResponse(`Teacher not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is teacher owner or admin
  if (teacher.user.toString() !== req.user.id && req.user.role !== "admin") {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to update this teacher profile`,
        401
      )
    );
  }

  // Handle file uploads if they exist
  if (req.files) {
    // Delete old files from S3 if new ones are being uploaded
    if (req.files.profilePhoto) {
      await deleteFile(teacher.profilePhoto);
      req.body.profilePhoto = await uploadFile(
        req.files.profilePhoto,
        "profile-photos/"
      );
    }
    if (req.files.idProofFile) {
      await deleteFile(teacher.idProofFile);
      req.body.idProofFile = await uploadFile(
        req.files.idProofFile,
        "id-proofs/"
      );
    }
  }

  // If admin is approving, set isApproved
  if (req.user.role === "admin" && req.body.isApproved !== undefined) {
    teacher.isApproved = req.body.isApproved;
    await teacher.save();

    const teacherWithUrls = await populateWithSignedUrls(teacher);
    return res.status(200).json({
      success: true,
      data: teacherWithUrls,
    });
  }

  // For regular updates
  teacher = await Teacher.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  // Get signed URLs for the response
  const teacherWithUrls = await populateWithSignedUrls(teacher);

  res.status(200).json({
    success: true,
    data: teacherWithUrls,
  });
});

// @desc    Delete teacher profile
// @route   DELETE /api/v1/teachers/:id
// @access  Private (Teacher owner or admin)
exports.deleteTeacherProfile = asyncHandler(async (req, res, next) => {
  const teacher = await Teacher.findById(req.params.id);

  if (!teacher) {
    return next(
      new ErrorResponse(`Teacher not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is teacher owner or admin
  if (teacher.user.toString() !== req.user.id && req.user.role !== "admin") {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to delete this teacher profile`,
        401
      )
    );
  }

  // Delete files from S3
  await deleteFile(teacher.profilePhoto);
  await deleteFile(teacher.idProofFile);

  await teacher.remove();

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Get current user's teacher profile
// @route   GET /api/v1/teachers/me
// @access  Private (Teacher only)
exports.getMyProfile = asyncHandler(async (req, res, next) => {
  // Check if user is a teacher
  if (req.user.role !== "teacher") {
    return next(
      new ErrorResponse(
        `User with role ${req.user.role} is not authorized to access this route`,
        403
      )
    );
  }

  const teacher = await Teacher.findOne({ user: req.user.id }).populate({
    path: "user",
    select: "name email",
  });

  if (!teacher) {
    return next(
      new ErrorResponse(
        `Teacher profile not found for user ${req.user.id}`,
        404
      )
    );
  }

  // Get signed URLs for the response
  const teacherWithUrls = await populateWithSignedUrls(teacher);

  res.status(200).json({
    success: true,
    data: teacherWithUrls,
  });
});
exports.getAllTeacherProfiles = asyncHandler(async (req, res, next) => {
  // Fetch all teachers with full details
  const teachers = await Teacher.find().populate({
    path: "user",
    // Select all fields except password and sensitive stuff
    select: "-password -resetPasswordToken -resetPasswordExpire",
  });

  if (!teachers || teachers.length === 0) {
    return next(new ErrorResponse("No teacher profiles found", 404));
  }

  // Add signed URLs for images/documents/etc.
  const teachersWithUrls = await Promise.all(
    teachers.map((teacher) => populateWithSignedUrls(teacher))
  );

  res.status(200).json({
    success: true,
    count: teachersWithUrls.length,
    data: teachersWithUrls,
  });
});

// @desc    Approve / Unapprove a teacher
// @route   PATCH /api/teachers/approve/:id
// @access  Admin (or whoever is allowed)
exports.approveTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(req.body);

    // Extract the boolean value from the nested object if it exists
    const isApproved = req.body.isApproved?.isApproved ?? req.body.isApproved;

    // Find teacher by ID
    const teacher = await Teacher.findById(id);
    if (!teacher) {
      return res
        .status(404)
        .json({ success: false, message: "Teacher not found" });
    }

    // Update approval status
    teacher.isApproved = isApproved;
    await teacher.save();

    res.status(200).json({
      success: true,
      message: `Teacher has been ${
        isApproved ? "approved" : "unapproved"
      } successfully`,
      data: teacher,
    });
  } catch (error) {
    console.error("Error approving teacher:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
