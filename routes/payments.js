// routes/payments.js
const express = require("express");
const {
  createPayment,
  createPaymentByCoins,
  capturePayment,
  getPaymentHistory,
  getCoinPackages,
  getCoinRate,
  cancelPendingPayments,
} = require("../controllers/paymentController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.use(protect);

router.get("/packages", getCoinPackages);
router.get("/rate", getCoinRate);
router.get("/history", getPaymentHistory);
router.post("/create", createPayment);
router.post("/create-by-coins", createPaymentByCoins);
router.post("/capture", capturePayment);
// routes/paymentRoutes.js - Add this route
// In your payment routes
router.post("/cancel-pending", cancelPendingPayments);
module.exports = router;
