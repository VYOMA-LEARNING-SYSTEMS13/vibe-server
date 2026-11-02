import { verifyJWT } from "../middlewares/authMiddleware.js";
import express from "express";
import {
  getVirtualResume,
  updateVirtualResumeSkills,
} from "../Controllers/VirtualResumeController.js";

const router = express.Router();

// Virtual Resume routes
router.get("/:userId", verifyJWT, getVirtualResume);
router.put("/:userId/skills", verifyJWT, updateVirtualResumeSkills);

export default router;