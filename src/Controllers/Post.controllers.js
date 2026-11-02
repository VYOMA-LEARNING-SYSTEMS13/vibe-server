import { Post } from "../models/Post.js";
import { User } from "../models/Users.js";
import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { notify } from "../services/notify.js";
// import { sendZohoEmail } from "../services/zohMail.js";

const getDashboardPostLink = async (userId, postId) => {
  try {
    const user = await User.findById(userId).select("accountType");
    const role = String(user?.accountType || "student").trim().toLowerCase();
    if (role === "industry expert" || role === "industry") {
      return `/dashboard/industry?tab=community&postId=${postId}`;
    } else if (role === "faculty") {
      return `/dashboard/faculty?view=home&postId=${postId}`;
    }
    return `/dashboard/student?view=home&postId=${postId}`;
  } catch {
    return `/dashboard/student?view=home&postId=${postId}`;
  }
};

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

  // In-app notification for the post author (fire-and-forget, skip self-comments)
  if (parentPost.author?._id && String(parentPost.author._id) !== String(author)) {
    const notifLink = await getDashboardPostLink(parentPost.author._id, parentPost._id);
    await notify({
      recipient: parentPost.author._id,
      sender: author,
      type: "comment",
      title: "New comment on your post",
      message: `${req.user?.name || "Someone"} commented: "${String(content || "").slice(0, 120)}"`,
      link: notifLink,
      meta: { postId: parentPost._id, commentId: newComment._id },
    }).catch(() => {});
  }

  // If this is a reply to another comment, also notify parent comment author
  if (parentComment) {
    const parentCommentDoc = await Post.findById(parentComment);
    if (parentCommentDoc?.author && String(parentCommentDoc.author) !== String(author)) {
      const replyLink = await getDashboardPostLink(parentCommentDoc.author, parentPost._id);
      await notify({
        recipient: parentCommentDoc.author,
        sender: author,
        type: "comment",
        title: "New reply to your comment",
        message: `${req.user?.name || "Someone"} replied: "${String(content || "").slice(0, 120)}"`,
        link: replyLink,
        meta: { postId: parentPost._id, commentId: newComment._id, parentCommentId: parentComment },
      }).catch(() => {});
    }
  }

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
      $lookup: {
        from: "posts",
        localField: "repostOf",
        foreignField: "_id",
        as: "repostOfDoc",
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "repostOfDoc.author",
        foreignField: "_id",
        as: "repostOfAuthor",
      },
    },
    {
      $addFields: {
        repostOf: {
          $cond: {
            if: { $gt: [{ $size: "$repostOfDoc" }, 0] },
            then: {
              $mergeObjects: [
                { $arrayElemAt: ["$repostOfDoc", 0] },
                { author: { $arrayElemAt: ["$repostOfAuthor", 0] } },
              ],
            },
            else: null,
          },
        },
        repostCount: { $size: { $ifNull: ["$reposts", []] } },
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
        "author.refreshToken": 0,
        "author.otp": 0,
        "comments.author.password": 0,
        "comments.author.refreshToken": 0,
        "comments.author.otp": 0,
        "repostOf.author.password": 0,
        "repostOf.author.refreshToken": 0,
        "repostOf.author.otp": 0,
        commentAuthors: 0,
        repostOfDoc: 0,
        repostOfAuthor: 0,
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
  const userId = req.user._id.toString();

  const post = await Post.findById(id);
  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  // Authorization check: Only the post's author can delete their post
  if (post.author.toString() !== userId) {
    throw new ApiError(403, "Unauthorized: You can only delete your own posts");
  }

  // If this post was a repost, remove this user from the original post's reposts list
  if (post.repostOf) {
    await Post.findByIdAndUpdate(post.repostOf, {
      $pull: { reposts: req.user._id },
    });
  }

  // Delete post, its comments, and any reposts pointing to it
  await Post.deleteMany({ $or: [{ _id: id }, { parent: id }, { repostOf: id }] });

  res
    .status(200)
    .json(new ApiResponse(200, { postId: id }, "Post deleted successfully"));
});


