// controllers/postRequirements.js
const PostRequirement = require("../models/PostRequirement");
const User = require("../models/User");
const Email = require("../utils/sendEmail");
const { uploadFile } = require("../utils/s3");
// @desc    Create a new tutor request (with auto user creation if needed)
// @route   POST /api/post-requirements
// @access  Public (for unauthenticated users) / Private (for authenticated)
  exports.createPostRequirement = async (req, res, next) => {
    try {
      let user;
      console.log("Request ", req.body);
      console.log("File ", req.file);
      console.log("User ", req.user);

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

        // send verification email
        // try {
        //   const verificationToken = user.getResetPasswordToken();
        //   await user.save({ validateBeforeSave: false });

        //   const verificationUrl = `${req.protocol}://${req.get(
        //     "host"
        //   )}/api/auth/verify-email/${verificationToken}`;

        //   await new Email(user, verificationUrl).sendWelcome();
        // } catch (emailError) {
        //   console.error("Email sending failed:", emailError);
        // }
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

      if (postData.meetingOptions.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Please select at least one meeting option",
        });
      }

      // ✅ Parse languages[]
      Object.keys(req.body).forEach((key) => {
        if (key.startsWith("languages[")) {
          const language = req.body[key];
          if (language && language.trim()) {
            postData.languages.push(language.trim());
          }
        }
      });

      if (postData.languages.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Please select at least one preferred language",
        });
      }

      // ✅ Parse subjects[]
      const subjects = {};
      Object.keys(req.body).forEach((key) => {
        const match = key.match(/^subjects\[(\d+)\]\[(\w+)\]$/);
        if (match) {
          const index = match[1];
          const field = match[2];
          if (!subjects[index]) subjects[index] = {};
          subjects[index][field] = req.body[key];
        }
      });

      const validSubjects = Object.values(subjects).filter(
        (subject) => subject.name && subject.name.trim() && subject.level
      );

      if (validSubjects.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Please provide at least one subject with name and level",
        });
      }

      postData.subjects = validSubjects;

      // ✅ Upload image to S3 if provided
      if (req.file) {
        try {
          const imageUrl = await uploadFile(req.file, "requirements/");
          postData.image = imageUrl;
        } catch (uploadErr) {
          console.error("S3 Upload Failed:", uploadErr);
          return res.status(500).json({
            success: false,
            message: "Image upload failed",
          });
        }
      }

      // ✅ Save Post Requirement
      const postRequirement = await PostRequirement.create(postData);

      res.status(201).json({
        success: true,
        data: postRequirement,
        message: req.user
          ? "Post requirement created successfully."
          : "Account created and post requirement submitted successfully. Please check your email to verify your account.",
      });
    } catch (err) {
      console.error("Error creating post requirement:", err);

      if (err.name === "ValidationError") {
        const messages = Object.values(err.errors).map((error) => error.message);
        return res
          .status(400)
          .json({ success: false, message: messages.join(". ") });
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
// @desc    Get all post requirements
// @route   GET /api/post-requirements
// @access  Public
exports.getPostRequirements = async (req, res, next) => {
  try {
    let query;

    // Copy req.query
    const reqQuery = { ...req.query };

    // Fields to exclude
    const removeFields = ["select", "sort", "page", "limit"];

    // Loop over removeFields and delete them from reqQuery
    removeFields.forEach((param) => delete reqQuery[param]);

    // Create query string
    let queryStr = JSON.stringify(reqQuery);

    // Create operators ($gt, $gte, etc)
    queryStr = queryStr.replace(
      /\b(gt|gte|lt|lte|in)\b/g,
      (match) => `$${match}`
    );

    // Finding resource
    query = PostRequirement.find(JSON.parse(queryStr)).populate({
      path: "user",
      select: "name email",
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

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await PostRequirement.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Executing query
    const postRequirements = await query;

    // Pagination result
    const pagination = {};

    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit,
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit,
      };
    }

    res.status(200).json({
      success: true,
      count: postRequirements.length,
      pagination,
      data: postRequirements,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

// @desc    Get single post requirement
// @route   GET /api/post-requirements/:id
// @access  Public
exports.getPostRequirement = async (req, res, next) => {
  try {
    const postRequirement = await PostRequirement.findById(
      req.params.id
    ).populate({
      path: "user",
      select: "name email",
    });

    if (!postRequirement) {
      return res.status(404).json({
        success: false,
        message: "Post requirement not found",
      });
    }

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

// @desc    Update post requirement
// @route   PUT /api/post-requirements/:id
// @access  Private
exports.updatePostRequirement = async (req, res, next) => {
  try {
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
