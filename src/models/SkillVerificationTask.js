import mongoose from "mongoose";

const skillVerificationTaskSchema = new mongoose.Schema(
  {
    skillName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      enum: ["Technical", "Tools", "Soft Skills"],
      default: "Technical",
    },
    difficulty: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced"],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    problemStatement: {
      type: String,
      required: true,
    },
    requirements: [
      {
        type: String,
        required: true,
      },
    ],
    starterRepositoryUrl: {
      type: String,
      default: "",
    },
    rubric: [
      {
        criterion: { type: String, required: true },
        maxPoints: { type: Number, required: true },
      },
    ],
    estimatedTimeHours: {
      type: Number,
      default: 4,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Compound index for querying tasks by skill, difficulty, and active status
skillVerificationTaskSchema.index({ skillName: 1, difficulty: 1, isActive: 1 });

const SkillVerificationTask = mongoose.model("SkillVerificationTask", skillVerificationTaskSchema);
export default SkillVerificationTask;
