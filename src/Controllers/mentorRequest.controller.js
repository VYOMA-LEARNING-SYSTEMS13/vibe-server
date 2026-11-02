import MentorRequest from "../models/MentorRequest.js";
import { User } from "../models/Users.js";
import TaskMania from "../models/TaskMania.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { notify } from "../services/notify.js";
import mongoose from "mongoose";

// Create a new Mentor Request
const createMentorRequest = asyncHandler(async (req, res) => {
  const { facultyId, taskId, message, skills } = req.body;
  const studentId = req.user._id; // from auth middleware

  // Enforce that only students can send mentorship requests
  const requesterRole = String(req.user.accountType || "").trim().toLowerCase();
  if (requesterRole !== "student") {
    throw new ApiError(403, "Only students can request faculty mentorship");
  }

  if (!facultyId || !taskId) {
    throw new ApiError(400, "Faculty ID and Task ID are required");
  }

  // Verify that faculty exists and is indeed a faculty member
  const faculty = await User.findById(facultyId);
  if (!faculty || String(faculty.accountType || "").trim().toLowerCase() !== "faculty") {
    throw new ApiError(404, "Invalid faculty selected");
  }

  // Verify task exists
  const task = await TaskMania.findById(taskId);
  if (!task) {
    throw new ApiError(404, "Task not found");
  }

  // Check if a request already exists between this student and faculty for this task
  const existingRequest = await MentorRequest.findOne({
    student: studentId,
    faculty: facultyId,
    task: taskId,
  });

  if (existingRequest) {
    throw new ApiError(409, "You have already requested this faculty for this task");
  }

  const newRequest = await MentorRequest.create({
    student: studentId,
    faculty: facultyId,
    task: taskId,
    message: message || "",
    skills: skills || [],
  });

  // In-app notification for the faculty (fire-and-forget)
  await notify({
    recipient: facultyId,
    sender: studentId,
    type: "mentor_request",
    title: "New mentorship request",
    message: `${req.user?.name || "A student"} requested your mentorship for "${task.title || "a task"}"`,
    link: "/dashboard/faculty?view=mentorship",
    meta: { requestId: newRequest._id, taskId },
  });

  return res
    .status(201)
    .json(new ApiResponse(201, newRequest, "Mentor request sent successfully"));
});

// Get all requests for a specific faculty member
const getFacultyRequests = asyncHandler(async (req, res) => {
  const targetFacultyId = req.params.facultyId || req.user._id;
  const isOwner = req.user._id.toString() === targetFacultyId.toString();

  const query = { faculty: targetFacultyId };
  if (!isOwner) {
    // When viewing faculty publicly, only show accepted mentorships
    query.status = "accepted";
  } else {
    const role = String(req.user.accountType || "").trim().toLowerCase();
    if (role !== "faculty") {
      throw new ApiError(403, `Only faculty members can view these requests (your accountType is '${req.user.accountType}')`);
    }
  }

  const requests = await MentorRequest.find(query)
    .populate({
      path: "student",
      select: "name email Profile",
      populate: {
        path: "Profile",
      },
    })
    .populate({
      path: "task",
      select: "title companyName category lastDateToSubmit roleOffered createdBy",
      populate: {
        path: "createdBy",
        select: "name Profile",
        populate: { path: "Profile", select: "avatar" },
      },
    })
    .sort({ createdAt: -1 });

  return res
    .status(200)
    .json(new ApiResponse(200, requests || [], "Fetched all mentor requests"));
});

// Get all requests for a specific student
const getStudentRequests = asyncHandler(async (req, res) => {
  const studentId = req.user._id;

  const requests = await MentorRequest.find({ student: studentId })
    .populate({
      path: "faculty",
      select: "name email Profile accountType",
      populate: {
        path: "Profile",
      },
    })
    .populate("task", "title companyName category lastDateToSubmit roleOffered")
    .sort({ createdAt: -1 });

  return res
    .status(200)
    .json(new ApiResponse(200, requests, "Fetched all student mentor requests"));
});

// Update mentor request status
const updateRequestStatus = asyncHandler(async (req, res) => {
  const { requestId } = req.params;
  const { status, meetLink, resources } = req.body; // "accepted" or "rejected"

  if (!["accepted", "rejected"].includes(status)) {
    throw new ApiError(400, "Invalid status");
  }

  if (status === "accepted" && (!meetLink || meetLink.trim() === "")) {
    throw new ApiError(400, "Meeting link is required when accepting a request");
  }

  const request = await MentorRequest.findById(requestId);

  if (!request) {
    throw new ApiError(404, "Mentor request not found");
  }

  // Ensure only the assigned faculty can update the status
  if (request.faculty.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "Unauthorized to update this request");
  }

  request.status = status;
  if (status === "accepted") {
    request.meetLink = meetLink;
    if (resources && Array.isArray(resources)) {
      request.resources = resources;
    }
  }
  await request.save();

  // Resolve recipient user accountType to ensure correct dashboard routing
  const studentUser = await User.findById(request.student).select("accountType");
  const studentRole = String(studentUser?.accountType || "student").trim().toLowerCase();
  const destinationRole = studentRole === "industry expert" ? "industry" : studentRole === "faculty" ? "faculty" : "student";
  const destinationLink = `/dashboard/${destinationRole}?view=requests`;

  // In-app notification for the student (fire-and-forget)
  await notify({
    recipient: request.student,
    sender: req.user._id,
    type: status === "accepted" ? "request_accepted" : "request_rejected",
    title: status === "accepted" ? "Mentorship request accepted" : "Mentorship request declined",
    message:
      status === "accepted"
        ? `${req.user?.name || "Your mentor"} accepted your request${meetLink ? ` — meet link: ${meetLink}` : ""}`
        : `${req.user?.name || "Your mentor"} declined your mentorship request`,
    link: destinationLink,
    meta: { requestId: request._id },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, request, `Mentor request ${status} successfully`));
});

// Get all faculty for students to select from
const getAllFaculty = asyncHandler(async (req, res) => {
  console.log("Fetching all faculty mentors for user:", req.user?._id);
  
  // Strictly fetch only faculty members who do NOT have industry-specific profile data
  const faculty = await User.find({ 
    accountType: "faculty"
  })
    .select("name email Profile accountType")
    .populate({
      path: "Profile",
      select: "InstituteName ExpertiseDomains IndustryType position",
    });

  // Additional safety filter: ensure no "industry" specific fields are being misused
  const filteredFaculty = faculty.filter(f => {
    // If they have an IndustryType but no InstituteName, they might be miscategorized
    if (f.Profile?.IndustryType && !f.Profile?.InstituteName) return false;
    return true;
  });

  console.log(`Found ${filteredFaculty.length} verified faculty mentors`);
  
  return res
    .status(200)
    .json(new ApiResponse(200, filteredFaculty, "Fetched all faculty members"));
});

export {
  createMentorRequest,
  getFacultyRequests,
  getStudentRequests,
  updateRequestStatus,
  getAllFaculty,
};
