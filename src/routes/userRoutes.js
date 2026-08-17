import express from "express";
import {
  registerUser,
  loginUser,
  getUserById,
  updateUser,
  logoutUser,
  getCurrentUser,
  forgotPassword,
  resetPassword,
  sendOtp,
} from "../Controllers/userControllers.js";

import { verifyJWT } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Public Routes
router.post("/register", sendOtp);
router.post("/verify-otp", registerUser);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Protected Routes
router.get("/me", verifyJWT, getCurrentUser);
router.post("/logout", verifyJWT, logoutUser);

router.post("/verify-token", verifyJWT, (req, res) => {
  res.status(200).json({ message: "Token is valid", user: req.user });
});

// User-specific actions (keep these last to avoid route conflicts)
router.get("/:id", verifyJWT, getUserById);
router.put("/:id", verifyJWT, updateUser);

export default router;
