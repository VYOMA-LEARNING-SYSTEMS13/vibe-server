import { User } from "../models/Users.js";
import TaskSubmission from "../models/TaskSubmission.js";
import Profile from "../models/Profile.js";
import MentorReview from "../models/MentorReview.js";

export const getVirtualResume = async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch user basic profile with Profile populated
    const user = await User.findById(userId)
      .select("name email education github linkedin role Profile")
      .populate("Profile");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Fetch task submissions
    const submissions = await TaskSubmission.find({
      createdBy: userId,
    })
      .populate("taskId", "title description attachments techStack industryId")
      .sort({ submittedAt: -1 });

    // User's custom skills saved in Profile
    const profileSkills = Array.isArray(user.Profile?.skills) ? user.Profile.skills : [];
    const hasCustomSkills = profileSkills.length > 0;

    // Skills extracted from reviewed/completed tasks
    const verifiedTaskSkills = new Set();
    submissions.forEach(sub => {
      if (Array.isArray(sub.attachments)) {
        sub.attachments.forEach(skill => {
          if (skill && typeof skill === "string" && !skill.startsWith("http")) {
            verifiedTaskSkills.add(skill.trim());
          }
        });
      }
      if (sub.taskId && Array.isArray(sub.taskId.techStack)) {
        sub.taskId.techStack.forEach(t => {
          if (t && typeof t === "string") verifiedTaskSkills.add(t.trim());
        });
      }
    });

    // Merge custom skills with verification status
    let skills = [];
    if (hasCustomSkills) {
      skills = profileSkills.map(s => {
        const isVerified = s.verified || verifiedTaskSkills.has(s.name);
        return {
          name: s.name,
          category: s.category || "Technical",
          level: s.level || "Intermediate",
          score: s.score || 85,
          verified: isVerified
        };
      });
    } else if (verifiedTaskSkills.size > 0) {
      skills = Array.from(verifiedTaskSkills).map(skillName => ({
        name: skillName,
        category: "Technical",
        level: "Verified",
        score: 90,
        verified: true
      }));
    }

    // Build experience/projects section
    const experience = submissions
      .filter(sub => sub.taskId)
      .map(sub => ({
        taskTitle: sub.taskId?.title || sub.projectTitle || "Industry Challenge",
        problemStatement: sub.taskId?.description || "Completed real industry task requirements with verified submission.",
        techStack: Array.isArray(sub.taskId?.techStack) ? sub.taskId.techStack : [],
        submissionLink: sub.submissionUrl || sub.repoUrl || "",
        completedAt: sub.submittedAt || sub.createdAt,
        verified: sub.status === "reviewed" || sub.status === "accepted" || sub.status === "hired"
      }));

    // Fetch real mentor reviews for this student
    const mentorReviews = await MentorReview.find({ student: userId })
      .populate({
        path: "faculty",
        select: "name ImageUrl Profile accountType",
        populate: { path: "Profile", select: "position InstituteName branch department" },
      })
      .sort({ createdAt: -1 });

    const totalReviews = mentorReviews.length;
    const averageMentorRating =
      totalReviews > 0
        ? Number((mentorReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / totalReviews).toFixed(1))
        : null;

    // Final Virtual Resume Object
    const virtualResume = {
      profile: {
        name: user.name,
        email: user.email,
        github: user.github,
        linkedin: user.linkedin,
        education: user.Profile?.degree ? `${user.Profile.degree} in ${user.Profile.branch}` : undefined,
      },
      skills,
      hasCustomSkills,
      experience,
      mentorReviews,
      totalMentorReviews: totalReviews,
      averageMentorRating,
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

export const updateVirtualResumeSkills = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check ownership
    const requesterId = req.user?._id?.toString() || req.user?.id?.toString();
    if (requesterId !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own virtual resume skills"
      });
    }

    const { skills } = req.body;
    if (!Array.isArray(skills)) {
      return res.status(400).json({
        success: false,
        message: "Skills must be an array"
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Fetch existing profile and approved skill verification attempts to enforce security checks
    let profileId = user.Profile;
    let existingProfile = profileId ? await Profile.findById(profileId) : null;
    const previouslyVerifiedSet = new Set(
      (existingProfile?.skills || []).filter(s => s.verified).map(s => s.name.toLowerCase())
    );

    // Format and sanitize skill items with security verification checks
    const validCategories = ["Technical", "Tools", "Soft Skills"];
    const formattedSkills = skills
      .filter(s => s && (typeof s === "string" ? s.trim() : s.name?.trim()))
      .map(s => {
        const rawName = typeof s === "string" ? s.trim() : String(s.name).trim();
        const lowerName = rawName.toLowerCase();
        // A skill can only be verified if it was already verified in profile
        const isLegitVerified = previouslyVerifiedSet.has(lowerName);

        if (typeof s === "string") {
          return {
            name: rawName,
            category: "Technical",
            level: "Intermediate",
            score: 85,
            verified: isLegitVerified
          };
        }
        const cat = validCategories.includes(s.category) ? s.category : "Technical";
        return {
          name: rawName,
          category: cat,
          level: s.level || "Intermediate",
          score: typeof s.score === "number" ? s.score : 85,
          verified: isLegitVerified
        };
      });

    if (!profileId) {
      const newProfile = await Profile.create({ skills: formattedSkills });
      user.Profile = newProfile._id;
      await user.save({ validateBeforeSave: false });
    } else {
      await Profile.findByIdAndUpdate(
        profileId,
        { $set: { skills: formattedSkills } },
        { returnDocument: "after" }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Skills updated successfully",
      data: { skills: formattedSkills }
    });
  } catch (error) {
    console.error("Update Virtual Resume Skills Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update virtual resume skills"
    });
  }
};
