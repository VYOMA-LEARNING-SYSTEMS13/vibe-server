import SkillVerificationTask from "../models/SkillVerificationTask.js";
import SkillVerificationAttempt from "../models/SkillVerificationAttempt.js";
import SkillVerificationReview from "../models/SkillVerificationReview.js";
import MentorWorkload from "../models/MentorWorkload.js";
import { User } from "../models/Users.js";
import Profile from "../models/Profile.js";
import { Notification } from "../models/Notification.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import mongoose from "mongoose";
import { normalizeSkill } from "../utils/recommendationEngine.js";

// Helper: Ensure mentor workload record exists and is synced
const getOrCreateMentorWorkload = async (mentorId) => {
  let workload = await MentorWorkload.findOne({ mentorId });
  if (!workload) {
    const activeCount = await SkillVerificationAttempt.countDocuments({
      assignedMentorId: mentorId,
      status: "under_review",
    });
    workload = await MentorWorkload.create({
      mentorId,
      activePendingReviews: activeCount,
      totalCompletedReviews: 0,
      isAvailable: true,
    });
  }
  return workload;
};

// Helper: Select an active task for student avoiding previously attempted tasks
const selectTaskForStudent = async (studentId, skillName, difficulty) => {
  // Normalize skill name search (case-insensitive regex)
  const regex = new RegExp(`^${skillName.trim()}$`, "i");

  // 1. Find all past attempts for this student and skill
  const pastAttempts = await SkillVerificationAttempt.find({
    studentId,
    skillName: { $regex: regex },
  }).select("taskId");

  const attemptedTaskIds = pastAttempts.map((a) => a.taskId);

  // 2. Query available tasks matching skill & difficulty excluding past tasks
  let eligibleTasks = await SkillVerificationTask.find({
    skillName: { $regex: regex },
    difficulty,
    isActive: true,
    _id: { $nin: attemptedTaskIds },
  });

  // 3. Fallback: If student has attempted all tasks, select from all active tasks in that pool
  if (eligibleTasks.length === 0) {
    eligibleTasks = await SkillVerificationTask.find({
      skillName: { $regex: regex },
      difficulty,
      isActive: true,
    });
  }

  // 4. Fallback: If no task matches exact skill name, find general category task
  if (eligibleTasks.length === 0) {
    eligibleTasks = await SkillVerificationTask.find({
      difficulty,
      isActive: true,
    });
  }

  if (eligibleTasks.length === 0) {
    throw new ApiError(404, `No active tasks found in the task bank for ${skillName} (${difficulty})`);
  }

  // Pick one randomly
  const randomIndex = Math.floor(Math.random() * eligibleTasks.length);
  return eligibleTasks[randomIndex];
};

// Helper: Find matching registered skill for a faculty member
const getFacultySkillMatch = (facultyMember, requestedSkill) => {
  const normRequested = normalizeSkill(requestedSkill);
  if (!normRequested) return null;

  const rawSkills = [];
  if (Array.isArray(facultyMember.Profile?.skills)) {
    rawSkills.push(...facultyMember.Profile.skills);
  }
  if (Array.isArray(facultyMember.skills)) {
    rawSkills.push(...facultyMember.skills);
  }

  for (const s of rawSkills) {
    const skillName = typeof s === "string" ? s : s?.name;
    if (!skillName || typeof skillName !== "string") continue;
    if (normalizeSkill(skillName) === normRequested) {
      return skillName.trim();
    }
  }
  return null;
};

