// routes/wallet.js
const express = require("express");
const {
  getWallet,
  getTransactionHistory,
} = require("../controllers/walletController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.use(protect);
router.get("/", getWallet);
router.get("/transactions", protect, getTransactionHistory); // Add this route
module.exports = router;
