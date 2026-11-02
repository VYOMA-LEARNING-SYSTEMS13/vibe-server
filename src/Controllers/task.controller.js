import TaskMania from "../models/TaskMania.js";
import TaskSubmission from "../models/TaskSubmission.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import mongoose from "mongoose";
import { User }  from "../models/Users.js";
import Profile from "../models/Profile.js";
import { rankTasksForStudent } from "../utils/recommendationEngine.js";
import { isTaskExpired } from "../utils/taskExpiry.js";
import { ZipArchive } from "archiver";
import axios from "axios";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

// Helper to parse array fields from multipart/form-data or json
const parseArrayField = (field) => {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  if (typeof field === "string") {
    try {
      const parsed = JSON.parse(field);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return field
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [field];
  }
  return [];
};
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
    ].some((field) => !field || (typeof field === "string" && !field.trim()))
  ) {
    throw new ApiError(400, "All required fields must be provided");
  }

  // Upload materials to Cloudinary if files were attached
  let uploadedMaterials = [];
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      const cloudRes = await uploadOnCloudinary(file.path, {
        folder: "task_materials",
        use_filename: true,
      });
      if (cloudRes) {
        uploadedMaterials.push({
          name: file.originalname,
          url: cloudRes.secure_url || cloudRes.url,
          publicId: cloudRes.public_id,
          format: cloudRes.format || file.originalname.split(".").pop(),
          resourceType: cloudRes.resource_type || "auto",
          size: cloudRes.bytes || file.size || 0,
        });
      }
    }
  }

  const newTask = await TaskMania.create({
    title,
    description,
    instructions: parseArrayField(instructions),
    roleOffered,
    packageRange,
    companyName,
    skillsRequired: parseArrayField(skillsRequired),
    projectSubmissionFormatURL: projectSubmissionFormatURL || "",
    additionalDocumentsURL: additionalDocumentsURL || "",
    materials: uploadedMaterials,
    lastDateToSubmit,
    perks: perks || "",
    location: location || "Remote",
    createdBy: req.user._id,
  });

  await newTask.populate("createdBy", "-password");

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


// Get all tasks (includes both active and eligible expired tasks, always ordered active first)
const getAllTasks = asyncHandler(async (req, res) => {
  const query = {};

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

  let finalTasks = tasks || [];

  if (req.user?.accountType === "student") {
    let userProfile = null;
    if (req.user.Profile) {
      userProfile = await Profile.findById(req.user.Profile).lean();
    }

    const manualOrder = (req.user.taskOrder || [])
      .filter(Boolean)
      .map((id) => id.toString());

    finalTasks = rankTasksForStudent(finalTasks, req.user, userProfile, manualOrder);
  } else {
    // For non-students: active tasks first, expired tasks last
    const activeTasks = finalTasks.filter((t) => !isTaskExpired(t));
    const expiredTasks = finalTasks.filter((t) => isTaskExpired(t));
    finalTasks = [...activeTasks, ...expiredTasks];
  }

  return res.status(200).json(new ApiResponse(200, finalTasks, "Fetched all Task Mania challenges"));
});


// Get a specific TaskMania by ID
const getTaskById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid Task ID");
  }

  const task = await TaskMania.findById(id)
    .populate({
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
      populate: {
        path: "Profile",
        model: "Profile"
      }
    });

  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  // Check if current user is creator, admin, accepted applicant, or faculty mentor
  const isCreator = String(task.createdBy?._id || task.createdBy) === String(req.user?._id || req.user?.id);
  const isAdmin = req.user?.isAdmin || req.user?.accountType === "admin";
  const isFaculty = String(req.user?.accountType || req.user?.role || "").toLowerCase() === "faculty";
  let isAccepted = false;

  if (!isCreator && !isAdmin && !isFaculty && req.user) {
    const sub = await TaskSubmission.findOne({
      taskId: task._id,
      createdBy: req.user._id || req.user.id,
    });
    if (sub && sub.status !== "rejected") {
      isAccepted = true;
    }
  }

  const taskObj = task.toObject();
  const isMaterialsUnlocked = Boolean(isCreator || isAdmin || isAccepted || isFaculty);
  taskObj.isMaterialsUnlocked = isMaterialsUnlocked;

  // Mask sensitive URLs if student has not accepted the task yet
  if (!isMaterialsUnlocked && Array.isArray(taskObj.materials)) {
    taskObj.materials = taskObj.materials.map((m) => ({
      name: m.name,
      format: m.format,
      size: m.size,
    }));
  }

  return res
    .status(200)
    .json(new ApiResponse(200, taskObj, "Fetched task details successfully"));
});

