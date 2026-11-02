import express from "express";
import { verifyJWT } from "../middlewares/authMiddleware.js";
import {
  getFacultyEligibleStudents,
  createOrUpdateReview,
  updateReview,
  deleteReview,
  getStudentReviews,
  getFacultyMyReviews,
} from "../Controllers/mentorReview.controller.js";

const router = express.Router();

// Faculty routes
router.get("/students", verifyJWT, getFacultyEligibleStudents);
router.get("/my-reviews", verifyJWT, getFacultyMyReviews);
router.post("/", verifyJWT, createOrUpdateReview);
router.put("/:reviewId", verifyJWT, updateReview);
router.delete("/:reviewId", verifyJWT, deleteReview);

// Public / Student routes (authenticated users can fetch reviews for a student)
router.get("/student/:studentId", verifyJWT, getStudentReviews);

export default router;