export const updatePost = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid post ID");
  }

  const { title, content, category, tags, existingAttachments } = req.body;
  const userId = req.user._id.toString();

  const post = await Post.findById(id);
  if (!post) throw new ApiError(404, "Post not found");

  // Authorization check: Only the post's author can edit their post
  if (post.author.toString() !== userId) {
    throw new ApiError(403, "Unauthorized: You can only edit your own posts");
  }

  let attachmentUrls = [];
  if (existingAttachments !== undefined) {
    try {
      attachmentUrls =
        typeof existingAttachments === "string"
          ? JSON.parse(existingAttachments)
          : existingAttachments;
    } catch {
      attachmentUrls = Array.isArray(existingAttachments)
        ? existingAttachments
        : [existingAttachments];
    }
  } else if (req.body.attachments !== undefined) {
    try {
      attachmentUrls =
        typeof req.body.attachments === "string"
          ? JSON.parse(req.body.attachments)
          : req.body.attachments;
    } catch {
      attachmentUrls = Array.isArray(req.body.attachments)
        ? req.body.attachments
        : [req.body.attachments];
    }
  } else {
    attachmentUrls = post.attachments || [];
  }

  if (req.files?.attachments && req.files.attachments.length > 0) {
    const attachmentsLocalPaths = req.files.attachments.map((file) => file.path);
    const uploadedAttachments = await Promise.all(
      attachmentsLocalPaths.map((path) => uploadOnCloudinary(path))
    );
    const newUrls = uploadedAttachments
      .map((file) => file?.url || "")
      .filter(Boolean);
    attachmentUrls = [...attachmentUrls, ...newUrls];
  }

  if (title !== undefined) post.title = title;
  if (content !== undefined) post.content = content;
  if (category !== undefined) post.category = category;
  if (tags !== undefined) {
    if (Array.isArray(tags)) post.tags = tags;
    else if (typeof tags === "string") {
      try {
        const parsed = JSON.parse(tags);
        post.tags = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        post.tags = tags.split(",").map((t) => t.trim()).filter(Boolean);
      }
    }
  }
  post.attachments = attachmentUrls;

  await post.save();

  const updatedPost = await Post.findById(id).populate("author", "-password");

  res
    .status(200)
    .json(new ApiResponse(200, updatedPost, "Post updated successfully"));
});


export const repostPost = asyncHandler(async (req, res) => {
  const { postId, comment = "" } = req.body;
  const userId = req.user._id;

  const targetPost = await Post.findById(postId);
  if (!targetPost) {
    throw new ApiError(404, "Original post not found");
  }

  // If the target post is already a repost, link directly to the original root post
  const originalPostId = targetPost.repostOf ? targetPost.repostOf : targetPost._id;
  const originalPost = await Post.findById(originalPostId);
  if (!originalPost) {
    throw new ApiError(404, "Original post not found");
  }

  // Prevent duplicate reposts by the same user
  const existingRepost = await Post.findOne({
    author: userId,
    repostOf: originalPostId,
  });

  if (existingRepost) {
    throw new ApiError(400, "You have already reposted this post");
  }

  // Create new repost post document
  const newRepost = new Post({
    type: "Post",
    content: comment || originalPost.content,
    title: originalPost.title,
    category: originalPost.category,
    tags: originalPost.tags,
    attachments: originalPost.attachments,
    author: userId,
    repostOf: originalPostId,
    repostComment: comment,
  });

  await newRepost.save();

  // Add user to original post's reposts list
  if (!originalPost.reposts) {
    originalPost.reposts = [];
  }
  if (!originalPost.reposts.some((uId) => uId.toString() === userId.toString())) {
    originalPost.reposts.push(userId);
    await originalPost.save();
  }

  // Populate reposter author and original post
  const populated = await Post.findById(newRepost._id)
    .populate("author", "name ImageUrl accountType role Profile")
    .populate({
      path: "repostOf",
      populate: {
        path: "author",
        select: "name ImageUrl accountType role Profile",
      },
    });

  // If original post author is different from reposter, send notification
  if (originalPost.author && String(originalPost.author) !== String(userId)) {
    const repostLink = await getDashboardPostLink(originalPost.author, originalPost._id);
    await notify({
      recipient: originalPost.author,
      sender: userId,
      type: "repost",
      title: "Your post was reposted",
      message: `${req.user?.name || "Someone"} reposted your post: "${originalPost.title || originalPost.content?.slice(0, 50)}"`,
      link: repostLink,
      meta: { postId: originalPost._id, repostId: newRepost._id },
    }).catch(() => {});
  }

  res
    .status(201)
    .json(new ApiResponse(201, populated, "Post reposted successfully!"));
});


