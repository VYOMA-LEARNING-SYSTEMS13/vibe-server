import mongoose from "mongoose";
import TaskSubmission from "../models/TaskSubmission.js";
import TaskMania from "../models/TaskMania.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { sendZohoEmail } from "../services/zohoMail.js";
import { notify } from "../services/notify.js";
import { User } from "../models/Users.js";
import { isTaskExpired } from "../utils/taskExpiry.js";

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

  // Enforce server-side deadline restriction for new submissions
  if (isTaskExpired(task)) {
    throw new ApiError(
      400,
      "This task's submission deadline has passed. New applications and submissions are closed."
    );
  }

  let submission = await TaskSubmission.findOne({ taskId, createdBy: req.user.id });
  if (submission) {
    Object.assign(submission, req.body, {
      status: "submitted",
    });
    await submission.save();
  } else {
    submission = new TaskSubmission({
      ...req.body,
      createdBy: req.user.id,
      status: "submitted",
    });
    await submission.save();
  }

  if (!task.submissions.includes(submission._id)) {
    task.submissions.push(submission._id);
    await task.save();
  }


  const user = await User.findById(task.createdBy);







  // await sendZohoEmail(user.email,"submission",{
  //   taskTitle : task.title,
  //   link : `https://www.curioteach.com/community/manage-tasks/${submission._id}`
  // })

  // In-app notification for the task creator (fire-and-forget, skip self-submits)
  if (task.createdBy && String(task.createdBy) !== String(req.user.id)) {
    const creatorUser = await User.findById(task.createdBy).select("accountType");
    const creatorRole = String(creatorUser?.accountType || "").trim().toLowerCase();
    const destinationLink =
      creatorRole === "faculty"
        ? "/dashboard/faculty?view=tasks"
        : "/dashboard/industry?tab=tasks";

    await notify({
      recipient: task.createdBy,
      sender: req.user.id,
      type: "submission_received",
      title: "New submission received",
      message: `${req.user?.name || "Someone"} submitted work for "${task.title || "your task"}"`,
      link: destinationLink,
      meta: { submissionId: submission._id, taskId: task._id },
    });
  }

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
    { returnDocument: "after", runValidators: true }
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
    try {
      await sendBrevoEmail(mailId, "review", {
        candidateName: candidate?.name,
        taskTitle: task?.title,
        score: updatedSubmission.score,
        feedback: updatedSubmission.reviewFeedback,
        reviewer: reviewer?.name,
        reviewLink: `https://www.curioteach.com/submissions/${updatedSubmission._id}`,
      });
    } catch (mailErr) {
      console.error("Review email failed:", mailErr.message || mailErr);
    }

    // In-app notification for the candidate (fire-and-forget)
    if (candidate?._id) {
      const taskRoute = (task?._id || task) ? `/tasks/${task?._id || task}` : "/dashboard/student?view=taskmania";
      await notify({
        recipient: candidate._id,
        sender: req.user.id,
        type: "submission_reviewed",
        title: "Your submission was reviewed",
        message: `${reviewer?.name || "A reviewer"} reviewed your work for "${task?.title || "a task"}"`,
        link: taskRoute,
        meta: { submissionId: updatedSubmission._id, taskId: task?._id || task },
      });
    }
  }

  // --- HIRED MAIL ---
  if (updatedSubmission.status === "hired") {
    try {
      await sendZohoEmail(mailId, "hired", {
        candidateName: candidate?.name,
        roleOffered: task?.roleOffered,
        packageRange: task?.packageRange,
        companyName: task?.companyName,
        skillsRequired: task?.skillsRequired,
        hrContact: task?.createdBy?.email || "hr@curioteach.com",
        detailsLink: `https://www.curioteach.com/offers/${updatedSubmission._id}`,
      });
    } catch (mailErr) {
      console.error("Hired email failed:", mailErr.message || mailErr);
    }

    // In-app notification for the candidate (fire-and-forget)
    if (candidate?._id) {
      const taskRoute = (task?._id || task) ? `/tasks/${task?._id || task}` : "/dashboard/student?view=taskmania";
      await notify({
        recipient: candidate._id,
        sender: req.user.id,
        type: "hired",
        title: "You're hired!",
        message: `Congratulations! You were hired for "${task?.roleOffered || task?.title || "a role"}" at ${task?.companyName || "a company"}`,
        link: taskRoute,
        meta: { submissionId: updatedSubmission._id, taskId: task?._id || task },
      });
    }
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
  const targetUserId = req.params.userId || req.user.id || req.user._id;
  const submissions = await TaskSubmission.find({ createdBy: targetUserId })
    .populate({
      path: "taskId",
      select: "title companyName roleOffered lastDateToSubmit createdBy packageRange location description",
      populate: { path: "createdBy", select: "name Profile", populate: { path: "Profile", select: "InstituteName avatar" } },
    });
  res.status(200).json(new ApiResponse(200, submissions || [], "Submissions fetched successfully"));
});

export const applyForTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(taskId)) {
    throw new ApiError(400, "Invalid task ID");
  }

  const task = await TaskMania.findById(taskId);
  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  // Enforce server-side deadline restriction for new submissions
  if (isTaskExpired(task)) {
    throw new ApiError(
      400,
      "This task's submission deadline has passed. New applications and submissions are closed."
    );
  }

  const existing = await TaskSubmission.findOne({ taskId, createdBy: req.user.id });
  if (existing) {
    return res.status(200).json(new ApiResponse(200, existing, "Task already accepted"));
  }

  const sub = await TaskSubmission.create({
    taskId,
    createdBy: req.user.id,
    status: "accepted",
  });

  if (!task.submissions.includes(sub._id)) {
    task.submissions.push(sub._id);
    await task.save();
  }

  res.status(201).json(new ApiResponse(201, sub, "Task accepted successfully"));
});
