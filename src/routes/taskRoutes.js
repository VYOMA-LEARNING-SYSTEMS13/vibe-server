import express from "express";
import {
  createTask,
  getAllTasks,
  getTaskById,
  getMyTasks,
  getTasksByCompany,
  updateTask,
  deleteTask,
  downloadTaskMaterialsZip,
  toggleTaskBookmark,
  getBookmarkedTasks,
  getTaskOrder,
  updateTaskOrder,
// sendSampleTask,
} from "../Controllers/task.controller.js";

import { verifyJWT } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/multerMiddleware.js";

const router = express.Router();

// router.get("/test", sendSampleTask);
router.get("/myTasks", verifyJWT, getMyTasks);
router.get("/company/:userId", verifyJWT, getTasksByCompany);
router.get("/", verifyJWT, getAllTasks);
router.post("/", verifyJWT, upload.array("materials", 10), createTask);

// Download task materials as zip (authorized for creator and accepted students)
router.get("/:id/download-materials", verifyJWT, downloadTaskMaterialsZip);

// keep :id routes at the bottom
// Task bookmarks (placed before /:id)
router.post("/bookmark", verifyJWT, toggleTaskBookmark);
router.get("/bookmarks", verifyJWT, getBookmarkedTasks);

// Task ordering preferences (placed before /:id)
router.get("/order", verifyJWT, getTaskOrder);
router.put("/order", verifyJWT, updateTaskOrder);

router.get("/:id", verifyJWT, getTaskById);
router.put("/:id", verifyJWT, upload.array("materials", 10), updateTask);
router.delete("/:id", verifyJWT, deleteTask);

export default router;
