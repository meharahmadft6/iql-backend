// controllers/postRequirements.js
const PostRequirement = require("../models/PostRequirement");
const User = require("../models/User");
const { getSignedUrl } = require("../utils/s3");
const Email = require("../utils/sendEmail");
// @desc    Create a new tutor request (with auto user creation if needed)
// @route   POST /api/post-requirements
// @access  Public (for unauthenticated users) / Private (for authenticated)
exports.createPostRequirement = async (req, res, next) => {
  try {
    let user;
    let newUserCreated = false;
    let token;
    console.log(req.body);
    // Validate request body exists
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Request body is empty or malformed",
      });
    }

    if (req.user) {
      // ✅ User is logged in
      user = req.user;

      if (user.role !== "student") {
        return res.status(403).json({
          success: false,
          message: "Only students can create post requirements",
        });
      }
    } else {
      // ✅ User not logged in → create new account
      const { email, password, name, location } = req.body;

      if (!email || !password || !name) {
        return res.status(400).json({
          success: false,
          message:
            "Please provide email, password, and name to create an account",
        });
      }

      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid email address",
        });
      }

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User already exists. Please login first.",
        });
      }

      if (!location || !req.body["phone.number"]) {
        return res.status(400).json({
          success: false,
          message: "Please provide location and phone number",
        });
      }

      user = await User.create({
        email,
        password,
        name,
        location,
        role: "student",
      });

      // Generate verification token and save user
      const verificationToken = user.getVerificationToken();
      await user.save({ validateBeforeSave: false });
      token = user.getSignedJwtToken();
      // Send verification email for new users
      try {
        const frontendUrl =
          process.env.NODE_ENV === "production"
            ? process.env.HOST
            : process.env.FRONTEND_URL;

        const verificationUrl = `${frontendUrl}/verify-email/${verificationToken}`;
        const emailService = new Email(user, null, null, verificationUrl);
        await emailService.sendVerificationEmail();
        console.log("Verification email sent to:", user.email);
      } catch (emailError) {
        console.error("Email sending error:", emailError);
        // Continue even if email fails to send
      }

      newUserCreated = true;
    }

    // ✅ Required fields validation (for both logged in and new users)
    const { description, serviceType, employmentType, location } = req.body;

    if (!description || !serviceType || !employmentType || !location) {
      return res.status(400).json({
        success: false,
        message:
          "Please provide description, service type, employment type, and location",
      });
    }

    // Phone number is required for both logged in and new users in the post requirement
    if (!req.body["phone.number"]) {
      return res.status(400).json({
        success: false,
        message: "Please provide phone number",
      });
    }

    if (!req.body["budget.amount"] || !req.body["budget.frequency"]) {
      return res.status(400).json({
        success: false,
        message: "Please provide budget amount and frequency",
      });
    }

    // ✅ Transform req.body → schema format
    const postData = {
      description,
      serviceType,
      employmentType,
      budget: {
        currency: req.body["budget.currency"] || "PKR",
        amount: parseFloat(req.body["budget.amount"]),
        frequency: req.body["budget.frequency"],
      },
      meetingOptions: [],
      languages: [],
      subjects: [],
      user: user._id,
      location,
      phone: {
        countryCode: req.body["phone.countryCode"] || "+92",
        number: req.body["phone.number"],
      },
    };

    if (isNaN(postData.budget.amount) || postData.budget.amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid budget amount",
      });
    }

    // ✅ Parse meetingOptions[]
    Object.keys(req.body).forEach((key) => {
      if (key.startsWith("meetingOptions[")) {
        postData.meetingOptions.push(req.body[key]);
      }
    });

    // ✅ Meeting Options
    if (
      Array.isArray(req.body.meetingOptions) &&
      req.body.meetingOptions.length > 0
    ) {
      postData.meetingOptions = req.body.meetingOptions;
    } else {
      return res.status(400).json({
        success: false,
        message: "Please select at least one meeting option",
      });
    }

    // ✅ Languages
    if (Array.isArray(req.body.languages) && req.body.languages.length > 0) {
      postData.languages = req.body.languages.map((lang) => lang.trim());
    } else {
      return res.status(400).json({
        success: false,
        message: "Please select at least one preferred language",
      });
    }

    // ✅ Subjects
    if (Array.isArray(req.body.subjects) && req.body.subjects.length > 0) {
      const validSubjects = req.body.subjects.filter(
        (subject) => subject.name && subject.name.trim() && subject.level
      );

      if (validSubjects.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Please provide at least one subject with name and level",
        });
      }

      postData.subjects = validSubjects;
    } else {
      return res.status(400).json({
        success: false,
        message: "Please provide at least one subject",
      });
    }

    // Enhanced file handling
    if (req.file) {
      try {
        // For direct S3 upload, the file key is available in req.file.key
        postData.image = req.file.key; // This is the S3 object key
      } catch (uploadErr) {
        console.error("S3 Upload Failed:", uploadErr);
        return res.status(500).json({
          success: false,
          message: "Image upload failed: " + uploadErr.message,
        });
      }
    }

    // ✅ Save Post Requirement
    const postRequirement = await PostRequirement.create(postData);

    if (newUserCreated) {
      // For new users, return token and user data like login
      const responseData = {
        success: true,
        token,
        role: user.role,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified,
        },
        postRequirement: {
          _id: postRequirement._id,
          description: postRequirement.description,
          subjects: postRequirement.subjects,
          serviceType: postRequirement.serviceType,
          meetingOptions: postRequirement.meetingOptions,
          budget: postRequirement.budget,
          employmentType: postRequirement.employmentType,
          languages: postRequirement.languages,
          phone: postRequirement.phone,
          location: postRequirement.location,
          isVerified: postRequirement.isVerified,
          createdAt: postRequirement.createdAt,
        },
        message:
          "Account created and post requirement submitted successfully. Please check your email to verify your account.",
      };

      return res.status(201).json(responseData);
    } else {
      // For existing users, return the original response
      return res.status(201).json({
        success: true,
        data: postRequirement,
        message: "Post requirement created successfully.",
      });
    }
  } catch (err) {
    console.error("Error creating post requirement:", err);

    // Handle specific stream errors
    if (err.message && err.message.includes("Unexpected end of form")) {
      return res.status(400).json({
        success: false,
        message: "Upload was interrupted. Please try again.",
      });
    }

    if (err.name === "ValidationError") {
      const messages = Object.values(err.errors).map((error) => error.message);
      return res.status(400).json({
        success: false,
        message: messages.join(". "),
      });
    }

    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "A post requirement with this data already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server Error. Please try again later.",
    });
  }
};