// Helper: Fair Load-Balanced Faculty Assignment
const assignFacultyToSubmission = async (
  attemptId,
  studentId,
  skillName,
  excludedFacultyIds = [],
  isReassignment = false
) => {
  // 1. Find all eligible faculty members (strictly accountType: "faculty", excluding student and excluded faculty)
  const query = {
    accountType: "faculty",
    _id: { $ne: studentId },
  };

  if (excludedFacultyIds && excludedFacultyIds.length > 0) {
    const objectIds = excludedFacultyIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    query._id = { $ne: studentId, $nin: objectIds };
  }

  const facultyList = await User.find(query)
    .select("_id name email accountType isVerified Profile skills")
    .populate("Profile");

  // Filter ONLY faculty whose registered skills match the skill being verified
  const eligibleFacultyCandidates = (facultyList || []).filter((facultyMember) => {
    return getFacultySkillMatch(facultyMember, skillName) !== null;
  });

  if (!eligibleFacultyCandidates || eligibleFacultyCandidates.length === 0) {
    if (!isReassignment) {
      console.log(
        `[SKILL_VERIFICATION] event=UNASSIGNED requestId=${attemptId} studentId=${studentId} skill="${skillName}" reason=NO_ELIGIBLE_FACULTY_WITH_REQUIRED_SKILL`
      );
    }
    await SkillVerificationAttempt.findByIdAndUpdate(attemptId, {
      assignedMentorId: null,
      assignedAt: null,
      reviewDeadline: null,
      status: "submitted",
    });
    return null;
  }

  // 2. Retrieve actual pending review count for each eligible candidate to guarantee accurate load calculation
  const candidatesWithLoad = await Promise.all(
    eligibleFacultyCandidates.map(async (facultyMember) => {
      // Count actual pending reviews awaiting evaluation
      const pendingCount = await SkillVerificationAttempt.countDocuments({
        assignedMentorId: facultyMember._id,
        status: "under_review",
        _id: { $ne: attemptId },
      });

      const workload = await getOrCreateMentorWorkload(facultyMember._id);
      if (workload.activePendingReviews !== pendingCount) {
        workload.activePendingReviews = pendingCount;
        await workload.save();
      }

      return {
        faculty: facultyMember,
        workload,
        load: pendingCount,
        isAvailable: workload.isAvailable !== false,
        matchedSkill: getFacultySkillMatch(facultyMember, skillName),
      };
    })
  );

  // Filter available faculty if any are explicitly marked available
  const availableCandidates = candidatesWithLoad.filter((c) => c.isAvailable);
  const candidates = availableCandidates.length > 0 ? availableCandidates : candidatesWithLoad;

  // 3. Find minimum active review count among skill-matched faculty
  let minLoad = Infinity;
  for (const item of candidates) {
    if (item.load < minLoad) {
      minLoad = item.load;
    }
  }

  // 4. Gather all skill-matched faculty tied for minimum load (balanced distribution pool)
  const minLoadPool = candidates.filter((item) => item.load === minLoad);

  // 5. Fair tie-breaking
  const chosenIndex = Math.floor(Math.random() * minLoadPool.length);
  const selected = minLoadPool[chosenIndex];
  const selectedFaculty = selected.faculty;
  const matchedSkill = selected.matchedSkill || skillName;
  const newWorkload = selected.load + 1;

  // 6. Atomically update attempt with faculty assignment and 72-hour SLA deadline
  const reviewDeadline = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours
  await SkillVerificationAttempt.findByIdAndUpdate(attemptId, {
    assignedMentorId: selectedFaculty._id,
    assignedAt: new Date(),
    reviewDeadline,
    status: "under_review",
  });

  // 7. Update faculty's workload record
  await MentorWorkload.findOneAndUpdate(
    { mentorId: selectedFaculty._id },
    {
      $set: {
        activePendingReviews: newWorkload,
        lastAssignedAt: new Date(),
      },
    },
    { upsert: true }
  );

  // 8. Double-blind notification to assigned faculty member (DO NOT disclose student name)
  await Notification.create({
    recipient: selectedFaculty._id,
    sender: null, // Double blind
    type: "submission_received",
    title: "New Skill Verification Assignment",
    message: `You have been assigned an anonymous candidate submission for ${skillName} to review.`,
    link: "/dashboard/faculty?tab=skill-verifications",
    meta: { attemptId },
  });

  // 9. Structured terminal log for initial assignment (reassignment is logged by caller)
  if (!isReassignment) {
    const reason = minLoadPool.length > 1 ? "SKILL_MATCH_LOWEST_WORKLOAD_TIE_BREAK" : "SKILL_MATCH_LOWEST_WORKLOAD";
    const facultyEmail = selectedFaculty.email || "NOT_AVAILABLE";
    console.log(
      `[SKILL_VERIFICATION] event=ASSIGNED requestId=${attemptId} studentId=${studentId} skill="${skillName}" facultyId=${selectedFaculty._id} facultyName="${selectedFaculty.name}" facultyEmail="${facultyEmail}" matchedSkill="${matchedSkill}" pendingWorkload=${newWorkload} reason=${reason}`
    );
  }

  return {
    faculty: selectedFaculty,
    matchedSkill,
    workload: newWorkload,
  };
};