// Get tasks created by the current user (active tasks first, expired tasks last)
const getMyTasks = asyncHandler(async (req, res) => {
  const tasks = await TaskMania.find({ createdBy: req.user._id })
    .populate({
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
      populate: {
        path: "Profile",
        model: "Profile"
      }
    })
    .sort({ createdAt: -1 });

  const taskList = tasks || [];
  const activeTasks = taskList.filter((t) => !isTaskExpired(t));
  const expiredTasks = taskList.filter((t) => isTaskExpired(t));

  return res
    .status(200)
    .json(new ApiResponse(200, [...activeTasks, ...expiredTasks], "Fetched your created tasks"));
});

// Get tasks created by a specific company/user or current user (active tasks first, expired tasks last)
const getTasksByCompany = asyncHandler(async (req, res) => {
  const companyId = req.params.userId || req.user._id;

  const query = { createdBy: companyId };

  const tasks = await TaskMania.find(query)
    .populate({
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
      populate: {
        path: "Profile",
        model: "Profile"
      }
    })
    .sort({ createdAt: -1 });

  const taskList = tasks || [];
  const activeTasks = taskList.filter((t) => !isTaskExpired(t));
  const expiredTasks = taskList.filter((t) => isTaskExpired(t));

  return res
    .status(200)
    .json(new ApiResponse(200, [...activeTasks, ...expiredTasks], "Fetched company tasks"));
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

  // Parse existing materials retained by client if provided
  let currentMaterials = task.materials || [];
  if (req.body.existingMaterials !== undefined) {
    try {
      currentMaterials = typeof req.body.existingMaterials === "string"
        ? JSON.parse(req.body.existingMaterials)
        : req.body.existingMaterials;
    } catch {
      currentMaterials = task.materials || [];
    }
  }

  // Upload any newly attached materials
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      const cloudRes = await uploadOnCloudinary(file.path, {
        folder: "task_materials",
        use_filename: true,
      });
      if (cloudRes) {
        currentMaterials.push({
          name: file.originalname,
          url: cloudRes.secure_url || cloudRes.url,
          publicId: cloudRes.public_id,
          format: cloudRes.format || file.originalname.split(".").pop(),
          resourceType: cloudRes.resource_type || "auto",
          size: cloudRes.bytes || file.size || 0,
        });
      }
    }
  }

  const updateData = { ...req.body };
  if (req.body.instructions !== undefined) {
    updateData.instructions = parseArrayField(req.body.instructions);
  }
  if (req.body.skillsRequired !== undefined) {
    updateData.skillsRequired = parseArrayField(req.body.skillsRequired);
  }
  updateData.materials = currentMaterials;

  const updatedTask = await TaskMania.findByIdAndUpdate(id, updateData, {
    returnDocument: "after",
    runValidators: true,
    omitUndefined: true,
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

// Download all task materials bundled into a zip archive
const downloadTaskMaterialsZip = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid Task ID");
  }

  const task = await TaskMania.findById(id);
  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  // Authorization Check: Must be creator, admin, accepted applicant, or faculty mentor
  const isCreator = String(task.createdBy) === String(req.user._id || req.user.id);
  const isAdmin = req.user?.isAdmin || req.user?.accountType === "admin";
  const isFaculty = String(req.user?.accountType || req.user?.role || "").toLowerCase() === "faculty";

  let isAccepted = false;
  if (!isCreator && !isAdmin && !isFaculty && req.user) {
    const submission = await TaskSubmission.findOne({
      taskId: id,
      createdBy: req.user._id || req.user.id,
    });
    if (submission && submission.status !== "rejected") {
      isAccepted = true;
    }
  }

  if (!isCreator && !isAdmin && !isAccepted && !isFaculty) {
    throw new ApiError(
      403,
      "Access denied. You must accept this task first before downloading the required materials."
    );
  }

  if (!task.materials || task.materials.length === 0) {
    throw new ApiError(404, "No materials were uploaded for this task.");
  }

  const sanitizedTitle = (task.title || "task")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 50);

  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${sanitizedTitle}_materials.zip"`
  );

  const archive = new ZipArchive({ zlib: { level: 9 } });

  archive.on("error", (err) => {
    console.error("Archive error:", err);
    if (!res.headersSent) {
      res.status(500).json(new ApiResponse(500, null, "Failed to create materials zip archive"));
    }
  });

  archive.pipe(res);

  // Stream each file from Cloudinary into the zip archive
  for (const item of task.materials) {
    try {
      const response = await axios({
        method: "get",
        url: item.url,
        responseType: "stream",
        timeout: 30000,
      });

      const fileName = item.name || `file_${Date.now()}`;
      archive.append(response.data, { name: fileName });
    } catch (fetchErr) {
      console.error(`Failed to fetch file ${item.name} from Cloudinary:`, fetchErr.message);
      archive.append(
        `Failed to retrieve file from Cloudinary: ${item.name}\nURL: ${item.url}\nError: ${fetchErr.message}`,
        { name: `${item.name}_download_error.txt` }
      );
    }
  }

  await archive.finalize();
});


