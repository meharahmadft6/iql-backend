// controllers/walletController.js
const Wallet = require("../models/Wallet");

exports.getWallet = async (req, res, next) => {
  try {
    const wallet = await Wallet.findOne({ user: req.user.id });

    if (!wallet) {
      // Create wallet if it doesn't exist
      const newWallet = await Wallet.create({ user: req.user.id });
      return res.status(200).json({
        success: true,
        data: newWallet,
      });
    }

    res.status(200).json({
      success: true,
      data: wallet,
    });
  } catch (error) {
    next(error);
  }
};
// controllers/walletController.js
exports.getTransactionHistory = async (req, res, next) => {
  try {
    const wallet = await Wallet.findOne({ user: req.user.id });

    if (!wallet) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    // Format transactions for frontend
    const formattedTransactions = wallet.transactions.map((transaction) => ({
      id: transaction._id,
      type:
        transaction.type === "purchase"
          ? "purchase"
          : transaction.type === "debit"
          ? "course_access"
          : "other",
      amount:
        transaction.type === "purchase"
          ? transaction.amount
          : -transaction.amount,
      description: transaction.description,
      status: getTransactionStatus(transaction),
      createdAt: transaction.createdAt,
      reference: transaction.reference,
    }));

    // Sort by date, newest first
    formattedTransactions.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.status(200).json({
      success: true,
      data: formattedTransactions,
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to determine status
const getTransactionStatus = (transaction) => {
  if (transaction.type === "purchase") {
    return "completed"; // Assuming purchases are always completed
  }
  return "completed"; // Default status for other transactions
};
