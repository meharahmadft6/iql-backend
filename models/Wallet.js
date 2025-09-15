// models/Wallet.js
const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["credit", "debit"],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  reference: {
    type: mongoose.Schema.ObjectId,
    refPath: "transactionModel",
  },
  transactionModel: {
    type: String,
    enum: ["PostRequirement", "TeacherApplication"],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const WalletSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  balance: {
    type: Number,
    default: 150, // Default coins
    min: 0,
  },
  transactions: [TransactionSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt field before saving
WalletSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Wallet", WalletSchema);
