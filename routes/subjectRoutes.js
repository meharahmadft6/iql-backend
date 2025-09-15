const express = require("express");
const router = express.Router();
const {
  addSubject,
  getSubjects,
  deleteSubject,
  updateSubject,
  addBulkSubjects, // Import the new function
} = require("../controllers/subjectController.js");

router.post("/", addSubject); // Add single subject
router.post("/bulk", addBulkSubjects); // Add multiple subjects (new route)
router.get("/", getSubjects); // Get/search subjects
router.delete("/:id", deleteSubject); // Delete subject
router.put("/:id", updateSubject); // Update subject

module.exports = router;
