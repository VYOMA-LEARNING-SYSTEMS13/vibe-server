import mongoose from "mongoose";
import TaskSubmission from "../models/TaskSubmission.js";
import TaskMania from "../models/TaskMania.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { sendZohoEmail } from "../services/zohoMail.js";
import { User } from "../models/Users.js";

// Get all tasks
export const getAllTasks = asyncHandler(async (req, res) => {
  const tasks = await TaskMania.find().populate("submissions");
  res.status(200).json(new ApiResponse(200, tasks, "All tasks fetched successfully"));
});

// Get task by ID
export const getTaskById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid task ID");
  }

  const task = await TaskMania.findById(id).populate("submissions");

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  res.status(200).json(new ApiResponse(200, task, "Task fetched successfully"));
});

// Get tasks by creator
export const getTasksByCreator = asyncHandler(async (req, res) => {
  const { creatorId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(creatorId)) {
    throw new ApiError(400, "Invalid creator ID");
  }

  const tasks = await TaskMania.find({ createdBy: creatorId }).populate("submissions");

  if (!tasks.length) {
    throw new ApiError(404, "No tasks found for this creator");
  }

  res.status(200).json(new ApiResponse(200, tasks, "Tasks by creator fetched successfully"));
});

// Create submission 
//need to add repolink addition code
export const createSubmission = asyncHandler(async (req, res) => {
  const { taskId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(taskId)) {
    throw new ApiError(400, "Invalid task ID");
  }

  const task = await TaskMania.findById(taskId);
  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  const submission = new TaskSubmission({...req.body, createdBy: req.user.id});
  await submission.save();

  task.submissions.push(submission._id);
  await task.save();


  const user = await User.findById(task.createdBy);






  // await sendZohoEmail(user.email,"submission",{
  //   taskTitle : task.title,
  //   link : `https://www.curioteach.com/community/manage-tasks/${submission._id}`
  // })



  res.status(201).json(new ApiResponse(201, submission, "Submission created successfully"));
});

// Update submission 
// update date need to take for froentend
export const updateSubmission = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid submission ID");
  }

  const updatedSubmission = await TaskSubmission.findByIdAndUpdate(
    id,
    req.body,
    { new: true, runValidators: true }
  )
    .populate("createdBy", "-password -otp")
    .populate("taskId");

  if (!updatedSubmission) {
    throw new ApiError(404, "Submission not found");
  }

  const candidate = updatedSubmission.createdBy;
  const task = updatedSubmission.taskId;
  const mailId = candidate?.email;

  const reviewer = await User.findById(req.user.id);

  // --- REVIEWED MAIL ---
  if (updatedSubmission.status === "reviewed") {
    await sendBrevoEmail(mailId, "review", {
      candidateName: candidate?.name,
      taskTitle: task?.title,
      score: updatedSubmission.score,
      feedback: updatedSubmission.reviewFeedback,
      reviewer: reviewer?.name,
      reviewLink: `https://www.curioteach.com/submissions/${updatedSubmission._id}`,
    });
  }

  // --- HIRED MAIL ---
  if (updatedSubmission.status === "hired") {
    await sendZohoEmail(mailId, "hired", {
      candidateName: candidate?.name,
      roleOffered: task?.roleOffered,
      packageRange: task?.packageRange,
      companyName: task?.companyName,
      skillsRequired: task?.skillsRequired,
      hrContact: task?.createdBy?.email || "hr@curioteach.com",
      detailsLink: `https://www.curioteach.com/offers/${updatedSubmission._id}`,
    });
  }

  res
    .status(200)
    .json(new ApiResponse(200, updatedSubmission, "Submission updated successfully"));
});

// Delete submission
export const deleteSubmission = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid submission ID");
  }

  const submission = await TaskSubmission.findById(id);
  if (!submission) {
    throw new ApiError(404, "Submission not found");
  }

  await TaskMania.findByIdAndUpdate(submission.taskId, {
    $pull: { submissions: submission._id },
  });

  await submission.deleteOne();

  res.status(200).json(new ApiResponse(200, {}, "Submission deleted successfully"));
});

// Get all submissions for a task
export const getSubmissionsByTaskId = asyncHandler(async (req, res) => {
  const { taskId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(taskId)) {
    throw new ApiError(400, "Invalid task ID");
  }

  const submissions = await TaskSubmission.find({ taskId }).populate("createdBy");

  if (!submissions.length) {
    throw new ApiError(404, "No submissions found for this task");
  }

  res.status(200).json(new ApiResponse(200, submissions, "Submissions fetched successfully"));
});

// Get a single submission by ID
export const getSubmissionById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid submission ID");
  }

  const submission = await TaskSubmission.findById(id).populate("createdBy taskId");

  if (!submission) {
    throw new ApiError(404, "Submission not found");
  }

  res.status(200).json(new ApiResponse(200, submission, "Submission fetched successfully"));
});

export const getMySubmissions = asyncHandler(async (req, res) => {
  const submissions = await TaskSubmission.find({ createdBy: req.user.id })
    .populate({
      path: "taskId",
      select: "title companyName roleOffered lastDateToSubmit createdBy",
      populate: { path: "createdBy", select: "name Profile", populate: { path: "Profile", select: "InstituteName" } },
    });
  res.status(200).json(new ApiResponse(200, submissions, "My submissions fetched successfully"));
});

export const applyForTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(taskId)) {
    throw new ApiError(400, "Invalid task ID");
  }
  const existing = await TaskSubmission.findOne({ taskId, createdBy: req.user.id });
  if (existing) {
    return res.status(200).json(new ApiResponse(200, existing, "Already applied"));
  }
  const sub = await TaskSubmission.create({
    taskId,
    createdBy: req.user.id,
    status: "applied",
  });
  res.status(201).json(new ApiResponse(201, sub, "Application created"));
});
