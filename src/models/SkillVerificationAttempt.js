import mongoose from "mongoose";

const skillVerificationAttemptSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    skillName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    difficulty: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced"],
      required: true,
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SkillVerificationTask",
      required: true,
    },
    status: {
      type: String,
      enum: [
        "assigned",      // Task given to student
        "submitted",     // Deliverables submitted, pending mentor assignment
        "under_review",  // Assigned to mentor, awaiting evaluation
        "approved",      // Passed (score >= 70)
        "rejected",      // Failed (score < 70)
        "expired"        // Time limit elapsed
      ],
      default: "assigned",
      index: true,
    },
    submissionData: {
      repoUrl: { type: String, default: "" },
      liveDemoUrl: { type: String, default: "" },
      notes: { type: String, default: "" },
      submittedAt: { type: Date, default: null },
    },
    assignedMentorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    assignedAt: {
      type: Date,
      default: null,
    },
    reviewDeadline: {
      type: Date,
      default: null,
    },
    reviewResult: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SkillVerificationReview",
      default: null,
    },
    declinedFaculty: [
      {
        facultyId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        declinedAt: {
          type: Date,
          default: Date.now,
        },
        reason: {
          type: String,
          default: "",
        },
      },
    ],
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// Indexes for query performance and status tracking
skillVerificationAttemptSchema.index({ studentId: 1, skillName: 1, status: 1 });
skillVerificationAttemptSchema.index({ assignedMentorId: 1, status: 1 });

const SkillVerificationAttempt = mongoose.model(
  "SkillVerificationAttempt",
  skillVerificationAttemptSchema
);
export default SkillVerificationAttempt;
