import { Notification } from "../models/Notification.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// GET /notifications — newest first, paginated
const getNotifications = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
  const skip = (page - 1) * limit;

  const [items, total, unreadCount] = await Promise.all([
    Notification.find({ recipient: req.user._id })
      .populate("sender", "name ImageUrl accountType")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Notification.countDocuments({ recipient: req.user._id }),
    Notification.countDocuments({ recipient: req.user._id, isRead: false }),
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      { items, total, page, limit, unreadCount },
      "Fetched notifications"
    )
  );
});

// GET /notifications/unread-count
const getUnreadCount = asyncHandler(async (req, res) => {
  const unreadCount = await Notification.countDocuments({
    recipient: req.user._id,
    isRead: false,
  });
  return res
    .status(200)
    .json(new ApiResponse(200, { unreadCount }, "Fetched unread count"));
});

// PATCH /notifications/:id/read
const markRead = asyncHandler(async (req, res) => {
  const note = await Notification.findOne({
    _id: req.params.id,
    recipient: req.user._id,
  });
  if (!note) {
    throw new ApiError(404, "Notification not found");
  }
  if (!note.isRead) {
    note.isRead = true;
    note.readAt = new Date();
    await note.save({ validateBeforeSave: false });
  }
  return res
    .status(200)
    .json(new ApiResponse(200, note, "Notification marked as read"));
});

// PATCH /notifications/read-all
const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "All notifications marked as read"));
});

export { getNotifications, getUnreadCount, markRead, markAllRead };
