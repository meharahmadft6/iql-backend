// middleware/ensureWallet.js
const Wallet = require("../models/Wallet");
const { initializeWallet } = require("./wallet");
const asyncHandler = require("express-async-handler"); // <--- Add this line

const ensureWallet = asyncHandler(async (req, res, next) => {
  try {
    const wallet = await Wallet.findOne({ user: req.user.id });

    if (!wallet) {
      // Create wallet if it doesn't exist
      await initializeWallet(req.user.id);
      console.log(`Created wallet for existing user: ${req.user.id}`);
    }

    next();
  } catch (error) {
    console.error("Error ensuring wallet exists:", error);
    next(); // Continue anyway to not break the request
  }
});

module.exports = ensureWallet;