export const updateVibe = asyncHandler(async (req, res) => {
  const { postId, reaction = "vibe" } = req.body;
  const userId = req.user._id.toString();

  if (!postId || !mongoose.Types.ObjectId.isValid(postId)) {
    throw new ApiError(400, "Invalid or missing post ID");
  }

  const post = await Post.findById(postId);
  if (!post) throw new ApiError(404, "Post not found");

  if (!post.vibes) {
    post.vibes = new Map();
  } else if (!(post.vibes instanceof Map)) {
    post.vibes = new Map(Object.entries(post.vibes));
  }

  const validReactions = ["vibe", "celebrate", "support", "love", "insightful", "funny"];
  const selectedReaction = validReactions.includes(reaction) ? reaction : "vibe";

  let removed = false;
  const existingReaction = post.vibes.get(userId);

  if (existingReaction !== undefined) {
    // If the existing reaction matches selected, toggle it off
    const isSame =
      existingReaction === selectedReaction ||
      (existingReaction === true && selectedReaction === "vibe") ||
      (existingReaction === "true" && selectedReaction === "vibe");

    if (isSame) {
      post.vibes.delete(userId);
      removed = true;
    } else {
      post.vibes.set(userId, selectedReaction);
      removed = false;
    }
  } else {
    post.vibes.set(userId, selectedReaction);
    removed = false;
  }

  post.markModified("vibes");
  await post.save();

  // If reaction added (not removed) and not author's own post, send notification
  if (!removed && post.author && String(post.author) !== String(userId)) {
    const reactionEmojis = {
      vibe: "🤘",
      celebrate: "🎉",
      support: "🤝",
      love: "❤️",
      insightful: "💡",
      funny: "😂",
    };
    const emoji = reactionEmojis[selectedReaction] || "🤘";
    try {
      const notifLink = await getDashboardPostLink(post.author, post._id);
      await notify({
        recipient: post.author,
        sender: req.user._id,
        type: "reaction",
        title: "New reaction on your post",
        message: `${req.user?.name || "Someone"} reacted ${emoji} to your post`,
        link: notifLink,
        meta: { postId: post._id, reaction: selectedReaction },
      });
    } catch (e) {
      // ignore notification errors
    }
  }

  // Calculate breakdown
  const breakdown = {
    vibe: 0,
    celebrate: 0,
    support: 0,
    love: 0,
    insightful: 0,
    funny: 0,
  };
  for (const [, r] of post.vibes.entries()) {
    const rType = r === true || r === "true" ? "vibe" : r;
    if (breakdown[rType] !== undefined) {
      breakdown[rType]++;
    } else {
      breakdown.vibe++;
    }
  }

  const vibesObj = Object.fromEntries(post.vibes);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        post,
        vibes: vibesObj,
        vibeCount: post.vibes.size,
        userReaction: removed ? null : selectedReaction,
        breakdown,
        remove: removed,
      },
      removed ? "Reaction removed" : "Reaction updated"
    )
  );
});


