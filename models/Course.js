// models/Course.js
const mongoose = require("mongoose");

const subjectExamBoardSchema = new mongoose.Schema({
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject",
    required: true,
  },
  examBoards: [
    {
      type: String,
      required: true,
    },
  ],
});

const courseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  subjectExamBoards: [subjectExamBoardSchema],
  level: {
    type: String,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  thumbnail: {
    type: String, // URL to image
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

courseSchema.index({ name: 1, level: 1 }, { unique: true });

module.exports = mongoose.model("Course", courseSchema);
