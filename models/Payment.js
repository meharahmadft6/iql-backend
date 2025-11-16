// models/Payment.js
const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required: true,
  },
  paymentId: {
    type: String,
    // Remove unique constraint since it causes issues with null values
  },
  payerId: String,
  amount: {
    type: Number,
    required: true,
    min: 0.1,
  },
  currency: {
    type: String,
    default: "USD",
  },
  coins: {
    type: Number,
    required: true,
    min: 100,
  },
  status: {
    type: String,
    enum: ["pending", "completed", "failed", "cancelled"],
    default: "pending",
  },
  paymentMethod: {
    type: String,
    default: "paypal",
  },
  paypalOrderId: {
    type: String,
    // Add unique index for PayPal order IDs instead
    unique: true,
    sparse: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

PaymentSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Payment", PaymentSchema);