// Get reactions details for a post
export const getPostReactions = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { type = "all", page = 1, limit = 50 } = req.query;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid post ID");
  }

  const post = await Post.findById(id);
  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  // Normalize vibes Map/Object
  const vibesMap = post.vibes instanceof Map
    ? post.vibes
    : new Map(Object.entries(post.vibes || {}));

  const validReactions = ["vibe", "celebrate", "support", "love", "insightful", "funny"];
  const reactionEmojis = {
    vibe: "🤘",
    celebrate: "🎉",
    support: "🤝",
    love: "❤️",
    insightful: "💡",
    funny: "😂",
  };
  const reactionLabels = {
    vibe: "Vibe",
    celebrate: "Celebrate",
    support: "Support",
    love: "Love",
    insightful: "Insightful",
    funny: "Funny",
  };

  const userIds = [];
  const userReactionTypeMap = new Map();

  for (const [userIdStr, rawVal] of vibesMap.entries()) {
    if (mongoose.Types.ObjectId.isValid(userIdStr)) {
      userIds.push(new mongoose.Types.ObjectId(userIdStr));
      let reactionType = rawVal === true || rawVal === "true" ? "vibe" : rawVal;
      if (!validReactions.includes(reactionType)) {
        reactionType = "vibe";
      }
      userReactionTypeMap.set(userIdStr, reactionType);
    }
  }

  // Fetch users with only safe public fields
  const users = await User.find({ _id: { $in: userIds } })
    .select("name ImageUrl avatar accountType role Profile")
    .populate("Profile", "degree branch position InstituteName IndustryType");

  const userDocMap = new Map(users.map((u) => [u._id.toString(), u]));

  // Build full list of reactions
  const allReactions = [];
  const breakdown = {
    all: 0,
    vibe: 0,
    celebrate: 0,
    support: 0,
    love: 0,
    insightful: 0,
    funny: 0,
  };

  for (const [userIdStr, reactionType] of userReactionTypeMap.entries()) {
    const user = userDocMap.get(userIdStr);
    if (!user) continue; // Gracefully handle deleted/removed users

    breakdown.all++;
    if (breakdown[reactionType] !== undefined) {
      breakdown[reactionType]++;
    } else {
      breakdown.vibe++;
    }

    const rawRole = (user.accountType || user.role || "student").toLowerCase();
    let formattedRole = "Student";
    if (rawRole === "faculty") formattedRole = "Faculty";
    else if (rawRole.includes("industry") || rawRole.includes("company")) formattedRole = "Industry";

    let profileSubtitle = "";
    if (formattedRole === "Student") {
      profileSubtitle = user.Profile?.branch
        ? `${user.Profile.degree || "B.Tech"} • ${user.Profile.branch}`
        : "Student";
    } else if (formattedRole === "Faculty") {
      profileSubtitle = user.Profile?.position || user.Profile?.branch || "Faculty Mentor";
    } else if (formattedRole === "Industry") {
      profileSubtitle = user.Profile?.position || user.Profile?.IndustryType || "Industry Expert";
    }

    allReactions.push({
      userId: user._id,
      name: user.name || "VIBE Member",
      imageUrl: user.ImageUrl || user.avatar || "",
      role: formattedRole,
      accountType: user.accountType || "student",
      profileSubtitle,
      reaction: reactionType,
      reactionLabel: reactionLabels[reactionType] || "Vibe",
      reactionEmoji: reactionEmojis[reactionType] || "🤘",
    });
  }

  // Filter by reaction type if specified
  let filteredReactions = allReactions;
  if (type && type !== "all" && validReactions.includes(type)) {
    filteredReactions = allReactions.filter((r) => r.reaction === type);
  }

  // Pagination support
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
  const startIndex = (pageNum - 1) * limitNum;
  const paginatedReactions = filteredReactions.slice(startIndex, startIndex + limitNum);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        reactions: paginatedReactions,
        total: filteredReactions.length,
        breakdown,
        hasMore: startIndex + limitNum < filteredReactions.length,
        page: pageNum,
      },
      "Reactions retrieved successfully"
    )
  );
});

