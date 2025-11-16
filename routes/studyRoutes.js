const express = require("express");
const router = express.Router();
const {
  getStudyNavigation,
  getSubjectResources,
  getExamQuestions,
  getRevisionNotes,
  getPastPapers,
} = require("../controllers/studyController");
const { checkCourseAccess } = require("../middleware/courseAccess"); // We'll create this
const { optionalAuth } = require("../middleware/auth");

// Public routes
router.get("/navigation", optionalAuth, getStudyNavigation);
router.get(
  "/resources/:courseId/:subjectId/:examBoard",
  optionalAuth,
  getSubjectResources
);

// Protected routes that require course access
router.get("/:courseId/:subjectId/:examBoard/revision-notes", getRevisionNotes);

router.get(
  "/:courseId/:subjectId/:examBoard/exam-questions",

  getExamQuestions
);

router.get("/:courseId/:subjectId/:examBoard/past-papers", getPastPapers);

module.exports = router;