// ==========================================
// 1. Request Skill Verification (Assign Task)
// ==========================================
export const requestSkillTask = asyncHandler(async (req, res) => {
  const studentId = req.user._id;
  const { skillName, difficulty = "Intermediate" } = req.body;

  if (!skillName || !skillName.trim()) {
    throw new ApiError(400, "Skill name is required");
  }

  const validDifficulties = ["Beginner", "Intermediate", "Advanced"];
  const selectedDifficulty = validDifficulties.includes(difficulty) ? difficulty : "Intermediate";

  // Check if student already has an active verification attempt for this skill
  const activeAttempt = await SkillVerificationAttempt.findOne({
    studentId,
    skillName: { $regex: new RegExp(`^${skillName.trim()}$`, "i") },
    status: { $in: ["assigned", "submitted", "under_review"] },
  }).populate("taskId");

  if (activeAttempt) {
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          attemptId: activeAttempt._id,
          skillName: activeAttempt.skillName,
          difficulty: activeAttempt.difficulty,
          status: activeAttempt.status,
          task: activeAttempt.taskId,
          expiresAt: activeAttempt.expiresAt,
          submissionData: activeAttempt.submissionData,
        },
        "Active verification task already in progress for this skill"
      )
    );
  }

  // Select task avoiding repetition
  const task = await selectTaskForStudent(studentId, skillName, selectedDifficulty);

  // Expiration: 7 days to complete task
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const attempt = await SkillVerificationAttempt.create({
    studentId,
    skillName: skillName.trim(),
    difficulty: selectedDifficulty,
    taskId: task._id,
    status: "assigned",
    expiresAt,
  });

  // Ensure skill is registered in student's Profile with verified: false
  if (req.user.Profile) {
    const profile = await Profile.findById(req.user.Profile);
    if (profile) {
      const existingSkill = profile.skills.find(
        (s) => s.name.toLowerCase() === skillName.trim().toLowerCase()
      );
      if (!existingSkill) {
        profile.skills.push({
          name: skillName.trim(),
          category: task.category || "Technical",
          level: selectedDifficulty,
          score: 0,
          verified: false,
        });
        await profile.save();
      }
    }
  }

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        attemptId: attempt._id,
        skillName: attempt.skillName,
        difficulty: attempt.difficulty,
        status: attempt.status,
        task: {
          _id: task._id,
          title: task.title,
          problemStatement: task.problemStatement,
          requirements: task.requirements,
          starterRepositoryUrl: task.starterRepositoryUrl,
          rubric: task.rubric,
          estimatedTimeHours: task.estimatedTimeHours,
        },
        expiresAt: attempt.expiresAt,
      },
      "Skill verification task assigned successfully"
    )
  );
});

// ==========================================
// 2. Submit Task Deliverable
// ==========================================
export const submitSkillTask = asyncHandler(async (req, res) => {
  const studentId = req.user._id;
  const { attemptId } = req.params;
  const { repoUrl, liveDemoUrl, notes } = req.body;

  if (!repoUrl || !repoUrl.trim()) {
    throw new ApiError(400, "Repository URL (GitHub/GitLab) is required for verification");
  }

  // Verification check: valid URL
  try {
    const parsed = new URL(repoUrl.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error();
    }
  } catch {
    throw new ApiError(400, "Please provide a valid HTTPS repository URL");
  }

  if (liveDemoUrl && liveDemoUrl.trim()) {
    try {
      const parsed = new URL(liveDemoUrl.trim());
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error();
      }
    } catch {
      throw new ApiError(400, "Please provide a valid HTTPS live demo URL");
    }
  }

  const attempt = await SkillVerificationAttempt.findOne({
    _id: attemptId,
    studentId,
  }).populate("taskId");

  if (!attempt) {
    throw new ApiError(404, "Verification attempt not found or unauthorized");
  }

  if (attempt.status !== "assigned") {
    throw new ApiError(400, `Task cannot be submitted because it is currently '${attempt.status}'`);
  }

  // Save submission data
  attempt.submissionData = {
    repoUrl: repoUrl.trim(),
    liveDemoUrl: liveDemoUrl ? liveDemoUrl.trim() : "",
    notes: notes ? notes.trim() : "",
    submittedAt: new Date(),
  };
  attempt.status = "submitted";
  await attempt.save();

  // Assign to faculty mentor via Fair Load-Balanced Distribution
  const assignmentResult = await assignFacultyToSubmission(
    attempt._id,
    studentId,
    attempt.skillName
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        attemptId: attempt._id,
        skillName: attempt.skillName,
        status: assignmentResult ? "under_review" : "submitted",
        submittedAt: attempt.submissionData.submittedAt,
        assignedFacultyId: assignmentResult ? assignmentResult.faculty._id : null,
        message: assignmentResult
          ? "Deliverable submitted. Routed to faculty mentor for double-blind evaluation."
          : "Deliverable submitted. Pending faculty assignment.",
      },
      "Deliverable submitted successfully"
    )
  );
});