//get posts by user Id
export const getPostByUserId = asyncHandler(async (req, res) => {
  const targetId = req.params.userId || req.user?._id || req.user?.id;
  if (!mongoose.Types.ObjectId.isValid(targetId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  const posts = await Post.aggregate([
    { $match: { author: new mongoose.Types.ObjectId(targetId), type: "Post" } },
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
      $sort: { createdAt: -1 },
    },
    {
      $project: {
        "author.password": 0,
        "author.refreshToken": 0,
        "author.otp": 0,
        "comments.author.password": 0,
        "comments.author.refreshToken": 0,
        "comments.author.otp": 0,
        commentAuthors: 0,
      },
    },
  ]);

  res
    .status(200)
    .json(new ApiResponse(200, posts, "Fetched posts by user successfully"));
});

// Toggle bookmark for a post
export const toggleBookmark = asyncHandler(async (req, res) => {
  const { postId, taskId, itemType } = req.body;
  const userId = req.user._id;

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  if (itemType === "task" || (taskId && !postId)) {
    const role = String(req.user?.accountType || req.user?.role || "").trim().toLowerCase();
    if (role !== "student") {
      throw new ApiError(403, "Access denied. Only students are authorized to bookmark tasks.");
    }
    const targetTaskId = taskId || postId;
    if (!user.taskBookmarks) {
      user.taskBookmarks = [];
    }
    const isBookmarked = user.taskBookmarks.some((b) => b && b.toString() === String(targetTaskId));
    let bookmarked = false;

    if (isBookmarked) {
      user.taskBookmarks = user.taskBookmarks.filter((b) => b && b.toString() !== String(targetTaskId));
      bookmarked = false;
    } else {
      user.taskBookmarks.push(targetTaskId);
      bookmarked = true;
    }

    await user.save();
    return res
      .status(200)
      .json(new ApiResponse(200, { bookmarked, taskBookmarks: user.taskBookmarks }, bookmarked ? "Task bookmarked" : "Task bookmark removed"));
  }

  if (!user.bookmarks) {
    user.bookmarks = [];
  }

  const isBookmarked = user.bookmarks.some((b) => b && b.toString() === String(postId));
  let bookmarked = false;

  if (isBookmarked) {
    user.bookmarks = user.bookmarks.filter((b) => b && b.toString() !== String(postId));
    bookmarked = false;
  } else {
    user.bookmarks.push(postId);
    bookmarked = true;
  }

  await user.save();

  res
    .status(200)
    .json(new ApiResponse(200, { bookmarked, bookmarks: user.bookmarks }, bookmarked ? "Post bookmarked" : "Bookmark removed"));
});

// Get all bookmarked posts for the current user
export const getBookmarkedPosts = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  const bookmarkIds = (user.bookmarks || [])
    .filter(Boolean)
    .map((id) => (id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id)));

  if (bookmarkIds.length === 0) {
    return res
      .status(200)
      .json(new ApiResponse(200, [], "Fetched bookmarked posts successfully"));
  }

  const bookmarkedPosts = await Post.aggregate([
    { $match: { _id: { $in: bookmarkIds }, type: "Post" } },
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
        from: "profiles",
        localField: "author.Profile",
        foreignField: "_id",
        as: "authorProfile",
      },
    },
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
        "author.Profile": { $arrayElemAt: ["$authorProfile", 0] },
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
        "author.refreshToken": 0,
        "author.otp": 0,
        "comments.author.password": 0,
        "comments.author.refreshToken": 0,
        "comments.author.otp": 0,
        authorProfile: 0,
        commentAuthors: 0,
      },
    },
    { $sort: { createdAt: -1 } },
  ]);

  res
    .status(200)
    .json(new ApiResponse(200, bookmarkedPosts, "Fetched bookmarked posts successfully"));
});
