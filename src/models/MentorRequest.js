import mongoose from "mongoose";

const mentorRequestSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    faculty: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TaskMania",
      required: true,
    },
    message: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    skills: {
      type: [String],
      default: [],
    },
    meetLink: {
      type: String,
      default: "",
    },
    resources: [
      {
        label: { type: String, required: true },
        url: { type: String, required: true },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Optimize querying mentor requests by faculty or student
mentorRequestSchema.index({ faculty: 1, status: 1 });
mentorRequestSchema.index({ student: 1 });

const MentorRequest = mongoose.model("MentorRequest", mentorRequestSchema);
export default MentorRequest;
