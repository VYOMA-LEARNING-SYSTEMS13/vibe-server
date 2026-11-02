import mongoose from "mongoose";
import MentorReview from "../models/MentorReview.js";
import MentorRequest from "../models/MentorRequest.js";
import { User } from "../models/Users.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { notify } from "../services/notify.js";

/**
 * Get all students the logged-in faculty is authorized to review
 * (i.e., students with at least one accepted mentor request)
 */
export const getFacultyEligibleStudents = asyncHandler(async (req, res) => {
  const facultyRole = String(req.user.accountType || "").trim().toLowerCase();
  if (facultyRole !== "faculty") {
    throw new ApiError(403, "Only faculty members can access mentored student reviews");
  }

  const facultyId = req.user._id;

  // 1. Find all accepted mentorship requests for this faculty
  const acceptedRequests = await MentorRequest.find({
    faculty: facultyId,
    status: "accepted",
  })
    .populate({
      path: "student",
      select: "name email ImageUrl Profile skills",
      populate: {
        path: "Profile",
        select: "InstituteName degree branch yearOfStudy skills",
      },
    })
    .populate({
      path: "task",
      select: "title category roleOffered companyName",
    })
    .sort({ createdAt: -1 });

  // 2. Find all reviews previously submitted by this faculty
  const existingReviews = await MentorReview.find({ faculty: facultyId });
  const reviewMap = new Map();
  existingReviews.forEach((rev) => {
    reviewMap.set(rev.student.toString(), rev);
  });

  // 3. Group by unique student
  const studentMap = new Map();

  acceptedRequests.forEach((reqItem) => {
    if (!reqItem.student || !reqItem.student._id) return;
    const sId = reqItem.student._id.toString();

    if (!studentMap.has(sId)) {
      const studentObj = reqItem.student;
      const profile = studentObj.Profile || {};

      // Collect student skills from Profile or User document
      const studentSkills = [];
      if (Array.isArray(profile.skills)) {
        profile.skills.forEach((sk) => {
          const name = typeof sk === "string" ? sk.trim() : sk?.name?.trim();
          if (name && !studentSkills.includes(name)) studentSkills.push(name);
        });
      }
      if (studentSkills.length === 0 && Array.isArray(studentObj.skills)) {
        studentObj.skills.forEach((sk) => {
          const name = typeof sk === "string" ? sk.trim() : sk?.name?.trim();
          if (name && !studentSkills.includes(name)) studentSkills.push(name);
        });
      }

      studentMap.set(sId, {
        student: {
          _id: studentObj._id,
          name: studentObj.name || "Student",
          email: studentObj.email || "",
          avatar: studentObj.ImageUrl || "",
          college: profile.InstituteName || "N/A",
          degree: profile.degree || "N/A",
          branch: profile.branch || "N/A",
          yearOfStudy: profile.yearOfStudy || "N/A",
          skills: studentSkills,
        },
        mentorshipStatus: "accepted",
        tasks: [],
        hasReview: reviewMap.has(sId),
        review: reviewMap.get(sId) || null,
        latestMentorshipDate: reqItem.createdAt,
      });
    }

    const currentEntry = studentMap.get(sId);
    currentEntry.tasks.push({
      requestId: reqItem._id,
      taskId: reqItem.task?._id,
      title: reqItem.task?.title || "Mentorship Session",
      category: reqItem.task?.category || "General",
      roleOffered: reqItem.task?.roleOffered || "",
      companyName: reqItem.task?.companyName || "",
      requestedAt: reqItem.createdAt,
    });
  });

  const eligibleStudents = Array.from(studentMap.values());
  const reviewedCount = eligibleStudents.filter((s) => s.hasReview).length;
  const pendingCount = eligibleStudents.length - reviewedCount;

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        students: eligibleStudents,
        totalEligible: eligibleStudents.length,
        reviewedCount,
        pendingCount,
      },
      "Fetched eligible mentored students successfully"
    )
  );
});

/**
 * Create or update a review for an eligible mentored student
 */
export const createOrUpdateReview = asyncHandler(async (req, res) => {
  const facultyRole = String(req.user.accountType || "").trim().toLowerCase();
  if (facultyRole !== "faculty") {
    throw new ApiError(403, "Only faculty members can submit student reviews");
  }

  const { studentId, rating, feedback, skills, designation } = req.body;

  if (!studentId || !mongoose.isValidObjectId(studentId)) {
    throw new ApiError(400, "Valid student ID is required");
  }

  // Verify student exists and is a student
  const student = await User.findById(studentId);
  if (!student) {
    throw new ApiError(404, "Student not found");
  }

  // Authorization check: faculty must have an accepted mentorship request with this student
  const hasAcceptedMentorship = await MentorRequest.exists({
    faculty: req.user._id,
    student: studentId,
    status: "accepted",
  });

  if (!hasAcceptedMentorship) {
    throw new ApiError(
      403,
      "You are only authorized to review students who have an accepted mentorship relationship with you"
    );
  }

  // Validate rating
  const numRating = Number(rating);
  if (!numRating || numRating < 1 || numRating > 5 || !Number.isInteger(numRating)) {
    throw new ApiError(400, "Rating must be an integer between 1 and 5 stars");
  }

  // Validate feedback
  if (!feedback || typeof feedback !== "string" || feedback.trim().length < 5) {
    throw new ApiError(400, "Written feedback must be at least 5 characters long");
  }

  // Sanitize skills
  const sanitizedSkills = Array.isArray(skills)
    ? skills
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter(Boolean)
        .slice(0, 10)
    : [];

  // Determine faculty designation / context
  let finalDesignation = "";
  if (typeof designation === "string" && designation.trim()) {
    finalDesignation = designation.trim();
  } else {
    const facultyUser = await User.findById(req.user._id).populate("Profile");
    const parts = [
      facultyUser?.Profile?.position,
      facultyUser?.Profile?.InstituteName,
    ].filter(Boolean);
    finalDesignation = parts.join(" • ") || "Faculty Mentor";
  }

  // Upsert the review (prevents accidental duplicate reviews by the same mentor for the same student)
  const review = await MentorReview.findOneAndUpdate(
    { student: studentId, faculty: req.user._id },
    {
      student: studentId,
      faculty: req.user._id,
      rating: numRating,
      feedback: feedback.trim(),
      skills: sanitizedSkills,
      designation: finalDesignation,
    },
    { new: true, upsert: true, runValidators: true }
  ).populate({
    path: "faculty",
    select: "name ImageUrl Profile accountType",
    populate: { path: "Profile", select: "position InstituteName branch department" },
  });

  // Notify student (fire-and-forget)
  notify({
    recipient: studentId,
    sender: req.user._id,
    type: "mentor_review",
    title: "New Mentor Review on Virtual CV",
    message: `${req.user?.name || "Your faculty mentor"} provided a verified review on your Virtual CV`,
    link: "/dashboard/student?view=virtual-cv",
    meta: { reviewId: review._id },
  }).catch((err) => console.warn("Failed to send review notification:", err));

  return res
    .status(200)
    .json(new ApiResponse(200, review, "Mentor review saved successfully"));
});

