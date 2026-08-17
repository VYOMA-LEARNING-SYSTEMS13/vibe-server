import TaskMania from "../models/TaskMania.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import mongoose from "mongoose";
import { User }  from "../models/Users.js";
// import { sendBrevoEmail } from "../services/brevoMail.js";
// import dns from "dns/promises";

// // Step 1: Syntax check (cheap + fast)
// function isSyntaxValid(email) {
//   return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
// }

// // Step 2: MX Record check (ensures domain can receive mail)
// async function isDomainValid(email) {
//   const domain = email.split("@")[1];
//   try {
//     const mxRecords = await dns.resolveMx(domain);
//     return mxRecords && mxRecords.length > 0;
//   } catch {
//     return false;
//   }
// }

// // Send a sample task notification email to all student users (except requester)
// export const sendSampleTask = asyncHandler(async (req, res) => {
//   const sampleTask = {
//     title: "Sample Task",
//     description: "This is a test notification to verify email delivery setup.",
//     link: "https://www.curioteach.com/community/taskmania",
//   };

//   // Collect all student emails
//   const recipients = await User.find(
//     { accountType: "student" },
//     "email"
//   ).lean();

//   const validEmails = [];
//   for (const user of recipients) {
//     const email = user.email;
//     if (isSyntaxValid(email) && await isDomainValid(email)) {
//       validEmails.push(email);
//     }
//   }

//   if (validEmails.length === 0) {
//     return res.status(400).json({
//       success: false,
//       message: "No valid student emails found",
//     });
//   }

//   try {
//     // Send one email with all recipients using Brevo BCC
//     await sendBrevoEmail(
//       validEmails, // pass array of emails
//       "task",
//       sampleTask,
//       { bcc: true }
//     );

//     console.log("Sent Brevo BCC email to:", validEmails.length, "students");

//     return res.status(200).json({
//       success: true,
//       message: "Sample task notification sent via Brevo",
//       sentTo: validEmails.length,
//     });
//   } catch (err) {
//     console.error("Brevo send error:", err);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to send sample task notification via Brevo",
//       error: err.message,
//     });
//   }
// });


// Create a new Task Mania Challenge
const createTask = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    instructions,
    roleOffered,
    packageRange,
    companyName,
    skillsRequired,
    projectSubmissionFormatURL,
    additionalDocumentsURL,
    lastDateToSubmit,
    perks,
    location,
  } = req.body;

  if (
    [
      title,
      description,
      roleOffered,
      packageRange,
      companyName,
      lastDateToSubmit,
      location,
    ].some((field) => !field?.trim())
  ) {
    throw new ApiError(400, "All required fields must be provided");
  }

  const newTask = await TaskMania.create({
    title,
    description,
    instructions,
    roleOffered,
    packageRange,
    companyName,
    skillsRequired,
    projectSubmissionFormatURL,
    additionalDocumentsURL,
    lastDateToSubmit,
    perks: perks || "",
    location: location || "Remote",
    createdBy: req.user._id,
  });

  await newTask.populate("createdBy","-password");

  // // Get all users who should be notified (e.g., all active users except the creator)
  // const recipients = await User.find(
  //   { 
  //     _id: { $ne: req.user.id }, 
  //     accountType: "student"
  //   },
  //   "email"
  // ).lean();

  // // Collect valid emails
  // const validEmails = [];
  // const invalidResults = [];

  // for (const user of recipients) {
  //   const email = user.email;

  //   if (!isSyntaxValid(email)) {
  //     invalidResults.push({ email, status: "invalid-syntax" });
  //     continue;
  //   }

  //   if (!(await isDomainValid(email))) {
  //     invalidResults.push({ email, status: "invalid-domain" });
  //     continue;
  //   }

  //   validEmails.push(email);
  // }

  // let results = [];

  // try {
  //   if (validEmails.length > 0) {
  //     // Send one email with all recipients using Brevo BCC
  //     await sendBrevoEmail(
  //       validEmails, // array of emails
  //       "task",
  //       {
  //         title: newTask.title,
  //         description: newTask.description,
  //         companyName: newTask.companyName,
  //         roleOffered: newTask.roleOffered,
  //         link: `https://vibe-platform-zeta.vercel.app/#/dashboard/industry`,
  //       },
  //       { bcc: true }
  //     );

  //     results = validEmails.map((email) => ({ email, status: "sent" }));
  //   }

  //   // Merge invalid + valid results
  //   results = [...results, ...invalidResults];
  // } catch (err) {
  //   console.error("Brevo send error:", err);
  //   results.push({ email: "all-brevo", status: "failed", error: err.message });
  // }

  // console.table(results);

  return res
    .status(201)
    .json(new ApiResponse(201, newTask, "Task Mania challenge created"));
});


//get all tasks

const getAllTasks = asyncHandler(async (req, res) => {
  const query = {};

  // If the user is a student, hide tasks 2 days after the deadline has passed
  if (req.user?.accountType === "student" && !req.user?.isAdmin) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 2);
    cutoffDate.setHours(0, 0, 0, 0); // Normalize to start of day for consistent filtering
    
    // Task is visible if lastDateToSubmit >= cutoffDate
    query.lastDateToSubmit = { $gte: cutoffDate };
    console.log(`Filtering tasks for student ${req.user.name}. Showing tasks with deadline >= ${cutoffDate.toISOString()}`);
  }

  const tasks = await TaskMania.find(query)
    .populate({
      path: "submissions",
      populate: {
        path: "createdBy",
        select: "-password -mobileNo -createdAt -updatedAt -otp",
      },
    })
    .populate({
      path: "createdBy",
      select: "-password -mobileNo -createdAt -updatedAt -otp",
    });

  // Return empty array instead of 404 so student view renders correctly
  return res
    .status(200)
    .json(new ApiResponse(200, tasks || [], "Fetched all Task Mania challenges"));
});


// Get a specific TaskMania by ID
const getTaskById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid Task ID");
  }

  const task = await TaskMania.findById(id).populate("submissions");

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, task, "Fetched task details successfully"));
});

// Get tasks created by the current user
const getMyTasks = asyncHandler(async (req, res) => {
  const tasks = await TaskMania.find({ createdBy: req.user._id }).populate({
      path: "submissions",
      populate: {
        path: "createdBy",
        select: "-password -mobileNo -createdAt -updatedAt -otp",
        populate: {
          path: "Profile",
          model: "Profile"
        }
      },
    })
    .populate({
      path: "createdBy",
      select: "-password -mobileNo -createdAt -updatedAt -otp",
    })

  return res
    .status(200)
    .json(new ApiResponse(200, tasks, "Fetched your created tasks"));
});

// Update a Task Mania Challenge
const updateTask = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid Task ID");
  }

  const task = await TaskMania.findById(id);

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  if (task.createdBy.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Unauthorized to update this task");
  }

  const updatedTask = await TaskMania.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
    omitUndefined: true, // This prevents fields not in req.body from being wiped
  });

  return res
    .status(200)
    .json(new ApiResponse(200, updatedTask, "Task updated successfully"));
});

// Delete a Task Mania Challenge
const deleteTask = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid Task ID");
  }

  const task = await TaskMania.findById(id);

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  if (task.createdBy.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Unauthorized to delete this task");
  }

  await TaskMania.findByIdAndDelete(id);

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Task deleted successfully"));
});

export {
  createTask,
  getAllTasks,
  getTaskById,
  getMyTasks,
  updateTask,
  deleteTask,
};
