// models/PostRequirement.js
const mongoose = require("mongoose");

const SubjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  level: {
    type: String,
    required: true,
    enum: [
      "Beginner",
      "Intermediate",
      "Advanced",
      "Expert",
      "Grade 1",
      "Grade 2",
      "Grade 3",
      "Grade 4",
      "Grade 5",
      "Grade 6",
      "Grade 7",
      "Grade 8",
      "Grade 9",
      "Grade 10",
      "Grade 11",
      "Grade 12",
      "Diploma",
      "Bachelor's",
      "Master's",
      "PhD",
    ],
  },
});

const BudgetSchema = new mongoose.Schema({
  currency: {
    type: String,
    required: true,
    default: "PKR",
  },
  amount: {
    type: Number,
    required: true,
  },
  frequency: {
    type: String,
    required: true,
    enum: ["Per Hour", "Per Day", "Per Week", "Per Month", "Per Year", "Fixed"],
  },
});

const PostRequirementSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  subjects: [SubjectSchema],
  serviceType: {
    type: String,
    required: true,
    enum: ["Tutoring", "Assignment Help"],
  },
  meetingOptions: [
    {
      type: String,
      enum: ["Online", "At my place", "Travel to tutor"],
      required: true,
    },
  ],
  budget: BudgetSchema,
  employmentType: {
    type: String,
    enum: ["Part-time", "Full-time"],
    required: true,
  },
  languages: [
    {
      type: String,
      required: true,
    },
  ],
  image: {
    type: String, // S3 URL
    default: null,
  },
  phone: {
    countryCode: { type: String, default: "+92" },
    number: { type: String },
  },
  location: {
    type: String,
    required: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("PostRequirement", PostRequirementSchema);
