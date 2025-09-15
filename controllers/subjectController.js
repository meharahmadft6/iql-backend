const Subject = require("../models/Subject");

// ➕ Add new subject
exports.addSubject = async (req, res) => {
  try {
    const subject = new Subject(req.body);
    await subject.save();
    res.status(201).json({
      success: true,
      data: subject,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message:
          "This subject with the same name, category, and level already exists.",
      });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

// 📋 Get all subjects (with search)
exports.getSubjects = async (req, res) => {
  try {
    const { q } = req.query;
    const query = q ? { name: { $regex: q, $options: "i" } } : {};
    const subjects = await Subject.find(query).sort({ name: 1 });
    res.status(200).json({
      success: true,
      count: subjects.length,
      data: subjects,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ❌ Delete subject
exports.deleteSubject = async (req, res) => {
  try {
    await Subject.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: "Subject deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✏️ Update subject
exports.updateSubject = async (req, res) => {
  try {
    const subject = await Subject.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!subject) {
      return res
        .status(404)
        .json({ success: false, message: "Subject not found" });
    }

    res.status(200).json({ success: true, data: subject });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
// Add this new controller function to your subjectController.js
exports.addBulkSubjects = async (req, res) => {
  try {
    const subjects = req.body;

    // Validate that the request body is an array
    if (!Array.isArray(subjects)) {
      return res.status(400).json({
        success: false,
        message: "Request body must be an array of subjects",
      });
    }

    // Validate each subject object
    for (let subject of subjects) {
      if (!subject.name || !subject.category) {
        return res.status(400).json({
          success: false,
          message: "Each subject must have a name and category",
        });
      }
    }

    // Create subjects with error handling for duplicates
    const createdSubjects = [];
    const errors = [];

    for (let subjectData of subjects) {
      try {
        const subject = new Subject(subjectData);
        await subject.save();
        createdSubjects.push(subject);
      } catch (error) {
        if (error.code === 11000) {
          // Duplicate key error
          errors.push({
            subject: subjectData,
            error: `Subject with name '${subjectData.name}' already exists`,
          });
        } else {
          errors.push({
            subject: subjectData,
            error: error.message,
          });
        }
      }
    }

    res.status(201).json({
      success: true,
      data: createdSubjects,
      errors: errors.length > 0 ? errors : undefined,
      message: `Created ${createdSubjects.length} subjects, ${errors.length} failed`,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
