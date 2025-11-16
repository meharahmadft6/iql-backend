const express = require("express");
const {
  getStudentDashboard,
  getStudentStats,
} = require("../controllers/dashboardController");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

router.use(protect);
router.use(authorize("student"));

router.get("/", getStudentDashboard);
router.get("/stats", getStudentStats);

module.exports = router;
