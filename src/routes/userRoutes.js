import express from "express";
import {
  registerUser,
  loginUser,
  getUserById,
  updateUser,
  logoutUser,
  getCurrentUser,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  changePassword,
  sendOtp,
  requestEmailChange,
  verifyEmailChange,
  resendEmailChangeOtp,
  cancelEmailChange,
  uploadUserAvatar,
  removeUserAvatar,
} from "../Controllers/userControllers.js";

import { verifyJWT } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/multerMiddleware.js";

const router = express.Router();

// Public Routes
router.post("/register", sendOtp);
router.post("/verify-otp", registerUser);
router.post("/login", loginUser);
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-otp", verifyResetOtp);
router.post("/reset-password", resetPassword);

// Protected Routes
router.get("/me", verifyJWT, getCurrentUser);
router.post("/logout", verifyJWT, logoutUser);
router.post("/change-password", verifyJWT, changePassword);
router.post("/request-email-change", verifyJWT, requestEmailChange);
router.post("/verify-email-change", verifyJWT, verifyEmailChange);
router.post("/resend-email-change-otp", verifyJWT, resendEmailChangeOtp);
router.post("/cancel-email-change", verifyJWT, cancelEmailChange);

router.post("/verify-token", verifyJWT, (req, res) => {
  res.status(200).json({ message: "Token is valid", user: req.user });
});

// Avatar upload / remove
router.put("/:id/avatar", verifyJWT, upload.single("avatar"), uploadUserAvatar);
router.delete("/:id/avatar", verifyJWT, removeUserAvatar);

// User-specific actions (keep these last to avoid route conflicts)
router.get("/:id", verifyJWT, getUserById);
router.put("/:id", verifyJWT, updateUser);

export default router;
