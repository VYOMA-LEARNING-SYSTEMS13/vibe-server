import Router from "express";
import {
  createComment,
  createPost,
  deletePost,
  updatePost,
  repostPost,
  getAllPosts,
  getPostById,
  getPostByUserId,
  updateVibe,
  toggleBookmark,
  getBookmarkedPosts,
  getPostReactions,
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


// posts & feeds
router.get("/", getAllPosts);
router.get("/mypost", verifyJWT, getPostByUserId);
router.get("/user/:userId", verifyJWT, getPostByUserId);

// bookmarks
router.post("/bookmark", verifyJWT, toggleBookmark);
router.get("/bookmarks", verifyJWT, getBookmarkedPosts);

// comments
router.post("/comment", verifyJWT, createComment);

// repost
router.post("/repost", verifyJWT, repostPost);

// voting / reactions (MUST be before /:id)
router.put("/vibe", verifyJWT, updateVibe);
router.put("/:id/vibe", verifyJWT, (req, res, next) => {
  req.body.postId = req.params.id;
  return updateVibe(req, res, next);
});

// reaction details
router.get("/:id/reactions", getPostReactions);

// post edits and deletion
router.put(
  "/:id",
  verifyJWT,
  upload.fields([
    {
      name: "attachments",
      maxCount: 5,
    },
  ]),
  updatePost
);
router.delete("/:id", verifyJWT, deletePost);

export default router;
