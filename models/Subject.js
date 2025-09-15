const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    enum: [
      // Education levels
      "School",
      "College",
      "University",

      // Skills & Professions
      "Skill",
      "Language",
      "Languages",
      "Vocational",
      "Professional",
      "Exam Preparation",
      "Hobby",
      "Sports",

      // Academic streams
      "Science",
      "Sciences", // added
      "Mathematics",
      "Science & Technology",
      "Technology",
      "Engineering",
      "Health",
      "Social Sciences",
      "Humanities",
      "Humanities & Social Sciences", // added

      // Arts
      "Arts",
      "Creative Arts",
      "Creative & Vocational", // added

      // Business
      "Business",
      "Business & Economics", // added

      // Misc
      "Other",
    ],
  },
  level: {
    type: String,
    enum: [
      // General proficiency levels
      "Beginner",
      "Intermediate",
      "Advanced",
      "Expert",
      "Proficiency",

      // School grades
      "Kindergarten",
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

      // International school levels
      "Primary",
      "Secondary",
      "IGCSE",
      "igcse",
      "O-Level",
      "AS-Level",
      "A-Level",
      "IB Middle Years",
      "IB Diploma",

      // Higher education
      "Certificate",
      "Diploma",
      "Associate",
      "Bachelor's",
      "Master's",
      "PhD",
      "Postdoctoral",

      // University year levels
      "Undergraduate - Year 1",
      "Undergraduate - Year 2",
      "Undergraduate - Year 3",
      "Undergraduate - Year 4",
      "Postgraduate - Year 1",
      "Postgraduate - Year 2",

      // Professional levels
      "Entry Level",
      "Junior",
      "Mid-Level",
      "Senior",
      "Executive",

      // Language proficiency
      "A1 (Beginner)",
      "A2 (Elementary)",
      "B1 (Intermediate)",
      "B2 (Upper-Intermediate)",
      "C1 (Advanced)",
      "C2 (Proficient)",

      // Other classifications
      "Introductory",
      "Foundation",
      "General",
      "Honors",
      "AP (Advanced Placement)",
      "Remedial",
      "Specialized",
      "Research",
      "Thesis",
      "Other",
    ],
    default: "Other",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

subjectSchema.index({ name: 1, category: 1, level: 1 }, { unique: true });

module.exports = mongoose.model("Subject", subjectSchema);
