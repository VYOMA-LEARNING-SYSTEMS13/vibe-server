import express from "express";
import { verifyJWT } from "../middlewares/authMiddleware.js";
import {
  requestSkillTask,
  submitSkillTask,
  getStudentActiveTasks,
  getMentorReviewQueue,
  declineSkillTaskAssignment,
  evaluateSkillTask,
} from "../Controllers/skillVerificationController.js";

const router = express.Router();

// Student routes
router.post("/request", verifyJWT, requestSkillTask);
router.post("/submit/:attemptId", verifyJWT, submitSkillTask);
router.get("/student/active", verifyJWT, getStudentActiveTasks);

// Mentor routes (Faculty Only & Double-Blind)
router.get("/mentor/queue", verifyJWT, getMentorReviewQueue);
router.post("/mentor/decline/:attemptId", verifyJWT, declineSkillTaskAssignment);
router.post("/mentor/evaluate/:attemptId", verifyJWT, evaluateSkillTask);

export default router;
