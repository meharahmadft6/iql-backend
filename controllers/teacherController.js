const Teacher = require("../models/Teacher");
const User = require("../models/User");
const ErrorResponse = require("../utils/errorResponse");
const asyncHandler = require("../middleware/async");
const { uploadFile, getSignedUrl, deleteFile } = require("../utils/s3");
const Email = require("../utils/sendEmail");
const Wallet = require("../models/Wallet");
// Helper function to populate teacher with signed URLs
const populateWithSignedUrls = async (teacher) => {
  const teacherObj = teacher.toObject();

  if (teacherObj.profilePhoto) {
    teacherObj.profilePhotoUrl = await getSignedUrl(teacherObj.profilePhoto);
  }

  if (teacherObj.idProofFile) {
    teacherObj.idProofUrl = await getSignedUrl(teacherObj.idProofFile);
  }

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

  // ✅ Fetch wallet balance for this teacher's user
  const wallet = await Wallet.findOne({ user: teacher.user._id });
  const balance = wallet ? wallet.balance : 0;

  const teacherWithUrls = await populateWithSignedUrls(teacher);

  res.status(200).json({
    success: true,
    data: {
      ...teacherWithUrls.toObject(),
      walletBalance: balance, // ✅ Added wallet balance
    },
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

  // Debug logging for file objects

  // Validate required files
  if (!req.files?.profilePhoto?.[0] || !req.files?.idProofFile?.[0]) {
    return next(
      new ErrorResponse("Please upload both profile photo and ID proof", 400)
    );
  }

  // Extract files from arrays
  const profilePhotoFile = req.files.profilePhoto[0];
  const idProofFile = req.files.idProofFile[0];

  // FIXED: Remove buffer validation since multer-s3 doesn't use buffers
  // Instead, validate file existence and basic properties
  if (
    !profilePhotoFile ||
    !idProofFile ||
    !profilePhotoFile.originalname ||
    !idProofFile.originalname
  ) {
    return next(
      new ErrorResponse("Invalid file format. Please upload valid files.", 400)
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

    // Upload files to S3 - Pass the correct file objects
    const [profilePhotoKey, idProofKey] = await Promise.all([
      uploadFile(profilePhotoFile, "profile-photos/"),
      uploadFile(idProofFile, "id-proofs/"),
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
    console.log("Error creating teacher profile:", err);
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

  // Ensure only owner or admin can update
  if (teacher.user.toString() !== req.user.id && req.user.role !== "admin") {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to update this teacher profile`,
        401
      )
    );
  }

  try {
    // Parse array fields if they come as strings
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
    if (req.body.willingToTravel !== undefined)
      req.body.willingToTravel = req.body.willingToTravel === "true";
    if (req.body.availableForOnline !== undefined)
      req.body.availableForOnline = req.body.availableForOnline === "true";
    if (req.body.hasDigitalPen !== undefined)
      req.body.hasDigitalPen = req.body.hasDigitalPen === "true";
    if (req.body.helpsWithHomework !== undefined)
      req.body.helpsWithHomework = req.body.helpsWithHomework === "true";
    if (req.body.currentlyEmployed !== undefined)
      req.body.currentlyEmployed = req.body.currentlyEmployed === "true";

    // Parse languages - FIXED VERSION
    if (req.body.languages !== undefined) {
      try {
        let langs = req.body.languages;

        // If it's already an array, keep it as is
        if (Array.isArray(langs)) {
          req.body.languages = langs
            .map((lang) => String(lang).trim())
            .filter((lang) => lang.length > 0);
        }
        // If it's a string, try to parse it
        else if (typeof langs === "string") {
          // First, try direct JSON parse
          try {
            let parsed = JSON.parse(langs);

            // Keep parsing nested JSON strings until we get an array
            let maxIterations = 10; // Prevent infinite loops
            let iterations = 0;

            while (typeof parsed === "string" && iterations < maxIterations) {
              parsed = JSON.parse(parsed);
              iterations++;
            }

            // If we finally have an array, clean it up
            if (Array.isArray(parsed)) {
              req.body.languages = parsed
                .map((lang) => {
                  // If the language is still a nested string, try to extract the actual language name
                  if (typeof lang === "string") {
                    // Use regex to extract clean language names from the messy string
                    const matches = lang.match(/([A-Za-z]+)(?=\\|"|$)/g);
                    return matches
                      ? matches.filter(
                          (match) =>
                            match.length > 2 &&
                            !["true", "false", "null", "undefined"].includes(
                              match.toLowerCase()
                            )
                        )
                      : [];
                  }
                  return lang;
                })
                .flat() // Flatten in case we got arrays of arrays
                .map((lang) => String(lang).trim())
                .filter((lang) => lang.length > 0 && isNaN(lang)) // Remove empty strings and numbers
                .filter((lang, index, arr) => arr.indexOf(lang) === index); // Remove duplicates
            } else {
              req.body.languages = [];
            }
          } catch (parseError) {
            // If JSON parsing fails, try to extract language names using regex
            const languageMatches = langs.match(/([A-Za-z]{3,})/g);
            if (languageMatches) {
              req.body.languages = languageMatches
                .filter(
                  (lang) =>
                    !["true", "false", "null", "undefined"].includes(
                      lang.toLowerCase()
                    )
                )
                .filter((lang, index, arr) => arr.indexOf(lang) === index); // Remove duplicates
            } else {
              req.body.languages = [];
            }
          }
        } else {
          req.body.languages = [];
        }
      } catch (e) {
        console.error("Failed to parse languages:", e);
        req.body.languages = [];
      }
    }

    // Parse numeric fields
    if (req.body.fee !== undefined) req.body.fee = Number(req.body.fee);
    if (req.body.totalExperience !== undefined)
      req.body.totalExperience = Number(req.body.totalExperience);
    if (req.body.teachingExperience !== undefined)
      req.body.teachingExperience = Number(req.body.teachingExperience);
    if (req.body.onlineTeachingExperience !== undefined)
      req.body.onlineTeachingExperience = Number(
        req.body.onlineTeachingExperience
      );

    // Handle profile photo upload (NOT CNIC/ID proof)
    if (req.file) {
      // Delete old profile photo if it exists
      if (teacher.profilePhoto) {
        try {
          await deleteFile(teacher.profilePhoto);
        } catch (deleteError) {
          console.error("Error deleting old profile photo:", deleteError);
          // Continue with update even if deletion fails
        }
      }

      // Update the profilePhoto field with the new file path
      req.body.profilePhoto = req.file.key;
    } else if (req.body.keepExistingProfilePhoto === "true") {
      // Keep existing photo - remove the field from update to prevent overwriting
      delete req.body.profilePhoto;
    }

    // If admin is approving, just update isApproved
    if (req.user.role === "admin" && req.body.isApproved !== undefined) {
      teacher.isApproved = req.body.isApproved;
      await teacher.save();

      const teacherWithUrls = await populateWithSignedUrls(teacher);
      return res.status(200).json({
        success: true,
        data: teacherWithUrls,
      });
    }

    // Perform update
    teacher = await Teacher.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    // Get signed URLs for response
    const teacherWithUrls = await populateWithSignedUrls(teacher);

    res.status(200).json({
      success: true,
      data: teacherWithUrls,
    });
  } catch (err) {
    console.log("Error updating teacher profile:", err);
    return next(
      new ErrorResponse(`Profile update failed: ${err.message}`, 500)
    );
  }
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
  const wallet = await Wallet.findOne({ user: teacher.user._id });
  const balance = wallet ? wallet.balance : 0;

  // Get signed URLs for the response
  const teacherWithUrls = await populateWithSignedUrls(teacher);

  res.status(200).json({
    success: true,
    data: teacherWithUrls,
    walletBalance: balance,
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

    // Extract the boolean value from the nested object if it exists
    const isApproved = req.body.isApproved?.isApproved ?? req.body.isApproved;

    // Find teacher by ID and populate user to get email
    const teacher = await Teacher.findById(id).populate("user", "name email");
    if (!teacher) {
      return res
        .status(404)
        .json({ success: false, message: "Teacher not found" });
    }

    // Update approval status
    teacher.isApproved = isApproved;
    await teacher.save();

    // Send email notification
    try {
      const email = new Email(teacher.user, null, isApproved); // pass populated user
      await email.sendTeacherApprovalStatus();

      console.log(
        `Approval status email sent to teacher: ${teacher.user.email}`
      );
    } catch (emailError) {
      console.error("Failed to send approval email:", {
        error: emailError.message,
        teacherId: teacher._id,
        teacherEmail: teacher.user?.email,
        isApproved,
      });
    }

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

exports.getAllPublicTeacherProfiles = asyncHandler(async (req, res, next) => {
  // Fetch only approved teachers with full details
  const teachers = await Teacher.find({ isApproved: true }).populate({
    path: "user",
    select: "name email role createdAt", // Only select necessary fields
  });

  if (!teachers || teachers.length === 0) {
    return next(new ErrorResponse("No teacher profiles found", 404));
  }

  // Add signed URLs for images/documents
  const teachersWithUrls = await Promise.all(
    teachers.map(async (teacher) => {
      const teacherObj = teacher.toObject();

      // Generate signed URLs for profile photo and ID proof
      if (teacherObj.profilePhoto) {
        teacherObj.profilePhotoUrl = await getSignedUrl(
          teacherObj.profilePhoto
        );
      }
      if (teacherObj.idProofFile) {
        teacherObj.idProofUrl = await getSignedUrl(teacherObj.idProofFile);
      }

      return teacherObj;
    })
  );
  res.status(200).json({
    success: true,
    count: teachersWithUrls.length,
    data: teachersWithUrls,
  });
});
exports.getPublicTeacherProfile = asyncHandler(async (req, res, next) => {
  const teacher = await Teacher.findOne({
    _id: req.params.id,
    isApproved: true,
  }).populate({
    path: "user",
    select: "name email role createdAt",
  });

  if (!teacher) {
    return next(
      new ErrorResponse(`Teacher not found with id of ${req.params.id}`, 404)
    );
  }

  const teacherObj = teacher.toObject();

  // Generate signed URLs
  if (teacherObj.profilePhoto) {
    teacherObj.profilePhotoUrl = await getSignedUrl(teacherObj.profilePhoto);
  }
  if (teacherObj.idProofFile) {
    teacherObj.idProofUrl = await getSignedUrl(teacherObj.idProofFile);
  }

  res.status(200).json({
    success: true,
    data: teacherObj,
  });
});
// Get all Home Tutors (willingToTravel: true)
exports.getHomeTutors = asyncHandler(async (req, res, next) => {
  const teachers = await Teacher.find({
    isApproved: true,
    willingToTravel: true,
  }).populate({
    path: "user",
    select: "name email role createdAt",
  });

  if (!teachers || teachers.length === 0) {
    return next(new ErrorResponse("No home tutors found", 404));
  }

  const teachersWithUrls = await Promise.all(
    teachers.map(async (teacher) => {
      const teacherObj = teacher.toObject();

      if (teacherObj.profilePhoto) {
        teacherObj.profilePhotoUrl = await getSignedUrl(
          teacherObj.profilePhoto
        );
      }
      if (teacherObj.idProofFile) {
        teacherObj.idProofUrl = await getSignedUrl(teacherObj.idProofFile);
      }

      return teacherObj;
    })
  );
  // console.log(teachersWithUrls);

  res.status(200).json({
    success: true,
    count: teachersWithUrls.length,
    data: teachersWithUrls,
  });
});

// Get all Online Teachers (availableForOnline: true)
exports.getOnlineTeachers = asyncHandler(async (req, res, next) => {
  const teachers = await Teacher.find({
    isApproved: true,
    availableForOnline: true,
  }).populate({
    path: "user",
    select: "name email role createdAt",
  });

  if (!teachers || teachers.length === 0) {
    return next(new ErrorResponse("No online teachers found", 404));
  }

  const teachersWithUrls = await Promise.all(
    teachers.map(async (teacher) => {
      const teacherObj = teacher.toObject();

      if (teacherObj.profilePhoto) {
        teacherObj.profilePhotoUrl = await getSignedUrl(
          teacherObj.profilePhoto
        );
      }
      if (teacherObj.idProofFile) {
        teacherObj.idProofUrl = await getSignedUrl(teacherObj.idProofFile);
      }

      return teacherObj;
    })
  );

  res.status(200).json({
    success: true,
    count: teachersWithUrls.length,
    data: teachersWithUrls,
  });
});

// Get all Teachers who help with Homework (helpsWithHomework: true)
exports.getHomeworkHelpers = asyncHandler(async (req, res, next) => {
  const teachers = await Teacher.find({
    isApproved: true,
    helpsWithHomework: true,
  }).populate({
    path: "user",
    select: "name email role createdAt",
  });

  if (!teachers || teachers.length === 0) {
    return next(new ErrorResponse("No teachers for homework help found", 404));
  }

  const teachersWithUrls = await Promise.all(
    teachers.map(async (teacher) => {
      const teacherObj = teacher.toObject();

      if (teacherObj.profilePhoto) {
        teacherObj.profilePhotoUrl = await getSignedUrl(
          teacherObj.profilePhoto
        );
      }
      if (teacherObj.idProofFile) {
        teacherObj.idProofUrl = await getSignedUrl(teacherObj.idProofFile);
      }

      return teacherObj;
    })
  );

  res.status(200).json({
    success: true,
    count: teachersWithUrls.length,
    data: teachersWithUrls,
  });
});
exports.getTeachersBySubjectAndLocation = asyncHandler(
  async (req, res, next) => {
    const { subject, location } = req.query;

    let baseQuery = { isApproved: true };
    let conditions = [];

    if (subject) {
      conditions.push({
        subjects: {
          $elemMatch: { name: { $regex: subject, $options: "i" } },
        },
      });
    }

    if (location) {
      const locationKeyword = location.split(",")[0].trim(); // e.g. "Lahore"
      conditions.push({
        location: { $regex: locationKeyword, $options: "i" },
      });
    }

    // Apply filters
    if (conditions.length > 0) {
      baseQuery.$or = conditions;
    }

    let teachers = await Teacher.find(baseQuery)
      .populate({ path: "user", select: "name email role createdAt" })
      .populate("subjects")
      .populate("education")
      .populate("experience");

    // If no teachers found, suggest relative results instead of error
    if (!teachers || teachers.length === 0) {
      let fallbackQuery = { isApproved: true };

      if (subject) {
        fallbackQuery["subjects"] = {
          $elemMatch: {
            name: { $regex: subject.split(" ")[0], $options: "i" },
          },
        };
      } else if (location) {
        fallbackQuery["location"] = {
          $regex: location.split(" ")[0], // broader location search
          $options: "i",
        };
      }

      teachers = await Teacher.find(fallbackQuery)
        .populate({ path: "user", select: "name email role createdAt" })
        .populate("subjects")
        .populate("education")
        .populate("experience");
    }

    // Rank results if both subject + location are present
    if (subject && location) {
      teachers = teachers.sort((a, b) => {
        const subjectRegex = new RegExp(subject, "i");
        const locationRegex = new RegExp(location, "i");

        const aScore =
          (a.subjects.some((s) => subjectRegex.test(s.name)) ? 1 : 0) +
          (locationRegex.test(a.location) ? 1 : 0);

        const bScore =
          (b.subjects.some((s) => subjectRegex.test(s.name)) ? 1 : 0) +
          (locationRegex.test(b.location) ? 1 : 0);

        return bScore - aScore;
      });
    }

    // Add signed URLs for images/files
    const teachersWithUrls = await Promise.all(
      teachers.map(async (teacher) => {
        const teacherObj = teacher.toObject();

        if (teacherObj.profilePhoto) {
          teacherObj.profilePhotoUrl = await getSignedUrl(
            teacherObj.profilePhoto
          );
        }
        if (teacherObj.idProofFile) {
          teacherObj.idProofUrl = await getSignedUrl(teacherObj.idProofFile);
        }

        return teacherObj;
      })
    );

    return res.status(200).json({
      success: true,
      count: teachersWithUrls.length,
      data: teachersWithUrls,
      message:
        teachersWithUrls.length > 0
          ? "Teachers fetched successfully"
          : "No exact matches found, showing relative suggestions",
    });
  }
);