// ==========================================
// 3. Get Student Active Verification Tasks
// ==========================================
export const getStudentActiveTasks = asyncHandler(async (req, res) => {
  const studentId = req.user._id;

  const attempts = await SkillVerificationAttempt.find({
    studentId,
  })
    .populate("taskId")
    .populate("reviewResult")
    .sort({ createdAt: -1 });

  // DOUBLE BLIND: Do not leak mentor identity in response
  const sanitizedAttempts = attempts.map((a) => ({
    attemptId: a._id,
    skillName: a.skillName,
    difficulty: a.difficulty,
    status: a.status,
    task: a.taskId,
    submissionData: a.submissionData,
    assignedAt: a.assignedAt,
    reviewDeadline: a.reviewDeadline,
    expiresAt: a.expiresAt,
    review: a.reviewResult
      ? {
          score: a.reviewResult.score,
          decision: a.reviewResult.decision,
          pros: a.reviewResult.pros,
          cons: a.reviewResult.cons,
          feedbackComments: a.reviewResult.feedbackComments,
          reviewedAt: a.reviewResult.reviewedAt,
          reviewerRole: "Verified Faculty Mentor", // Double blind placeholder
        }
      : null,
  }));

  return res.status(200).json(
    new ApiResponse(200, sanitizedAttempts, "Student verification tasks retrieved successfully")
  );
});

// ==========================================
// 4. Mentor: Get Assigned Review Queue (Faculty Only & Double Blind)
// ==========================================
export const getMentorReviewQueue = asyncHandler(async (req, res) => {
  const mentorId = req.user._id;

  // STRICT AUTHORIZATION: Only faculty accounts can access this queue
  if (req.user.accountType !== "faculty") {
    throw new ApiError(403, "Access restricted to faculty mentors only");
  }

  const pendingAttempts = await SkillVerificationAttempt.find({
    assignedMentorId: mentorId,
    status: "under_review",
  })
    .populate("taskId")
    .sort({ assignedAt: 1 });

  // DOUBLE BLIND ENFORCEMENT:
  // Do NOT return student name, email, avatar, or student ID!
  // Return an anonymous candidate code: e.g. "Candidate #A49F"
  const sanitizedQueue = pendingAttempts.map((attempt) => ({
    attemptId: attempt._id,
    candidateCode: `Candidate #${attempt._id.toString().slice(-4).toUpperCase()}`,
    skillName: attempt.skillName,
    difficulty: attempt.difficulty,
    task: {
      title: attempt.taskId?.title,
      problemStatement: attempt.taskId?.problemStatement,
      requirements: attempt.taskId?.requirements || [],
      rubric: attempt.taskId?.rubric || [],
      starterRepositoryUrl: attempt.taskId?.starterRepositoryUrl,
    },
    submissionData: attempt.submissionData,
    assignedAt: attempt.assignedAt,
    reviewDeadline: attempt.reviewDeadline,
  }));

  const workload = await getOrCreateMentorWorkload(mentorId);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        totalPending: sanitizedQueue.length,
        activeWorkload: workload.activePendingReviews,
        queue: sanitizedQueue,
      },
      "Mentor review queue retrieved successfully (Double Blind)"
    )
  );
});

