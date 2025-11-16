// models/Contact.js
const mongoose = require("mongoose");

const ContactSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.ObjectId,
    ref: "User",
    required: true,
  },
  teacher: {
    type: mongoose.Schema.ObjectId,
    ref: "Teacher",
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected", "contacted"],
    default: "pending",
  },
  contactCost: {
    type: Number,
    required: true,
    default: 50,
  },
  initiatedAt: {
    type: Date,
    default: Date.now,
  },
  contactedAt: {
    type: Date,
  },
  message: {
    type: String,
    maxlength: 500,
  },
});

// Prevent duplicate contact requests
ContactSchema.index({ student: 1, teacher: 1 }, { unique: true });

module.exports = mongoose.model("Contact", ContactSchema);