/**
 * Edit an existing review (must be the author)
 */
export const updateReview = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  const { rating, feedback, skills, designation } = req.body;

  if (!reviewId || !mongoose.isValidObjectId(reviewId)) {
    throw new ApiError(400, "Valid review ID is required");
  }

  const review = await MentorReview.findById(reviewId);
  if (!review) {
    throw new ApiError(404, "Mentor review not found");
  }

  // Enforce ownership: only the reviewer faculty member can edit
  if (review.faculty.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You can only edit your own reviews");
  }

  if (rating !== undefined) {
    const numRating = Number(rating);
    if (!numRating || numRating < 1 || numRating > 5 || !Number.isInteger(numRating)) {
      throw new ApiError(400, "Rating must be an integer between 1 and 5 stars");
    }
    review.rating = numRating;
  }

  if (feedback !== undefined) {
    if (typeof feedback !== "string" || feedback.trim().length < 5) {
      throw new ApiError(400, "Written feedback must be at least 5 characters long");
    }
    review.feedback = feedback.trim();
  }

  if (skills !== undefined && Array.isArray(skills)) {
    review.skills = skills
      .map((s) => (typeof s === "string" ? s.trim() : ""))
      .filter(Boolean)
      .slice(0, 10);
  }

  if (designation !== undefined && typeof designation === "string") {
    review.designation = designation.trim();
  }

  await review.save();

  const populatedReview = await MentorReview.findById(review._id).populate({
    path: "faculty",
    select: "name ImageUrl Profile accountType",
    populate: { path: "Profile", select: "position InstituteName branch department" },
  });

  return res
    .status(200)
    .json(new ApiResponse(200, populatedReview, "Mentor review updated successfully"));
});

/**
 * Delete a review (must be the author)
 */
export const deleteReview = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;

  if (!reviewId || !mongoose.isValidObjectId(reviewId)) {
    throw new ApiError(400, "Valid review ID is required");
  }

  const review = await MentorReview.findById(reviewId);
  if (!review) {
    throw new ApiError(404, "Mentor review not found");
  }

  // Enforce ownership: only the reviewer faculty member can delete
  if (review.faculty.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You can only delete your own reviews");
  }

  await review.deleteOne();

  return res
    .status(200)
    .json(new ApiResponse(200, { reviewId }, "Mentor review deleted successfully"));
});

/**
 * Get all reviews for a specific student (Used by Student Virtual CV & Profile views)
 */
export const getStudentReviews = asyncHandler(async (req, res) => {
  const { studentId } = req.params;

  if (!studentId || !mongoose.isValidObjectId(studentId)) {
    throw new ApiError(400, "Valid student ID is required");
  }

  const student = await User.findById(studentId).select("name accountType");
  if (!student) {
    throw new ApiError(404, "Student not found");
  }

  const reviews = await MentorReview.find({ student: studentId })
    .populate({
      path: "faculty",
      select: "name ImageUrl Profile accountType",
      populate: { path: "Profile", select: "position InstituteName branch department" },
    })
    .sort({ createdAt: -1 });

  const totalReviews = reviews.length;
  const averageRating =
    totalReviews > 0
      ? Number((reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / totalReviews).toFixed(1))
      : null;

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        reviews,
        totalReviews,
        averageRating,
      },
      "Fetched student mentor reviews successfully"
    )
  );
});

/**
 * Get all reviews submitted by the authenticated faculty member
 */
export const getFacultyMyReviews = asyncHandler(async (req, res) => {
  const facultyRole = String(req.user.accountType || "").trim().toLowerCase();
  if (facultyRole !== "faculty") {
    throw new ApiError(403, "Only faculty members can view their submitted reviews");
  }

  const reviews = await MentorReview.find({ faculty: req.user._id })
    .populate({
      path: "student",
      select: "name ImageUrl Profile",
      populate: { path: "Profile", select: "InstituteName degree branch yearOfStudy" },
    })
    .sort({ createdAt: -1 });

  return res
    .status(200)
    .json(new ApiResponse(200, reviews, "Fetched faculty submitted reviews"));
});
