import { Post } from "../models/Post.js";
import { User } from "../models/Users.js";
import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
// import { sendZohoEmail } from "../services/zohMail.js";


// Post.controllers.js
export const createPost = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const { type = "Post", content, title, category, tags } = body;
  const author = req.user._id;

  if (type === "Post" && (!title || !category)) {
    throw new ApiError(400, "Title & Category are required for a post.");
  }

  let attachmentUrls = [];
  if (req.files?.attachments && req.files.attachments.length > 0) {
    const localPaths = req.files.attachments.map((file) => file.path);
    const uploadedAttachments = await Promise.all(
      localPaths.map((p) => uploadOnCloudinary(p))
    );
    attachmentUrls = uploadedAttachments.map((file) => file?.url || "").filter(Boolean);
  }

  const newPost = new Post({
    type,
    content,
    title,
    category,
    tags: (() => {
      if (Array.isArray(tags)) return tags;
      if (typeof tags === "string") {
        try {
          const parsed = JSON.parse(tags);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          return [tags];
        }
      }
      return [];
    })(),
    author,
    attachments: attachmentUrls
  });

  await newPost.save();
  const populatedPost = await Post.findById(newPost._id).populate("author", "-password");

  return res
    .status(201)
    .json(new ApiResponse(201, populatedPost, "Post created successfully!"));
});

export const createComment = asyncHandler(async (req, res) => {
  const { content, parent, parentComment } = req.body;
  const author = req.user._id;

  // Check if parent post exists
  const parentPost = await Post.findById(parent).populate("author");
  if (!parentPost) {
    throw new ApiError(404, "Parent post not found");
  }

  // Save comment
  const newComment = new Post({
    type: "Comment",
    content,
    author,
    parent,
    parentComment: parentComment || null,
  });
  await newComment.save();

  // Send email notification to parent post's author
  // if (parentPost.author && parentPost.author.email) {
  //   try {
  //     await sendZohoEmail(
  //       parentPost.author.email,
  //       "comment",
  //       {
  //         comment: content,
  //         link: "https://www.curioteach.com/community/profile"
  //       }
  //     );
  //     console.log(`email sent to ${parentPost.author.email}`);
  //   } catch (err) {
  //     console.error("Failed to send comment notification email:", err.message);
  //     // don't throw error, we still want to return success
  //   }
  // }

  res
    .status(201)
    .json(
      new ApiResponse(
        201,
        await newComment.populate("author"),
        "Comment added successfully!"
      )
    );
});

export const getAllPosts = asyncHandler(async (req, res) => {
  const posts = await Post.aggregate([
    { $match: { type: "Post" } },
    {
      $lookup: {
        from: "posts",
        localField: "_id",
        foreignField: "parent",
        as: "comments",
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "author",
        foreignField: "_id",
        as: "author",
      },
    },
    { $unwind: "$author" },
    {
      $lookup: {
        from: "users",
        localField: "comments.author",
        foreignField: "_id",
        as: "commentAuthors",
      },
    },
    {
      $addFields: {
        comments: {
          $map: {
            input: "$comments",
            as: "comment",
            in: {
              _id: "$$comment._id",
              content: "$$comment.content",
              createdAt: "$$comment.createdAt",
              parentComment: "$$comment.parentComment",
              vibes: "$$comment.vibes",
              author: {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: "$commentAuthors",
                      as: "ca",
                      cond: { $eq: ["$$ca._id", "$$comment.author"] },
                    },
                  },
                  0,
                ],
              },
            },
          },
        },
      },
    },
    {
      $project: {
        "author.password": 0,
        "comments.author.password": 0,
        commentAuthors: 0,
      },
    },
    { $sort: { createdAt: -1 } },
  ]);
  res
    .status(200)
    .json(new ApiResponse(200, posts, "Fetched all posts successfully"));
});


export const getPostById = asyncHandler(async (req, res) => {
  const post = await Post.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(req.params.id) } },
    {
      $lookup: {
        from: "posts",
        localField: "_id",
        foreignField: "parent",
        as: "comments",
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "author",
        foreignField: "_id",
        as: "author",
      },
    },
    { $unwind: "$author" },
    { $sort: { "comments.createdAt": -1 } },
    {
      $project: {
        "author.password": 0,
      },
    },
  ]);

  if (!post.length) {
    throw new ApiError(404, "Post not found");
  }

  res
    .status(200)
    .json(new ApiResponse(200, post[0], "Post fetched successfully"));
});


export const deletePost = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const post = await Post.findById(id);
  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  await Post.deleteMany({ $or: [{ _id: id }, { parent: id }] });

  res
    .status(200)
    .json(new ApiResponse(200, null, "Post and comments deleted successfully"));
});


export const updatePost = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, content, category, tags } = req.body;
  const author = req.user._id

  const post = await Post.findById(id);
  if (!post) throw new ApiError(404, "Post not found");

  if (post.author.toString() !== author) {
    throw new ApiError(403, "Unauthorized to update this post");
  }

  let attachmentUrls = post.attachments;
  if (req.files?.attachments) {
    const attachmentsLocalPaths = req.files.attachments.map(
      (file) => file.path
    );
    const uploadedAttachments = await Promise.all(
      attachmentsLocalPaths.map((path) => uploadOnCloudinary(path))
    );
    attachmentUrls = uploadedAttachments.map((file) => file?.url || "");
  }

  post.title = title || post.title;
  post.content = content || post.content;
  post.category = category || post.category;
  post.tags = tags || post.tags;
  post.attachments = attachmentUrls;

  await post.save();

  const updatedPost = await Post.findById(id).populate("author", "-password");

  res
    .status(200)
    .json(new ApiResponse(200, updatedPost, "Post updated successfully"));
});


export const updateVibe = asyncHandler(async (req, res) => {
  const { postId} = req.body;
  const userId = req.user._id.toString();

  const post = await Post.findById(postId);
  if (!post) throw new ApiError(404, "Post not found");

  let flag = false;
  if (post.vibes.has(userId)) {
    flag = true;
    post.vibes.delete(userId);
  } else {
    post.vibes.set(userId, true);
  }

  await post.save();

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { post,
          remove: flag
         },
        "+ vibe ",
      )
    );
});

//get posts by user Id
export const getPostByUserId = asyncHandler(async (req,res)=>{
  const id = req.user.id;
  const posts = await Post.find({ author: id, type: "Post" })
    .populate("author", "-password")
    .sort({ createdAt: -1 });

  res
    .status(200)
    .json(new ApiResponse(200, posts, "Fetched posts by user successfully"));
})
