// routes/subjectResourcesRoutes.js
const express = require("express");
const router = express.Router();
const {
  upsertSubjectResources,
  getSubjectResources,
  addMCQ,
  deleteMCQ,
  updateMCQ,
  addMultipleMCQs,
  bulkImportMCQs,
  addRevisionNote,
  updateRevisionNote,
  deleteRevisionNote,
  getBatchResourcesByCourse,
  addPastPaper,
  updatePastPaper,
  deletePastPaper,
  toggleResourceType,
} = require("../controllers/subjectResourcesController");
const { protect, authorize } = require("../middleware/auth");
const { optionalAuth } = require("../middleware/auth");

// Public routes
router.get(
  "/:subjectId/:courseId/:examBoard",
  optionalAuth,
  getSubjectResources
);
router.get(
  "/course/:courseId",
  protect,
  authorize("admin"),
  getBatchResourcesByCourse
);
// Admin only routes
router.post("/", protect, authorize("admin"), upsertSubjectResources);
router.post(
  "/:subjectId/:courseId/:examBoard/mcqs/:topic/:subSection",
  protect,
  authorize("admin"),
  addMCQ
);
router.put(
  "/:subjectId/:courseId/:examBoard/mcqs/:topic/:subSection/:mcqIndex",
  protect,
  authorize("admin"),
  updateMCQ
);

// Delete specific MCQ
router.delete(
  "/:subjectId/:courseId/:examBoard/mcqs/:topic/:subSection/:mcqIndex",
  protect,
  authorize("admin"),
  deleteMCQ
);
// Multiple MCQs
router.post(
  "/:subjectId/:courseId/:examBoard/mcqs-bulk/:topic/:subSection",
  addMultipleMCQs
);

// Bulk import with auto-topic organization
router.post(
  "/:subjectId/:courseId/:examBoard/mcqs-bulk-import",
  bulkImportMCQs
);

router.post(
  "/:subjectId/:courseId/:examBoard/past-papers",
  protect,
  authorize("admin"),
  addPastPaper
);

router.put(
  "/:subjectId/:courseId/:examBoard/past-papers/:paperIndex",
  protect,
  authorize("admin"),
  updatePastPaper
);

router.delete(
  "/:subjectId/:courseId/:examBoard/past-papers/:paperIndex",
  protect,
  authorize("admin"),
  deletePastPaper
);

router.post(
  "/:subjectId/:courseId/:examBoard/revision-notes",
  protect,
  authorize("admin"),
  addRevisionNote
);

// Update revision note
router.put(
  "/:subjectId/:courseId/:examBoard/revision-notes/:noteIndex",
  protect,
  authorize("admin"),
  updateRevisionNote
);

// Delete revision note
router.delete(
  "/:subjectId/:courseId/:examBoard/revision-notes/:noteIndex",
  protect,
  authorize("admin"),
  deleteRevisionNote
);
router.patch(
  "/:subjectId/:courseId/:examBoard/toggle/:resourceType",
  protect,
  authorize("admin"),
  toggleResourceType
);

module.exports = router;
