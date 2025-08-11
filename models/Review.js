const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const ReviewSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      required: [true, "Please add a title for the review"],
      maxlength: 100,
    },
    text: {
      type: String,
      required: [true, "Please add some text"],
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: [true, "Please add a rating between 1 and 5"],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    teacher: {
      type: mongoose.Schema.ObjectId,
      ref: "Teacher",
      required: true,
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Prevent user from submitting more than one review per teacher
ReviewSchema.index({ teacher: 1, user: 1 }, { unique: true });

// Static method to get average rating of a teacher
ReviewSchema.statics.getAverageRating = async function (teacherId) {
  const obj = await this.aggregate([
    {
      $match: { teacher: teacherId },
    },
    {
      $group: {
        _id: "$teacher",
        averageRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  try {
    await this.model("Teacher").findByIdAndUpdate(teacherId, {
      averageRating: obj[0] ? obj[0].averageRating : 0,
      totalReviews: obj[0] ? obj[0].totalReviews : 0,
    });
  } catch (err) {
    console.error(err);
  }
};

// Call getAverageRating after save
ReviewSchema.post("save", function () {
  this.constructor.getAverageRating(this.teacher);
});

// Call getAverageRating before remove
ReviewSchema.post("remove", function () {
  this.constructor.getAverageRating(this.teacher);
});

// Populate user and teacher details when querying
ReviewSchema.pre(/^find/, function (next) {
  this.populate({
    path: "user",
    select: "name email",
  }).populate({
    path: "teacher",
    select: "name speciality",
  });
  next();
});

// Add pagination plugin
ReviewSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("Review", ReviewSchema);
