import { verifyJWT} from "../middlewares/authMiddleware.js";
import express from "express";
import { getVirtualResume } from "../Controllers/VirtualResumeController.js";


const router = express.Router();

// Virtual Resume route
router.get("/:userId", verifyJWT, getVirtualResume);
export default router;