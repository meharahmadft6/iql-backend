// controllers/contactController.js
const Contact = require("../models/Contact");
const Teacher = require("../models/Teacher");
const Wallet = require("../models/Wallet");
const asyncHandler = require("../middleware/async");
const mongoose = require("mongoose");

exports.initiateContact = asyncHandler(async (req, res) => {
  const { teacherId } = req.params;
  const studentId = req.user.id;
  const { message } = req.body;

  console.log("Initiate contact request received:", {
    teacherId,
    studentId,
    message,
  });

  // ✅ Check if teacher exists and is approved
  const teacher = await Teacher.findById(teacherId).populate("user");
  if (!teacher) {
    return res.status(404).json({
      success: false,
      message: "Teacher not found",
    });
  }

  if (!teacher.isApproved) {
    return res.status(400).json({
      success: false,
      message: "This teacher profile is not approved yet",
    });
  }

  // ✅ Check if contact already exists
  const existingContact = await Contact.findOne({
    student: studentId,
    teacher: teacherId,
  });

  if (existingContact) {
    return res.status(400).json({
      success: false,
      message: "You have already initiated contact with this teacher",
    });
  }

  // ✅ Check student's wallet balance
  const studentWallet = await Wallet.findOne({
    user: new mongoose.Types.ObjectId(studentId),
  });

  if (!studentWallet) {
    return res.status(404).json({
      success: false,
      message: "Wallet not found for student",
    });
  }

  const contactCost = 50; // constant cost for contacting

  if (studentWallet.balance < contactCost) {
    return res.status(400).json({
      success: false,
      message: "Insufficient coins to contact this teacher",
    });
  }

  // ✅ Deduct coins from student wallet
  studentWallet.balance -= contactCost;

  // Use the correct transactionModel value based on your Wallet schema
  // Common values might be: "Contact", "TeacherContact", "StudentContact", etc.
  studentWallet.transactions.push({
    type: "debit",
    amount: contactCost,
    description: `Contact initiated with teacher: ${teacher.user.name}`,
    reference: teacherId,
    transactionModel: "Contact", // Changed from "Teacher" to "Contact"
  });

  await studentWallet.save();

  // ✅ Create contact record
  const contact = await Contact.create({
    student: studentId,
    teacher: teacherId,
    contactCost,
    message,
    status: "contacted",
    contactedAt: Date.now(),
  });

  res.status(201).json({
    success: true,
    data: contact,
    message: "Contact initiated successfully",
  });
});

exports.getContactStatus = asyncHandler(async (req, res) => {
  const { teacherId } = req.params;
  const studentId = req.user.id;

  const contact = await Contact.findOne({
    student: studentId,
    teacher: teacherId,
  });

  res.status(200).json({
    success: true,
    data: contact,
  });
});

exports.getTeacherContacts = asyncHandler(async (req, res) => {
  const teacherId = req.user.id;

  const teacherProfile = await Teacher.findOne({ user: teacherId });
  if (!teacherProfile) {
    return res.status(404).json({
      success: false,
      message: "Teacher profile not found",
    });
  }

  const contacts = await Contact.find({ teacher: teacherProfile._id })
    .populate({
      path: "student",
      select: "name email",
    })
    .sort({ initiatedAt: -1 });

  res.status(200).json({
    success: true,
    count: contacts.length,
    data: contacts,
  });
});
