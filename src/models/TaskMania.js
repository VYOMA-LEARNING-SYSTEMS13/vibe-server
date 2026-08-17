import mongoose from "mongoose";

const taskManiaSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    instructions: {
      type: [String],
      default: [],
    },
    roleOffered: {
      type: String,
      required: true,
    },
    packageRange: {
      type: String,
      required: true,
    },
    companyName: {
      type: String,
      required: true,
    },
    skillsRequired: {
      type: [String],
      default: [],
    },
    projectSubmissionFormatURL: {
      type: String,
      default: "",
    },
    additionalDocumentsURL: {
      type: String,
      default: "",
    },
    perks: {
      type: String,
      default: "",
    },
    location: {
      type: String,
      required: true,
      default: "Remote",
    },
    submissions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TaskSubmission",
        default: [],
      },
    ],
    lastDateToSubmit: {
      type: Date,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const TaskMania = mongoose.model("TaskMania", taskManiaSchema);
export default TaskMania;