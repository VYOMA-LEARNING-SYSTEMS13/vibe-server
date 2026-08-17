import mongoose from "mongoose";

const taskSubmissionSchema = new mongoose.Schema(
  {
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TaskMania",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    projectTitle: {
      type: String,
      default: "",
    },
    submissionUrl: {
      type: String,
      default: "",
    },
    repoUrl: {
      type: String,
      default: "",
    },
    videoUrl: {
      type: String,
      default: "",
    },
    driveUrl: {
      type: String,
      default: "",
    },
    additionalLinks: {
      type: [String],
      default: [],
    },

    //teach stack
    attachments: {
      type: [String],
      default: [],
    },
    message: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["applied", "shortlisted", "interview_scheduled", "submitted", "reviewed", "hired", "rejected"],
      default: "applied",
    },
    score: {
      type: Number,
      default: 0,
    },
    reviewFeedback: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

taskSubmissionSchema.index({ taskId: 1, createdBy: 1 }, { unique: true });

const TaskSubmission = mongoose.model("TaskSubmission", taskSubmissionSchema);
export default TaskSubmission;