exports.getPostRequirements = async (req, res, next) => {
  try {
    // Copy req.query
    const reqQuery = { ...req.query };

    // Fields to exclude from filters
    const removeFields = ["select", "sort", "page", "limit"];
    removeFields.forEach((param) => delete reqQuery[param]);

    // Convert query operators ($gt, $in, etc.)
    let queryStr = JSON.stringify(reqQuery);
    queryStr = queryStr.replace(
      /\b(gt|gte|lt|lte|in)\b/g,
      (match) => `$${match}`
    );

    // Pagination setup
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 15;
    const startIndex = (page - 1) * limit;

    // Base query with population
    let query = PostRequirement.find(JSON.parse(queryStr)).populate({
      path: "user",
      select: "name email role isVerified",
      match: { role: "student", isVerified: true }, // only verified students
    });

    // Select Fields
    if (req.query.select) {
      const fields = req.query.select.split(",").join(" ");
      query = query.select(fields);
    }

    // Sort
    if (req.query.sort) {
      const sortBy = req.query.sort.split(",").join(" ");
      query = query.sort(sortBy);
    } else {
      query = query.sort("-createdAt");
    }

    // ✅ Apply pagination
    query = query.skip(startIndex).limit(limit);

    // Run query
    let postRequirements = await query;

    // ❌ Remove posts where populate didn't match
    postRequirements = postRequirements.filter((post) => post.user);

    // ✅ Auto-verify posts from verified users
    const postsToUpdate = postRequirements.filter(
      (post) => post.user.isVerified && !post.isVerified
    );

    if (postsToUpdate.length > 0) {
      const postIds = postsToUpdate.map((post) => post._id);
      await PostRequirement.updateMany(
        { _id: { $in: postIds } },
        { $set: { isVerified: true } }
      );
    }

    // Add signed URL + sync isVerified with user
    const postsWithUrls = await Promise.all(
      postRequirements.map(async (post) => {
        const obj = post.toObject();
        obj.isVerified = post.user.isVerified;

        if (obj.image) {
          obj.imageUrl = await getSignedUrl(obj.image);
        }
        return obj;
      })
    );

    // ✅ Get total count of verified student posts (without pagination)
    const allPosts = await PostRequirement.find(JSON.parse(queryStr)).populate({
      path: "user",
      match: { role: "student", isVerified: true },
    });
    const total = allPosts.filter((post) => post.user).length;

    // Pagination info
    const pagination = {};
    const totalPages = Math.ceil(total / limit);
    if (page < totalPages) pagination.next = { page: page + 1, limit };
    if (page > 1) pagination.prev = { page: page - 1, limit };

    res.status(200).json({
      success: true,
      count: postsWithUrls.length,
      total,
      totalPages,
      pagination,
      data: postsWithUrls,
    });
    console.log(totalPages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// @desc    Get single post requirement
// @route   GET /api/post-requirements/:id
// @access  Public
exports.getPostRequirement = async (req, res, next) => {
  try {
    let postRequirement = await PostRequirement.findById(
      req.params.id
    ).populate({
      path: "user",
      select: "name email role isVerified",
    });

    if (!postRequirement) {
      return res.status(404).json({
        success: false,
        message: "Post requirement not found",
      });
    }

    postRequirement = postRequirement.toObject();

    if (postRequirement.image) {
      postRequirement.imageUrl = await getSignedUrl(postRequirement.image);
    }

    res.status(200).json({
      success: true,
      data: postRequirement,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

// @desc    Get logged in user’s post requirements
// @route   GET /api/post-requirements/my-posts
// @access  Private
exports.getMyPostRequirements = async (req, res, next) => {
  try {
    const userId = req.user.id;

    let posts = await PostRequirement.find({ user: userId })
      .populate({
        path: "user",
        select: "name email role isVerified",
      })
      .sort({ createdAt: -1 });

    const postsWithUrls = await Promise.all(
      posts.map(async (post) => {
        const obj = post.toObject();
        if (obj.image) {
          obj.imageUrl = await getSignedUrl(obj.image);
        }
        return obj;
      })
    );

    res.status(200).json({
      success: true,
      count: postsWithUrls.length,
      data: postsWithUrls,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

exports.getOnlineTeachingJobs = async (req, res, next) => {
  try {
    // Copy req.query
    const reqQuery = { ...req.query };

    // Fields to exclude from filters
    const removeFields = ["select", "sort", "page", "limit"];
    removeFields.forEach((param) => delete reqQuery[param]);

    // Add filter for online meeting options
    reqQuery.meetingOptions = { $in: ["Online"] };

    // Convert query operators ($gt, $in, etc.)
    // Convert operators except $in
    let queryStr = JSON.stringify(reqQuery);
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, (match) =>
      match === "in" ? match : `$${match}`
    );

    let filters = JSON.parse(queryStr);

    // Add meeting option filter separately
    filters.meetingOptions = { $in: ["Online"] };

    let query = PostRequirement.find(filters).populate({
      path: "user",
      select: "name email role isVerified",
      match: { role: "student", isVerified: true },
    });

    // Pagination setup
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 15;
    const startIndex = (page - 1) * limit;

    // Select Fields
    if (req.query.select) {
      const fields = req.query.select.split(",").join(" ");
      query = query.select(fields);
    }

    // Sort
    if (req.query.sort) {
      const sortBy = req.query.sort.split(",").join(" ");
      query = query.sort(sortBy);
    } else {
      query = query.sort("-createdAt");
    }

    // ✅ Apply pagination
    query = query.skip(startIndex).limit(limit);

    // Run query
    let onlineTeachingJobs = await query;

    // ❌ Remove posts where populate didn't match
    onlineTeachingJobs = onlineTeachingJobs.filter((post) => post.user);

    // ✅ Auto-verify posts from verified users
    const postsToUpdate = onlineTeachingJobs.filter(
      (post) => post.user.isVerified && !post.isVerified
    );

    if (postsToUpdate.length > 0) {
      const postIds = postsToUpdate.map((post) => post._id);
      await PostRequirement.updateMany(
        { _id: { $in: postIds } },
        { $set: { isVerified: true } }
      );
    }

    // Add signed URL + sync isVerified with user
    const postsWithUrls = await Promise.all(
      onlineTeachingJobs.map(async (post) => {
        const obj = post.toObject();
        obj.isVerified = post.user.isVerified;

        if (obj.image) {
          obj.imageUrl = await getSignedUrl(obj.image);
        }
        return obj;
      })
    );

    // ✅ Get total count of verified student posts with online meeting option
    const allPosts = await PostRequirement.find({
      ...JSON.parse(queryStr),
      meetingOptions: { $in: ["Online"] },
    }).populate({
      path: "user",
      match: { role: "student", isVerified: true },
    });
    const total = allPosts.filter((post) => post.user).length;

    // Pagination info
    const pagination = {};
    const totalPages = Math.ceil(total / limit);
    if (page < totalPages) pagination.next = { page: page + 1, limit };
    if (page > 1) pagination.prev = { page: page - 1, limit };

    res.status(200).json({
      success: true,
      count: postsWithUrls.length,
      total,
      totalPages,
      pagination,
      data: postsWithUrls,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
exports.getHomeTeachingJobs = async (req, res, next) => {
  try {
    // Copy req.query
    const reqQuery = { ...req.query };

    // Fields to exclude from filters
    const removeFields = ["select", "sort", "page", "limit"];
    removeFields.forEach((param) => delete reqQuery[param]);

    // Add filter for "At my place" meeting options
    reqQuery.meetingOptions = "At my place";

    // Convert query operators ($gt, $in, etc.)
    let queryStr = JSON.stringify(reqQuery);
    queryStr = queryStr.replace(
      /\b(gt|gte|lt|lte|in)\b/g,
      (match) => `$${match}`
    );

    // Pagination setup
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 15;
    const startIndex = (page - 1) * limit;

    // Base query with population
    let query = PostRequirement.find(JSON.parse(queryStr)).populate({
      path: "user",
      select: "name email role isVerified",
      match: { role: "student", isVerified: true }, // only verified students
    });

    // Select Fields
    if (req.query.select) {
      const fields = req.query.select.split(",").join(" ");
      query = query.select(fields);
    }

    // Sort
    if (req.query.sort) {
      const sortBy = req.query.sort.split(",").join(" ");
      query = query.sort(sortBy);
    } else {
      query = query.sort("-createdAt");
    }

    // ✅ Apply pagination
    query = query.skip(startIndex).limit(limit);

    // Run query
    let homeTeachingJobs = await query;

    // ❌ Remove posts where populate didn't match
    homeTeachingJobs = homeTeachingJobs.filter((post) => post.user);

    // ✅ Auto-verify posts from verified users
    const postsToUpdate = homeTeachingJobs.filter(
      (post) => post.user.isVerified && !post.isVerified
    );

    if (postsToUpdate.length > 0) {
      const postIds = postsToUpdate.map((post) => post._id);
      await PostRequirement.updateMany(
        { _id: { $in: postIds } },
        { $set: { isVerified: true } }
      );
    }

    // Add signed URL + sync isVerified with user
    const postsWithUrls = await Promise.all(
      homeTeachingJobs.map(async (post) => {
        const obj = post.toObject();
        obj.isVerified = post.user.isVerified;

        if (obj.image) {
          obj.imageUrl = await getSignedUrl(obj.image);
        }
        return obj;
      })
    );

    // ✅ Get total count of verified student posts with "At my place" meeting option
    const allPosts = await PostRequirement.find({
      ...JSON.parse(queryStr),
      meetingOptions: "At my place",
    }).populate({
      path: "user",
      match: { role: "student", isVerified: true },
    });
    const total = allPosts.filter((post) => post.user).length;

    // Pagination info
    const pagination = {};
    const totalPages = Math.ceil(total / limit);
    if (page < totalPages) pagination.next = { page: page + 1, limit };
    if (page > 1) pagination.prev = { page: page - 1, limit };

    res.status(200).json({
      success: true,
      count: postsWithUrls.length,
      total,
      totalPages,
      pagination,
      data: postsWithUrls,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
exports.getAssignmentHelpPosts = async (req, res, next) => {
  try {
    // Copy req.query
    const reqQuery = { ...req.query };

    // Fields to exclude from filters
    const removeFields = ["select", "sort", "page", "limit"];
    removeFields.forEach((param) => delete reqQuery[param]);

    // Add filter for Assignment Help service type
    reqQuery.serviceType = "Assignment Help";

    // Convert query operators ($gt, $in, etc.)
    let queryStr = JSON.stringify(reqQuery);
    queryStr = queryStr.replace(
      /\b(gt|gte|lt|lte|in)\b/g,
      (match) => `$${match}`
    );

    // Pagination setup
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 15;
    const startIndex = (page - 1) * limit;

    // Base query with population
    let query = PostRequirement.find(JSON.parse(queryStr)).populate({
      path: "user",
      select: "name email role isVerified",
      match: { role: "student", isVerified: true }, // only verified students
    });

    // Select Fields
    if (req.query.select) {
      const fields = req.query.select.split(",").join(" ");
      query = query.select(fields);
    }

    // Sort
    if (req.query.sort) {
      const sortBy = req.query.sort.split(",").join(" ");
      query = query.sort(sortBy);
    } else {
      query = query.sort("-createdAt");
    }

    // ✅ Apply pagination
    query = query.skip(startIndex).limit(limit);

    // Run query
    let assignmentHelpPosts = await query;

    // ❌ Remove posts where populate didn't match
    assignmentHelpPosts = assignmentHelpPosts.filter((post) => post.user);

    // ✅ Auto-verify posts from verified users
    const postsToUpdate = assignmentHelpPosts.filter(
      (post) => post.user.isVerified && !post.isVerified
    );

    if (postsToUpdate.length > 0) {
      const postIds = postsToUpdate.map((post) => post._id);
      await PostRequirement.updateMany(
        { _id: { $in: postIds } },
        { $set: { isVerified: true } }
      );
    }

    // Add signed URL + sync isVerified with user
    const postsWithUrls = await Promise.all(
      assignmentHelpPosts.map(async (post) => {
        const obj = post.toObject();
        obj.isVerified = post.user.isVerified;

        if (obj.image) {
          obj.imageUrl = await getSignedUrl(obj.image);
        }
        return obj;
      })
    );

    // ✅ Get total count of verified student posts with Assignment Help service type
    const allPosts = await PostRequirement.find({
      ...JSON.parse(queryStr),
      serviceType: "Assignment Help",
    }).populate({
      path: "user",
      match: { role: "student", isVerified: true },
    });
    const total = allPosts.filter((post) => post.user).length;

    // Pagination info
    const pagination = {};
    const totalPages = Math.ceil(total / limit);
    if (page < totalPages) pagination.next = { page: page + 1, limit };
    if (page > 1) pagination.prev = { page: page - 1, limit };

    res.status(200).json({
      success: true,
      count: postsWithUrls.length,
      total,
      totalPages,
      pagination,
      data: postsWithUrls,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
// @desc    Update post requirement
// @route   PUT /api/post-requirements/:id
// @access  Private

exports.updatePostRequirement = async (req, res, next) => {
  try {
    console.log("Update Request Body:", req.body);
    let postRequirement = await PostRequirement.findById(req.params.id);

    if (!postRequirement) {
      return res.status(404).json({
        success: false,
        message: "Post requirement not found",
      });
    }

    // Make sure user is post owner
    if (
      postRequirement.user.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "User not authorized to update this post requirement",
      });
    }

    postRequirement = await PostRequirement.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    res.status(200).json({
      success: true,
      data: postRequirement,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// @desc    Delete post requirement
// @route   DELETE /api/post-requirements/:id
// @access  Private
exports.deletePostRequirement = async (req, res, next) => {
  try {
    const postRequirement = await PostRequirement.findById(req.params.id);

    if (!postRequirement) {
      return res.status(404).json({
        success: false,
        message: "Post requirement not found",
      });
    }

    // Make sure user is post owner
    if (
      postRequirement.user.toString() !== req.user.id &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "User not authorized to delete this post requirement",
      });
    }

    await postRequirement.remove();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};
