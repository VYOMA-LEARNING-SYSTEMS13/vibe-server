import {isValidObjectId} from "mongoose";
import { Comment } from "../models/Comment.js";
import { Post } from "../models/Post.js";
import { User } from "../models/User.js";

import {ApiError} from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponce} from "../utils/apiResponce.js";

//Create comment
export const createcomment=asyncHandler(async(req,res,next)=>{
    const {postId}=req.params;
    const {content}=req.body;
    const userId=req.user.id;


    //Validate PostId
    if(!isValidObjectId(postId) || !isValidObjectId(userId)){
        return next(new ApiError(400,"Invalid post id or user id"));
    }
    //Check if post exists
    const post=await Post.findById(postId);

    if(!post){
        return next(new ApiError(404,"Post not found"));
    }

    //Create comment
    const comment=await Comment.create({
        content,
        post:postId,
        user:userId
    });

    //Add comment to post
    post.comments.push(comment._id);
    await post.save();

    return res.status(201).json(
        new ApiResponce(201,comment,"Comment created successfully")
    );
})

//Get comments for a post
export const getCommentsByPostId=asyncHandler(async(req,res,next)=>{
    const {postId}=req.params;
    //Validate PostId
    if(!isValidObjectId(postId)){
        return next(new ApiError(400,"Invalid post id"));
    }
    //Check if post exists
    const post=await Post.findById(postId);
    if(!post){
        return next(new ApiError(404,"Post not found"));
    }

    //Get comments
    const comments=await Comment.find
    ({post:postId}).populate("user","-password").sort({createdAt:-1});

    return res.status(200).json(
        new ApiResponce(200,comments,"Comments fetched successfully")
    );
}); 
//Delete comment
export const deleteComment=asyncHandler(async(req,res,next)=>{
    const {commentId}=req.params;
    const userId=req.user.id;
    //Validate CommentId
    if(!isValidObjectId(commentId) || !isValidObjectId(userId)){
        return next(new ApiError(400,"Invalid comment id or user id"));
    }
    //Check if comment exists
    const comment=await Comment.find
    ById(commentId);
    if(!comment){
        return next(new ApiError(404,"Comment not found"));
    }       
    //Check if user is the author of the comment
    if(comment.user.toString()!==userId){
        return next(new ApiError(403,"You are not authorized to delete this comment"));
    }       
    //Delete comment
    await comment.remove();

    return res.status(200).json(
        new ApiResponce(200,null,"Comment deleted successfully")
    );
});
//Update comment
export const updateComment=asyncHandler(async(req,res,next)=>{
    const {commentId}=req.params;
    const {content}=req.body;
    const userId=req.user.id;

    //Validate CommentId
    if(!isValidObjectId(commentId) || !isValidObjectId(userId)){
        return next(new ApiError(400,"Invalid comment id or user id"));
    }

    //Check if comment exists
    const comment=await Comment.findById(commentId);    
    if(!comment){
        return next(new ApiError(404,"Comment not found"));
    }

    //Check if user is the author of the comment
    if(comment.user.toString()!==userId){
        return next(new ApiError(403,"You are not authorized to update this comment"));
    }
    //Update comment
    comment.content=content || comment.content;
    await comment.save();       
    return res.status(200).json(
        new ApiResponce(200,comment,"Comment updated successfully")
    );
}); 



