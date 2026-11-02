import express from "express";
import {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
} from "../Controllers/notification.controller.js";
import { verifyJWT } from "../middlewares/authMiddleware.js";

const router = express.Router();

// All notification routes require auth
router.use(verifyJWT);

router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);
router.patch("/read-all", markAllRead);
router.patch("/:id/read", markRead);

export default router;
