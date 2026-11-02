import mongoose from "mongoose";

const mentorWorkloadSchema = new mongoose.Schema(
  {
    mentorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    activePendingReviews: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },
    totalCompletedReviews: {
      type: Number,
      default: 0,
    },
    isAvailable: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastAssignedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const MentorWorkload = mongoose.model("MentorWorkload", mentorWorkloadSchema);
export default MentorWorkload;