// Toggle bookmark for a task
const toggleTaskBookmark = asyncHandler(async (req, res) => {
  const role = String(req.user?.accountType || req.user?.role || "").trim().toLowerCase();
  if (role !== "student") {
    throw new ApiError(403, "Access denied. Only students are authorized to bookmark tasks.");
  }

  const { taskId } = req.body;
  const userId = req.user._id;

  if (!taskId) {
    throw new ApiError(400, "Task ID is required");
  }

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  if (!user.taskBookmarks) {
    user.taskBookmarks = [];
  }

  const isBookmarked = user.taskBookmarks.some((b) => b && b.toString() === String(taskId));
  let bookmarked = false;

  if (isBookmarked) {
    user.taskBookmarks = user.taskBookmarks.filter((b) => b && b.toString() !== String(taskId));
    bookmarked = false;
  } else {
    const task = await TaskMania.findById(taskId);
    if (!task) throw new ApiError(404, "Task not found");

    user.taskBookmarks.push(taskId);
    bookmarked = true;
  }

  await user.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      { bookmarked, taskBookmarks: user.taskBookmarks },
      bookmarked ? "Task bookmarked" : "Task bookmark removed"
    )
  );
});

// Get all bookmarked tasks for current user
const getBookmarkedTasks = asyncHandler(async (req, res) => {
  const role = String(req.user?.accountType || req.user?.role || "").trim().toLowerCase();
  if (role !== "student") {
    throw new ApiError(403, "Access denied. Only students can view bookmarked tasks.");
  }

  const userId = req.user._id;

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  const taskBookmarkIds = (user.taskBookmarks || [])
    .filter(Boolean)
    .map((id) => (id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id)));

  if (taskBookmarkIds.length === 0) {
    return res
  
      .status(200)
  
      .json(new ApiResponse(200, [], "Fetched bookmarked tasks successfully"));
  }

  const bookmarkedTasks = await TaskMania.find({ _id: { $in: taskBookmarkIds } })
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
    })
    .sort({ createdAt: -1 });

  const taskList = bookmarkedTasks || [];
  const activeBookmarked = taskList.filter((t) => !isTaskExpired(t));
  const expiredBookmarked = taskList.filter((t) => isTaskExpired(t));

  return res
    .status(200)
    .json(new ApiResponse(200, [...activeBookmarked, ...expiredBookmarked], "Fetched bookmarked tasks successfully"));
});


// Get task order preferences for current user
const getTaskOrder = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  const taskOrder = (user.taskOrder || [])
    .filter(Boolean)
    .map((id) => id.toString());

  return res.status(200).json(
    new ApiResponse(200, { taskOrder }, "Task order fetched successfully")
  );
});

// Update task order preferences for current user
const updateTaskOrder = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { taskOrder } = req.body;

  if (!Array.isArray(taskOrder)) {
    throw new ApiError(400, "taskOrder must be an array of task IDs");
  }

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  // Deduplicate and filter valid ObjectIds
  const seen = new Set();
  const validOrder = [];

  for (const id of taskOrder) {
    const strId = String(id).trim();
    if (mongoose.Types.ObjectId.isValid(strId) && !seen.has(strId)) {
      seen.add(strId);
      validOrder.push(new mongoose.Types.ObjectId(strId));
    }
  }

  user.taskOrder = validOrder;
  await user.save({ validateBeforeSave: false });

  return res.status(200).json(
    new ApiResponse(
      200,
      { taskOrder: validOrder.map((id) => id.toString()) },
      "Task order updated successfully"
    )
  );
});

export {
  getTaskOrder,
  updateTaskOrder,
  createTask,
  getAllTasks,
  getTaskById,
  getMyTasks,
  getTasksByCompany,
  updateTask,
  deleteTask,
  downloadTaskMaterialsZip,
  toggleTaskBookmark,
  getBookmarkedTasks,
};
