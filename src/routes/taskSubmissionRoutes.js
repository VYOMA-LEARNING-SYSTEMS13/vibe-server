import express from "express";
import {
  getAllTasks,
  getTaskById,
  getTasksByCreator,
  createSubmission,
  updateSubmission,
  deleteSubmission,
  getSubmissionsByTaskId,
  getSubmissionById,
  getMySubmissions,
  applyForTask,
} from "../Controllers/taskSubmission.controller.js";
import { verifyJWT } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Submission related routes
router.post("/submit", verifyJWT, createSubmission);
router.get("/task/:taskId", verifyJWT, getSubmissionsByTaskId);
router.get("/me", verifyJWT, getMySubmissions);
router.post("/apply/:taskId", verifyJWT, applyForTask);

router.get("/:id", verifyJWT, getSubmissionById);
router.put("/:id", verifyJWT, updateSubmission);
router.delete("/:id", verifyJWT, deleteSubmission);


export default router;
