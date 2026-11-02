import { Notification } from "../models/Notification.js";

/**
 * Create an in-app notification. Fire-and-forget: never throws into
 * the caller's flow — logs and resolves null on failure.
 */
export const notify = async ({
  recipient,
  sender = null,
  type = "system",
  title = "Notification",
  message = "",
  link = "",
  meta = {},
}) => {
  try {
    if (!recipient) return null;
    const doc = await Notification.create({
      recipient,
      sender,
      type,
      title,
      message,
      link,
      meta,
    });
    return doc;
  } catch (err) {
    console.error("notify() failed:", err.message || err);
    return null;
  }
};
