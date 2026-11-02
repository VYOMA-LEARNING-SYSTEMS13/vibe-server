import mongoose from "mongoose";

const skillVerificationReviewSchema = new mongoose.Schema(
  {
    attemptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SkillVerificationAttempt",
      required: true,
      unique: true,
    },
    mentorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    decision: {
      type: String,
      enum: ["approved", "rejected"],
      required: true,
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    pros: {
      type: [String],
      default: [],
    },
    cons: {
      type: [String],
      default: [],
    },
    feedbackComments: {
      type: String,
      default: "",
    },
    reviewedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

const SkillVerificationReview = mongoose.model(
  "SkillVerificationReview",
  skillVerificationReviewSchema
);
export default SkillVerificationReview;