// ==========================================
// 5. Mentor: Decline / Refuse an Assignment
// ==========================================
export const declineSkillTaskAssignment = asyncHandler(async (req, res) => {
  const facultyId = req.user._id;
  const { attemptId } = req.params;
  const { reason = "" } = req.body;

  // STRICT AUTHORIZATION: Only faculty can decline assignments
  if (req.user.accountType !== "faculty") {
    throw new ApiError(403, "Access restricted to faculty mentors only");
  }

  const attempt = await SkillVerificationAttempt.findById(attemptId);
  if (!attempt) {
    throw new ApiError(404, "Verification attempt not found");
  }

  // Security Verification: A faculty member cannot decline another faculty member's request
  if (!attempt.assignedMentorId || attempt.assignedMentorId.toString() !== facultyId.toString()) {
    throw new ApiError(403, "Unauthorized: You are not the currently assigned faculty mentor for this request");
  }

  if (attempt.status !== "under_review") {
    throw new ApiError(400, `Cannot decline request because it is in '${attempt.status}' status`);
  }

  const previousFacultyId = facultyId;
  const previousFacultyName = req.user.name || "Faculty Mentor";
  const previousFacultyEmail = req.user.email || "NOT_AVAILABLE";
  const declineReason = reason ? reason.trim() : "Declined by faculty mentor";

  // 1. Record decline in attempt history
  if (!Array.isArray(attempt.declinedFaculty)) {
    attempt.declinedFaculty = [];
  }
  attempt.declinedFaculty.push({
    facultyId,
    declinedAt: new Date(),
    reason: declineReason,
  });

  // 2. Decrement former mentor's workload
  await MentorWorkload.findOneAndUpdate(
    { mentorId: facultyId },
    { $inc: { activePendingReviews: -1 } }
  );
  await MentorWorkload.findOneAndUpdate(
    { mentorId: facultyId, activePendingReviews: { $lt: 0 } },
    { $set: { activePendingReviews: 0 } }
  );

  // 3. Clear current assignment
  attempt.assignedMentorId = null;
  attempt.assignedAt = null;
  attempt.reviewDeadline = null;
  attempt.status = "submitted";
  await attempt.save();

  // Log decline event
  console.log(
    `[SKILL_VERIFICATION] event=DECLINED requestId=${attempt._id} previousFacultyId=${previousFacultyId} previousFacultyName="${previousFacultyName}" previousFacultyEmail="${previousFacultyEmail}" reason="${declineReason}"`
  );

  // 4. Gather excluded faculty: all faculty who have declined this attempt
  const excludedFacultyIds = attempt.declinedFaculty.map((d) => d.facultyId.toString());

  // 5. Automatically reassign to another eligible faculty member
  const reassignmentResult = await assignFacultyToSubmission(
    attempt._id,
    attempt.studentId,
    attempt.skillName,
    excludedFacultyIds,
    true // isReassignment flag
  );

  if (reassignmentResult) {
    const newFaculty = reassignmentResult.faculty;
    const newFacultyEmail = newFaculty.email || "NOT_AVAILABLE";
    const matchedSkill = reassignmentResult.matchedSkill || attempt.skillName;
    console.log(
      `[SKILL_VERIFICATION] event=REASSIGNED requestId=${attempt._id} skill="${attempt.skillName}" previousFacultyId=${previousFacultyId} previousFacultyEmail="${previousFacultyEmail}" newFacultyId=${newFaculty._id} newFacultyName="${newFaculty.name}" newFacultyEmail="${newFacultyEmail}" matchedSkill="${matchedSkill}" pendingWorkload=${reassignmentResult.workload} reason=SKILL_MATCH_LOAD_BALANCED`
    );

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          attemptId: attempt._id,
          reassigned: true,
          status: "under_review",
          message: "Assignment declined. Request reassigned to another available faculty mentor.",
        },
        "Assignment declined and reassigned successfully"
      )
    );
  } else {
    // No other eligible faculty with matching skill available
    console.log(
      `[SKILL_VERIFICATION] event=UNASSIGNED requestId=${attempt._id} skill="${attempt.skillName}" previousFacultyId=${previousFacultyId} previousFacultyEmail="${previousFacultyEmail}" reason=NO_ELIGIBLE_FACULTY_WITH_REQUIRED_SKILL`
    );

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          attemptId: attempt._id,
          reassigned: false,
          status: "submitted",
          message: "Assignment declined. No other eligible faculty mentors are available at this time.",
        },
        "Assignment declined; request is currently unassigned"
      )
    );
  }
});

