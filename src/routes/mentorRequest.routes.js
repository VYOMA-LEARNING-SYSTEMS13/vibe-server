import express from "express";
import {
  createMentorRequest,
  getFacultyRequests,
  getStudentRequests,
  updateRequestStatus,
  getAllFaculty,
} from "../Controllers/mentorRequest.controller.js";
import { verifyJWT } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Apply auth middleware to all mentor request routes
router.use(verifyJWT);

// Student routes
router.get("/all-faculty", getAllFaculty);
router.post("/request", createMentorRequest);
router.get("/my-requests", getStudentRequests);

// Faculty routes
router.get("/faculty-requests", getFacultyRequests);
router.get("/faculty/:facultyId", getFacultyRequests);
router.patch("/update-status/:requestId", updateRequestStatus);

export default router;
