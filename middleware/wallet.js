// middleware/wallet.js
const Wallet = require("../models/Wallet");

exports.initializeWallet = async (userId) => {
  try {
    const existingWallet = await Wallet.findOne({ user: userId });
    if (!existingWallet) {
      await Wallet.create({ user: userId, balance: 150 });
    }
  } catch (error) {
    console.error("Error initializing wallet:", error);
  }
};

// Add this to user registration logic
