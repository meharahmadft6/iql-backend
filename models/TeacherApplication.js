// models/TeacherApplication.js
const mongoose = require("mongoose");

const TeacherApplicationSchema = new mongoose.Schema({
  teacher: {
    type: mongoose.Schema.ObjectId,
    ref: "Teacher",
    required: true,
  },
  postRequirement: {
    type: mongoose.Schema.ObjectId,
    ref: "PostRequirement",
    required: true,
  },
  status: {
    type: String,
    enum: ["accepted", "rejected", "contacted"],
    default: "accepted",
  },
  applicationCost: {
    type: Number,
    required: true,
  },
  appliedAt: {
    type: Date,
    default: Date.now,
  },
  contactedAt: {
    type: Date,
  },
});

// Prevent duplicate applications
TeacherApplicationSchema.index(
  { teacher: 1, postRequirement: 1 },
  { unique: true }
);

module.exports = mongoose.model("TeacherApplication", TeacherApplicationSchema);
