import {User} from "../models/Users.js";
import TaskSubmission from "../models/TaskSubmission.js";
import {Post} from "../models/Post.js";

export const getVirtualResume = async (req, res) => {
  try {
    const { userId } = req.params;

    //  Fetch user basic profile
    const user = await User.findById(userId).select(
      "name email education github linkedin role"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Fetch reviewed task submissions
    const submissions = await TaskSubmission.find({
      createdBy: userId,
    //   status: "reviewed"
    })
      .populate("taskId", "title description attachments industryId")
      .sort({ submittedAt: -1 });

    // skills from tasks
    const skillSet = new Set();
   
    submissions.forEach(sub => {
      sub.attachments.forEach(skill => skillSet.add(skill));
    });

    const skills = Array.from(skillSet);

    // Build experience/projects section
    const experience = submissions.map(sub => ({
      taskTitle: sub.taskId.title,
      problemStatement: sub.taskId.description,
      techStack: sub.taskId.techStack,
      submissionLink: sub.submissionLink,
      completedAt: sub.submittedAt
    }));

    // Final Virtual Resume Object
    const virtualResume = {
      profile: {
        name: user.name,
        email: user.email,
        education: user.education,
        github: user.github,
        linkedin: user.linkedin
      },
      skills,
      experience,
    };

    return res.status(200).json({
      success: true,
      data: virtualResume
    });
  } catch (error) {
    console.error("Virtual Resume Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate virtual resume"
    });
  }
};
