import mongoose from "mongoose";

const mentorReviewSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    feedback: {
      type: String,
      required: true,
      trim: true,
    },
    skills: {
      type: [String],
      default: [],
    },
    designation: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Enforce unique review per mentor-student pair
mentorReviewSchema.index({ student: 1, faculty: 1 }, { unique: true });
mentorReviewSchema.index({ student: 1, createdAt: -1 });

const MentorReview = mongoose.model("MentorReview", mentorReviewSchema);
export { MentorReview };
export default MentorReview;
