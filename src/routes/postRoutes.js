import Router from "express";
import {
  createComment,
  createPost,
  deletePost,
  getAllPosts,
  getPostById,
  getPostByUserId,
  updateVibe,
} from "../Controllers/Post.controllers.js";
import { upload } from "../middlewares/multerMiddleware.js";
import  {verifyJWT}  from "../middlewares/authMiddleware.js";
// import uploadPostImage from "../middlewares/uploadPost.js";
const router = Router();

router.post(
  "/create",
  verifyJWT,
  upload.fields([
    {
      name: "attachments",
      maxCount: 5,
    },
  ]),
  createPost
);


// posts
router.get("/", getAllPosts);
//router.get("/:id" ,getPostById);
router.delete("/:id", verifyJWT, deletePost);
router.get("/mypost", verifyJWT, getPostByUserId);

// comments
router.post("/comment", verifyJWT, createComment);

// voting
router.put("/vibe", verifyJWT, updateVibe);


export default router;
