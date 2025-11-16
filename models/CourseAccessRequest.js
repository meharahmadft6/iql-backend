const mongoose = require("mongoose");

const courseAccessRequestSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: true,
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject",
    required: true,
  },
  examBoard: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  requestedAt: {
    type: Date,
    default: Date.now,
  },
  reviewedAt: {
    type: Date,
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  reviewNotes: {
    type: String,
  },
});

// Compound index to ensure one request per student per course/subject/examBoard
courseAccessRequestSchema.index(
  { student: 1, course: 1, subject: 1, examBoard: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "CourseAccessRequest",
  courseAccessRequestSchema
);
