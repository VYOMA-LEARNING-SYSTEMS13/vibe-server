// image needs to be added
//comment content 

import mongoose from "mongoose"

const PostSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Post", "Comment"],
      required: true,
      default: "Post",
    },
    content: {
      type: String,
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // only for post
    title: {
      type: String,
    },
    category: {
      type: String,
      enum: ["Doubt", "Knowledge", "Doubt Sharing", "Knowledge Base", "Inspiration", "General"],
    },
    tags: [String],

    attachments: [String],

    // linking of comment to the post

    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
    },
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
    },

    // repost functionality
    repostOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
    },
    repostComment: {
      type: String,
      default: "",
    },
    reposts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    vibes: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },

    isReported: {
      type: Boolean,
      default: false,
    },
    reports: [
      {
        reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        reason: { type: String },
      },
    ],

    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Post = mongoose.model("Post", PostSchema);
