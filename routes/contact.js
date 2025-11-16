// routes/contact.js
const express = require("express");
const {
  initiateContact,
  getContactStatus,
  getTeacherContacts,
} = require("../controllers/contactController");
const { createReview, getTeacherReviews } = require("../controllers/reviews");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

router
  .route("/:teacherId")
  .post(protect, authorize("student"), initiateContact)
  .get(protect, authorize("student"), getContactStatus);

router
  .route("/teacher/contacts")
  .get(protect, authorize("teacher"), getTeacherContacts);

router
  .route("/:teacherId/reviews")
  .post(protect, authorize("student"), createReview)
  .get(getTeacherReviews);

module.exports = router;
