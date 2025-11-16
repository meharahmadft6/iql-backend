// models/SubjectResources.js
const mongoose = require("mongoose");

const mcqSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
    trim: true,
  },
  options: [
    {
      type: String,
      required: true,
      trim: true,
    },
  ],
  correctOption: {
    type: Number,
    required: true,
    min: 0,
    max: 3,
  },
  explanation: {
    type: String,
    required: true,
    trim: true,
  },
  difficulty: {
    type: String,
    enum: ["easy", "medium", "hard"],
    required: true,
  },
  marks: {
    type: Number,
    default: 1,
    min: 1,
  },
  topic: {
    type: String,
    required: true,
    trim: true,
  },
  subTopic: {
    type: String,
    required: true,
    trim: true,
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

// Schema for exam questions topics
const examQuestionTopicSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  code: {
    type: String,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  subSections: [
    {
      name: {
        type: String,
        required: true,
        trim: true,
      },
      code: {
        type: String,
        required: true,
        trim: true,
      },
      description: {
        type: String,
        trim: true,
      },
      mcqs: [mcqSchema],
      totalQuestions: {
        type: Number,
        default: 0,
      },
      pdfUrl: {
        type: String,
        default: null,
      },
      pdfKey: {
        type: String,
        default: null,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
      updatedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  totalQuestions: {
    type: Number,
    default: 0,
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

// Schema for revision notes topics (different structure)
const revisionNoteTopicSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  images: [
    {
      url: String,
      caption: String,
      altText: String,
    },
  ],
  order: {
    type: Number,
    default: 0,
  },
  subTopics: [
    {
      title: String,
      content: String,
      order: Number,
      image: {
        url: String,
        caption: String,
        altText: String,
      },
    },
  ],
});

const pastPaperSchema = new mongoose.Schema({
  year: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: String,
  paperNumber: String,
  pdfUrl: {
    type: String,
    required: true,
  },
  fileSize: String,
  duration: Number,
  totalMarks: Number,
});

const flashcardSchema = new mongoose.Schema({
  front: {
    type: String,
    required: true,
  },
  back: {
    type: String,
    required: true,
  },
  topic: String,
  difficulty: String,
});

const subjectResourcesSchema = new mongoose.Schema({
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject",
    required: true,
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: true,
  },
  examBoard: {
    type: String,
    required: true,
  },

  resources: {
    examQuestions: {
      isEnabled: { type: Boolean, default: false },
      topics: [examQuestionTopicSchema], // Use the specific schema
    },

    revisionNotes: {
      isEnabled: { type: Boolean, default: false },
      topics: [revisionNoteTopicSchema], // Use the specific schema
    },

    flashcards: {
      isEnabled: { type: Boolean, default: false },
      cards: [flashcardSchema],
    },

    targetTests: {
      isEnabled: { type: Boolean, default: false },
      tests: [
        {
          name: String,
          description: String,
          topics: [String],
          difficulty: String,
          questions: [
            {
              type: mongoose.Schema.Types.ObjectId,
              ref: "MCQ",
            },
          ],
          timeLimit: Number,
          totalMarks: Number,
        },
      ],
    },

    mockExams: {
      isEnabled: { type: Boolean, default: false },
      exams: [pastPaperSchema],
    },

    pastPapers: {
      isEnabled: { type: Boolean, default: false },
      papers: [pastPaperSchema],
    },

    additionalResources: [
      {
        name: String,
        type: String,
        content: mongoose.Schema.Types.Mixed,
        isEnabled: { type: Boolean, default: true },
      },
    ],
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

subjectResourcesSchema.index(
  { subject: 1, course: 1, examBoard: 1 },
  { unique: true }
);

module.exports = mongoose.model("SubjectResources", subjectResourcesSchema);