// ==========================================
// 6. Mentor: Evaluate Task (Pass Mark >= 70%)
// ==========================================
export const evaluateSkillTask = asyncHandler(async (req, res) => {
  const mentorId = req.user._id;
  const facultyEmail = req.user.email || "NOT_AVAILABLE";
  const { attemptId } = req.params;
  const { score, pros = [], cons = [], feedbackComments = "" } = req.body;

  // STRICT AUTHORIZATION: Only faculty can evaluate
  if (req.user.accountType !== "faculty") {
    throw new ApiError(403, "Access restricted to faculty mentors only");
  }

  if (score === undefined || score === null || isNaN(score)) {
    throw new ApiError(400, "A numerical score (0 to 100) is required");
  }

  const numericScore = Math.min(100, Math.max(0, Number(score)));

  // PASSING 70 PERCENT RULE:
  // Score >= 70 is APPROVED. Score < 70 is REJECTED.
  const decision = numericScore >= 70 ? "approved" : "rejected";

  const attempt = await SkillVerificationAttempt.findById(attemptId);
  if (!attempt) {
    throw new ApiError(404, "Verification attempt not found");
  }

  // Security Verification check: Only assigned faculty mentor can evaluate
  if (!attempt.assignedMentorId || attempt.assignedMentorId.toString() !== mentorId.toString()) {
    throw new ApiError(403, "Unauthorized: You are not the assigned mentor for this submission");
  }

  if (attempt.status !== "under_review") {
    throw new ApiError(400, `This attempt has already been evaluated or is in '${attempt.status}' state`);
  }

  // Format pros and cons as sanitized string arrays
  const formattedPros = Array.isArray(pros)
    ? pros.filter((p) => typeof p === "string" && p.trim().length > 0).map((p) => p.trim())
    : [];

  const formattedCons = Array.isArray(cons)
    ? cons.filter((c) => typeof c === "string" && c.trim().length > 0).map((c) => c.trim())
    : [];

  // Create review record
  const review = await SkillVerificationReview.create({
    attemptId: attempt._id,
    mentorId,
    decision,
    score: numericScore,
    pros: formattedPros,
    cons: formattedCons,
    feedbackComments: feedbackComments ? feedbackComments.trim() : "",
    reviewedAt: new Date(),
  });

  // Update attempt status
  attempt.status = decision;
  attempt.reviewResult = review._id;
  await attempt.save();

  // Atomically decrement mentor's active workload
  await MentorWorkload.findOneAndUpdate(
    { mentorId },
    {
      $inc: {
        activePendingReviews: -1,
        totalCompletedReviews: 1,
      },
    }
  );
  await MentorWorkload.findOneAndUpdate(
    { mentorId, activePendingReviews: { $lt: 0 } },
    { $set: { activePendingReviews: 0 } }
  );

  // If approved: Update student's Profile with verified: true and score
  const student = await User.findById(attempt.studentId).populate("Profile");
  if (student && student.Profile) {
    const profile = await Profile.findById(student.Profile);
    if (profile && Array.isArray(profile.skills)) {
      const skillIdx = profile.skills.findIndex(
        (s) => s.name.toLowerCase() === attempt.skillName.toLowerCase()
      );

      if (skillIdx !== -1) {
        if (decision === "approved") {
          profile.skills[skillIdx].verified = true;
          profile.skills[skillIdx].score = numericScore;
          profile.skills[skillIdx].level = attempt.difficulty;
        }
      } else if (decision === "approved") {
        profile.skills.push({
          name: attempt.skillName,
          category: "Technical",
          level: attempt.difficulty,
          score: numericScore,
          verified: true,
        });
      }
      await profile.save();
    }
  }

  // Send double-blind notification to student
  const outcomeText =
    decision === "approved"
      ? `Congratulations! Your submission for "${attempt.skillName}" was evaluated with a passing score of ${numericScore}%! The skill is now verified on your Virtual CV.`
      : `Your submission for "${attempt.skillName}" received a score of ${numericScore}%. You need at least 70% to verify. Check your mentor's feedback to practice and retry.`;

  await Notification.create({
    recipient: attempt.studentId,
    sender: null, // Double blind
    type: "submission_reviewed",
    title: decision === "approved" ? "Skill Verified! 🎉" : "Skill Submission Feedback",
    message: outcomeText,
    link: "/dashboard/student?view=cv",
    meta: {
      attemptId: attempt._id,
      skillName: attempt.skillName,
      decision,
      score: numericScore,
    },
  });

  console.log(
    `[SKILL_VERIFICATION] event=EVALUATED requestId=${attempt._id} facultyId=${mentorId} facultyEmail="${facultyEmail}" decision=${decision.toUpperCase()} score=${numericScore}`
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        attemptId: attempt._id,
        decision,
        score: numericScore,
        passingThreshold: 70,
        isApproved: decision === "approved",
      },
      `Review recorded successfully. Outcome: ${decision.toUpperCase()} (${numericScore}%)`
    )
  );
});
