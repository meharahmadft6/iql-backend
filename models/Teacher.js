const mongoose = require("mongoose");

const SubjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please add a subject name"],
  },
  fromLevel: {
    type: String,
    required: [true, "Please select from level"],
  },
  toLevel: {
    type: String,
    required: [true, "Please select to level"],
  },
});

const EducationSchema = new mongoose.Schema({
  institution: {
    type: String,
    required: [true, "Please add institution name"],
  },
  city: {
    type: String,
    required: [true, "Please add city"],
  },
  degreeType: {
    type: String,
    required: [true, "Please add degree type"],
  },
  degreeName: {
    type: String,
    required: [true, "Please add degree name"],
  },
  association: {
    type: String,
    enum: ["full-time", "part-time", "correspondence"],
    required: [true, "Please add association type"],
  },
});

const ExperienceSchema = new mongoose.Schema({
  organization: {
    type: String,
    required: [true, "Please add organization name"],
  },
  city: {
    type: String,
    required: [true, "Please add city"],
  },
  designation: {
    type: String,
    required: [true, "Please add designation"],
  },
  startMonth: {
    type: String,
    required: [true, "Please add start month"],
  },
  startYear: {
    type: Number,
    required: [true, "Please add start year"],
  },
  endMonth: {
    type: String,
  },
  endYear: {
    type: Number,
  },
  currentlyWorking: {
    type: Boolean,
    default: false,
  },
});

const TeacherProfileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  speciality: {
    type: String,
    required: [true, "Please add your speciality"],
  },
  currentRole: {
    type: String,
    required: [true, "Please add your current role"],
  },
  gender: {
    type: String,
    enum: ["male", "female", "other"],
    required: [true, "Please select your gender"],
  },
  birthDate: {
    type: Date,
    required: [true, "Please add your birth date"],
  },
  location: {
    type: String,
    required: [true, "Please add your location"],
  },
  phoneNumber: {
    type: String,
    required: [true, "Please add your phone number"],
    match: [/^[0-9]{10,15}$/, "Please add a valid phone number"],
  },
  subjects: [SubjectSchema],
  education: [EducationSchema],
  experience: [ExperienceSchema],
  fee: {
    type: Number,
    required: [true, "Please add your fee"],
  },
  feeDetails: {
    type: String,
    required: [true, "Please add fee details"],
  },
  totalExperience: {
    type: Number,
    required: [true, "Please add total years of experience"],
  },
  teachingExperience: {
    type: Number,
    required: [true, "Please add total years of teaching experience"],
  },
  onlineTeachingExperience: {
    type: Number,
    required: [true, "Please add years of online teaching experience"],
  },
  willingToTravel: {
    type: Boolean,
    default: false,
  },
  availableForOnline: {
    type: Boolean,
    default: true,
  },
  hasDigitalPen: {
    type: Boolean,
    default: false,
  },
  helpsWithHomework: {
    type: Boolean,
    default: false,
  },
  currentlyEmployed: {
    type: Boolean,
    default: false,
  },
  opportunities: {
    type: String,
    enum: ["full-time", "part-time", "both"],
    required: [true, "Please select opportunities you are interested in"],
  },
  languages: {
    type: [String],
    required: [true, "Please add languages you can communicate in"],
  },
  profileDescription: {
    type: String,
    required: [true, "Please add your profile description"],
    maxlength: [1000, "Description can not be more than 1000 characters"],
  },
  idProofType: {
    type: String,
    enum: ["CNIC", "Passport", "Other"],
    required: [true, "Please select ID proof type"],
  },
  idProofFile: {
    type: String,
    required: [true, "Please upload ID proof"],
    unique: true, // S3 key should be unique
  },
  profilePhoto: {
    type: String,
    required: [true, "Please upload your profile photo"],
    unique: true, // S3 key should be unique
  },
  isApproved: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Prevent user from having more than one profile
TeacherProfileSchema.index({ user: 1 }, { unique: true });

module.exports = mongoose.model("Teacher", TeacherProfileSchema);
