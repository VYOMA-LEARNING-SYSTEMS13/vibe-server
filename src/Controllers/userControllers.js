import { User } from "../models/Users.js";
import Profile from "../models/Profile.js";
import SkillVerificationAttempt from "../models/SkillVerificationAttempt.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";
import fs from "fs";
import { sendZohoEmail } from "../services/zohoMail.js";
// import { sendGmail } from "../services/gmail.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const generateToken = async function (userId) {
  const user = await User.findById(userId);
  const accessToken = await user.generateAccessToken();
  const refreshToken = await user.generateRefreshToken();
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  return { accessToken, refreshToken };
};

// Initiate Registration (Send OTP)
const sendOtp = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    mobileNo,
    password,
    dob,
    accountType,
    institutionName,
    degree,
    branch,
    currentYear,
    position,
    experience,
    expertise,
    industryType,
    establishmentYear,
    location,
    internshipType,
    website,
    skills
  } = req.body;

  if (
    [name, email, mobileNo, password, accountType].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    if (existingUser.isVerified) {
      throw new ApiError(409, "User with this email already exists and is verified");
    } else {
      // User exists but is not verified - delete to restart registration
      await User.deleteOne({ email });
      if (existingUser.Profile) {
        await Profile.findByIdAndDelete(existingUser.Profile);
      }
    }
  }

  // Create Profile first
  let type = accountType;
  if (accountType === 'industry') type = 'industry expert';

  // Parse & normalize skills (for faculty/student registration)
  let formattedSkills = [];
  if (skills !== undefined) {
    let parsedSkills = skills;
    if (typeof parsedSkills === "string") {
      try {
        parsedSkills = JSON.parse(parsedSkills);
      } catch {
        parsedSkills = parsedSkills.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }
    if (Array.isArray(parsedSkills)) {
      const seen = new Set();
      parsedSkills.forEach((s) => {
        const rawName = typeof s === "string" ? s.trim() : (s?.name ? s.name.trim() : "");
        if (rawName) {
          const lower = rawName.toLowerCase();
          if (!seen.has(lower)) {
            seen.add(lower);
            formattedSkills.push({
              name: rawName,
              category: (typeof s === "object" && s?.category) ? s.category : "Technical",
              level: (typeof s === "object" && s?.level) ? s.level : "Expert",
              score: (typeof s === "object" && typeof s?.score === "number") ? s.score : 90,
              verified: true,
            });
          }
        }
      });
    }
  }

  const profile = await Profile.create({
      InstituteName: institutionName,
      degree,
      branch,
      yearOfStudy: currentYear,
      position,
      YearOfExperience: experience,
      ExpertiseDomains: expertise,
      IndustryType: industryType,
      location,
      internshipType,
      establishmentYear,
      website: website ? website.trim() : "",
      skills: formattedSkills
  });

  // Generate 6-digit OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Create User with isVerified: false and OTP
  // Note: We create the user immediately to store the OTP. 
  // If verification fails or expires, a cron job or new registration attempt should clean up unverified users.
  const newUser = await User.create({
    name,
    email,
    mobileNo,
    password,
    dob: dob || undefined,
    accountType: type,
    Profile: profile._id,
    isVerified: false,
    otp: {
      code: otpCode,
      expiresAt: otpExpiresAt
    }
  });

  // Log OTP in server console for local testing
  console.log(`\n==============================================`);
  console.log(`🔑 [DEVELOPMENT OTP GENERATED]`);
  console.log(`Email: ${email}`);
  console.log(`OTP Code: ${otpCode}`);
  console.log(`==============================================\n`);

  // Send Email
  try {
    await sendZohoEmail(email, "otp", { otpCode: otpCode });
  } catch (error) {
    console.error("OTP Email Error (Zoho Mail):", error.message || error);
    // In production, require email delivery; in dev, allow signup using logged OTP
    if (process.env.NODE_ENV === "production") {
      await User.findByIdAndDelete(newUser._id);
      await Profile.findByIdAndDelete(profile._id);
      throw new ApiError(500, `Failed to send OTP email: ${error.message}`);
    }
  }

  // try {
  //   await sendGmail(email, "notification", {
  //     message: `Your verification code for VIBE is: <b>${otpCode}</b>. It is valid for 5 minutes.`,
  //   });
  // } catch (error) {
  //   console.error("OTP Email Error Detailed:", error);
  //   // Cleanup if email fails
  //   await User.findByIdAndDelete(newUser._id);
  //   await Profile.findByIdAndDelete(profile._id);
  //   throw new ApiError(500, `Failed to send OTP email: ${error.message}`);
  // }

  return res
    .status(200)
    .json(new ApiResponse(200, { email }, "Verification code sent successfully"));
});

// Complete Registration (Verify OTP)
const registerUser = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    throw new ApiError(400, "Email and OTP are required");
  }

  const user = await User.findOne({ email }).populate('Profile');
  
  if (!user) {
    throw new ApiError(404, "User not found. Please register again.");
  }

  if (user.isVerified) {
    throw new ApiError(400, "User is already verified. Please login.");
  }

  // Check OTP
  console.log("OTP Check Debug:", {
    inputOtp: otp,
    storedOtp: user.otp?.code,
    expiresAt: user.otp?.expiresAt,
    now: new Date(),
    match: String(user.otp?.code) === String(otp)
  });

  if (!user.otp || !user.otp.code || !user.otp.expiresAt) {
     throw new ApiError(400, "No OTP found. Please request a new one.");
  }

  if (String(user.otp.code) !== String(otp)) {
    throw new ApiError(400, `Invalid OTP. Input: ${otp}, Stored: ${user.otp.code}`);
  }

  if (new Date() > user.otp.expiresAt) {
    throw new ApiError(400, "OTP has expired. Please request a new one.");
  }

  // Verify User
  user.isVerified = true;
  user.otp = undefined; // Clear OTP
  await user.save({ validateBeforeSave: false });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User verified and registered successfully"));
});

// Forgot Password - Send OTP
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email || !email.trim()) {
    throw new ApiError(400, "Email is required");
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    throw new ApiError(404, "User not found with this email address");
  }

  // Generate 6-digit OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  user.otp = {
    code: otpCode,
    expiresAt: otpExpiresAt,
    attempts: 0
  };
  await user.save({ validateBeforeSave: false });

  // Log OTP in server console for local testing / development
  console.log(`\n==============================================`);
  console.log(`🔑 [DEVELOPMENT RESET OTP GENERATED]`);
  console.log(`Email: ${user.email}`);
  console.log(`OTP Code: ${otpCode}`);
  console.log(`Expires At: ${otpExpiresAt.toLocaleTimeString()}`);
  console.log(`==============================================\n`);

  // Send Email
  try {
    await sendZohoEmail(user.email, "reset", { otpCode: otpCode });
  } catch (error) {
    console.error("Forgot Password Email Error (Zoho Mail):", error.message || error);
    // In production, require email delivery; in dev, allow reset using logged OTP
    if (process.env.NODE_ENV === "production") {
      throw new ApiError(500, `Failed to send reset email: ${error.message}`);
    }
  }
  
  return res
    .status(200)
    .json(new ApiResponse(200, { email: user.email }, "Verification code sent successfully to your email"));
});

// Verify Reset OTP - Pre-validation before entering new password
const verifyResetOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    throw new ApiError(400, "Email and verification code are required");
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (!user.otp || !user.otp.code || !user.otp.expiresAt) {
    throw new ApiError(400, "No password reset request found. Please request a new code.");
  }

  if (new Date() > new Date(user.otp.expiresAt)) {
    user.otp = undefined;
    await user.save({ validateBeforeSave: false });
    throw new ApiError(400, "Verification code has expired. Please request a new one.");
  }

  if ((user.otp.attempts || 0) >= 5) {
    user.otp = undefined;
    await user.save({ validateBeforeSave: false });
    throw new ApiError(400, "Too many failed attempts. Please request a new verification code.");
  }

  if (String(user.otp.code).trim() !== String(otp).trim()) {
    user.otp.attempts = (user.otp.attempts || 0) + 1;
    await user.save({ validateBeforeSave: false });
    const remaining = 5 - user.otp.attempts;
    throw new ApiError(400, `Invalid verification code. ${remaining > 0 ? `${remaining} attempts remaining.` : "Please request a new code."}`);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { email: user.email, verified: true }, "Code verified successfully"));
});

// Reset Password - Verify OTP and Update Password
const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    throw new ApiError(400, "Email, verification code and new password are required");
  }

  if (String(newPassword).length < 6) {
    throw new ApiError(400, "New password must be at least 6 characters long");
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Check OTP
  if (!user.otp || !user.otp.code || !user.otp.expiresAt) {
    throw new ApiError(400, "No reset request found. Please request a new code.");
  }

  if (new Date() > new Date(user.otp.expiresAt)) {
    user.otp = undefined;
    await user.save({ validateBeforeSave: false });
    throw new ApiError(400, "Verification code has expired. Please request a new one.");
  }

  if ((user.otp.attempts || 0) >= 5) {
    user.otp = undefined;
    await user.save({ validateBeforeSave: false });
    throw new ApiError(400, "Too many failed attempts. Please request a new verification code.");
  }

  if (String(user.otp.code).trim() !== String(otp).trim()) {
    user.otp.attempts = (user.otp.attempts || 0) + 1;
    await user.save({ validateBeforeSave: false });
    const remaining = 5 - user.otp.attempts;
    throw new ApiError(400, `Invalid verification code. ${remaining > 0 ? `${remaining} attempts remaining.` : "Please request a new code."}`);
  }

  // Update Password & invalidate existing active sessions
  user.password = newPassword;
  user.otp = undefined; // Clear OTP
  user.currentToken = null;
  user.refreshToken = undefined;
  await user.save({ validateBeforeSave: false }); // Pre-save hook will hash the password

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password reset successfully. You can now login with your new password."));
});

// Change Password - Authenticated (verify current password)
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, "Current password and new password are required");
  }

  if (String(newPassword).length < 6) {
    throw new ApiError(400, "New password must be at least 6 characters long");
  }

  if (String(currentPassword) === String(newPassword)) {
    throw new ApiError(400, "New password must be different from current password");
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isMatch = await user.isPasswordCorrect(currentPassword);
  if (!isMatch) {
    throw new ApiError(400, "Current password is incorrect");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false }); // Pre-save hook will hash the password

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password updated successfully"));
});

//Login User
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email && !password) {
    throw new ApiError(404, "username or email required");
  }

  const user = await User.findOne({ email });
  if (!user) throw new ApiError(409, "User Not Exist");

  if (!user.isVerified) {
    throw new ApiError(403, "Please verify your email address before logging in");
  }

  const isMatch = await user.isPasswordCorrect(password);

  if (!isMatch) {
    throw new ApiError(400, "Invalid user credentials");
  }

  const { accessToken, refreshToken } = await generateToken(user._id);

  user.currentToken = refreshToken;
  await user.save();

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        201,
        {
          user: accessToken,
          refreshToken,
          loggedInUser,
        },
        "User got LoggedIn"
      )
    );
});


const enrichStudentSkills = async (userObj) => {
  if (!userObj || userObj.accountType !== "student") return userObj;

  try {
    const attempts = await SkillVerificationAttempt.find({
      studentId: userObj._id,
    }).sort({ createdAt: -1 });

    const attemptMap = new Map();
    for (const att of attempts) {
      const key = (att.skillName || "").toLowerCase().trim();
      if (!attemptMap.has(key)) {
        attemptMap.set(key, att);
      } else {
        const existing = attemptMap.get(key);
        if (att.status === "approved") {
          attemptMap.set(key, att);
        } else if (
          ["assigned", "submitted", "under_review"].includes(att.status) &&
          !["approved", "assigned", "submitted", "under_review"].includes(existing.status)
        ) {
          attemptMap.set(key, att);
        }
      }
    }

    const enrichSkill = (skill) => {
      const skillObj = typeof skill.toObject === "function" ? skill.toObject() : { ...skill };
      const key = (skillObj.name || "").toLowerCase().trim();
      const att = attemptMap.get(key);

      let verificationStatus = "not_verified";
      let score = typeof skillObj.score === "number" ? skillObj.score : 0;

      if (skillObj.verified === true || att?.status === "approved") {
        verificationStatus = "verified";
        if (typeof skillObj.score === "number" && skillObj.score > 0) {
          score = skillObj.score;
        }
      } else if (att && ["assigned", "submitted", "under_review"].includes(att.status)) {
        verificationStatus = "under_review";
      } else if (att && att.status === "rejected") {
        verificationStatus = "rejected";
      } else {
        verificationStatus = "not_verified";
      }

      return {
        ...skillObj,
        score,
        verificationStatus,
      };
    };

    if (userObj.Profile && Array.isArray(userObj.Profile.skills)) {
      userObj.Profile.skills = userObj.Profile.skills.map(enrichSkill);
    }

    if (Array.isArray(userObj.skills) && userObj.skills.length > 0) {
      userObj.skills = userObj.skills.map(enrichSkill);
    }
  } catch (error) {
    console.error("Error enriching student skills:", error);
  }

  return userObj;
};

//Get User by ID
const getUserById = asyncHandler(async (req, res) => {
  const isOwner = req.user?._id?.toString() === req.params.id.toString();

  let selectFields = "-password -refreshToken -otp -currentToken";
  if (!isOwner) {
    selectFields += " -mobileNo";
  }

  const user = await User.findById(req.params.id)
    .select(selectFields)
    .populate("Profile");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const userObj = user.toObject();
  const enrichedUser = await enrichStudentSkills(userObj);

  res.status(200).json(new ApiResponse(200, enrichedUser, "User found"));
});

//Update User
const updateUser = asyncHandler(async (req, res) => {
  // Enforce ownership: users can only update their own profile
  if (req.user._id.toString() !== req.params.id.toString()) {
    throw new ApiError(403, "You can only update your own profile");
  }

  const { 
    name, 
    mobileNo, 
    dob,
    institutionName, 
    degree, 
    branch, 
    currentYear, 
    position, 
    experience, 
    expertise, 
    industryType, 
    establishmentYear, 
    location, 
    internshipType,
    website,
    skills,
  } = req.body;

  const user = await User.findById(req.params.id);
  
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Update User fields
  const finalName = name || req.body.companyName;
  if (finalName) user.name = finalName;
  if (mobileNo) user.mobileNo = mobileNo;
  if (dob) user.dob = dob;
  if (req.body.ImageUrl !== undefined) user.ImageUrl = req.body.ImageUrl;
  
  await user.save({ validateBeforeSave: false });

  // Prepare profile fields
  const profileUpdate = {};
  if (institutionName || req.body.companyName) profileUpdate.InstituteName = institutionName || req.body.companyName;
  if (degree) profileUpdate.degree = degree;
  if (branch) profileUpdate.branch = branch;
  if (currentYear) profileUpdate.yearOfStudy = currentYear;
  if (position || req.body.tagline) profileUpdate.position = position || req.body.tagline;
  if (experience) profileUpdate.YearOfExperience = experience;
  if (expertise) profileUpdate.ExpertiseDomains = expertise;
  if (industryType || req.body.about) profileUpdate.IndustryType = industryType || req.body.about;
  if (location) profileUpdate.location = location;
  if (internshipType) profileUpdate.internshipType = internshipType;
  if (establishmentYear) profileUpdate.establishmentYear = establishmentYear;
  if (website !== undefined) {
    profileUpdate.website = website ? website.trim() : "";
  }

  if (skills !== undefined) {
    let parsedSkills = skills;
    if (typeof parsedSkills === "string") {
      try {
        parsedSkills = JSON.parse(parsedSkills);
      } catch {
        parsedSkills = parsedSkills.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }
    if (Array.isArray(parsedSkills)) {
      const seen = new Set();
      const sanitized = [];
      parsedSkills.forEach((s) => {
        const rawName = typeof s === "string" ? s.trim() : (s?.name ? s.name.trim() : "");
        if (rawName) {
          const lower = rawName.toLowerCase();
          if (!seen.has(lower)) {
            seen.add(lower);
            sanitized.push({
              name: rawName,
              category: (typeof s === "object" && s?.category) ? s.category : "Technical",
              level: (typeof s === "object" && s?.level) ? s.level : "Expert",
              score: (typeof s === "object" && typeof s?.score === "number") ? s.score : 90,
              verified: true,
            });
          }
        }
      });
      profileUpdate.skills = sanitized;
      user.skills = sanitized;
    }
  }

  if (user.Profile) {
    await Profile.findByIdAndUpdate(user.Profile, profileUpdate, { returnDocument: "after" });
  } else if (Object.keys(profileUpdate).length > 0) {
    const newProfile = await Profile.create(profileUpdate);
    user.Profile = newProfile._id;
    await user.save({ validateBeforeSave: false });
  }

  const updatedUser = await User.findById(req.params.id)
    .select("-password -refreshToken")
    .populate('Profile');

  res
    .status(200)
    .json(new ApiResponse(200, updatedUser, "User Updated Successfully"));
});

const logoutUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      returnDocument: "after",
    }
  );

  if (!user) {
    throw new ApiError(404, "invalid user credentials");
  }

  const options = {
    httpOnly: true,
    secure: true,
  };

  res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(201, {}, "logged out successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("-password -refreshToken").populate('Profile');

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const userObj = user.toObject();
  const enrichedUser = await enrichStudentSkills(userObj);

  res.status(200).json(new ApiResponse(200, enrichedUser, "User found"));
});


// Request Email Change (Authenticated)
const requestEmailChange = asyncHandler(async (req, res) => {
  const { newEmail } = req.body;
  const userId = req.user._id;

  if (!newEmail || typeof newEmail !== "string") {
    throw new ApiError(400, "Valid new email address is required");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const normalizedNewEmail = newEmail.toLowerCase().trim();

  if (!emailRegex.test(normalizedNewEmail)) {
    throw new ApiError(400, "Please provide a valid email format");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.email.toLowerCase().trim() === normalizedNewEmail) {
    throw new ApiError(400, "New email must be different from your current email address");
  }

  // Check if another account already uses this email
  const existingUser = await User.findOne({
    email: normalizedNewEmail,
    _id: { $ne: user._id },
  });
  if (existingUser) {
    throw new ApiError(400, "An account with this email address already exists");
  }

  // Generate 6-digit verification code
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  user.pendingEmail = {
    email: normalizedNewEmail,
    code: otpCode,
    expiresAt,
    attempts: 0,
  };

  await user.save({ validateBeforeSave: false });

  console.log(`\n==============================================`);
  console.log(`🔑 [EMAIL CHANGE VERIFICATION OTP GENERATED]`);
  console.log(`User: ${user.name} (${user.accountType})`);
  console.log(`Current Email: ${user.email}`);
  console.log(`New Email: ${normalizedNewEmail}`);
  console.log(`OTP Code: ${otpCode}`);
  console.log(`==============================================\n`);

  sendZohoEmail(normalizedNewEmail, "otp", { otpCode }).catch((emailErr) => {
    console.error("Failed to send email-change verification code:", emailErr.message || emailErr);
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        pendingEmail: normalizedNewEmail,
        expiresAt,
      },
      "Verification code sent to your new email address. Please verify to complete the update."
    )
  );
});

// Verify & Apply Email Change (Authenticated)
const verifyEmailChange = asyncHandler(async (req, res) => {
  const { otp } = req.body;
  const userId = req.user._id;

  if (!otp || typeof otp !== "string" || !otp.trim()) {
    throw new ApiError(400, "Verification code is required");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (!user.pendingEmail || !user.pendingEmail.email || !user.pendingEmail.code) {
    throw new ApiError(400, "No pending email change request found. Please request a new verification code.");
  }

  // Check expiration
  if (new Date() > new Date(user.pendingEmail.expiresAt)) {
    throw new ApiError(400, "Verification code has expired. Please request a new one.");
  }

  // Check attempts
  if ((user.pendingEmail.attempts || 0) >= 5) {
    await User.findByIdAndUpdate(user._id, { $unset: { pendingEmail: 1 } });
    throw new ApiError(400, "Too many failed attempts. Please request a new verification code.");
  }

  // Validate OTP code
  if (String(user.pendingEmail.code).trim() !== String(otp).trim()) {
    user.pendingEmail.attempts = (user.pendingEmail.attempts || 0) + 1;
    await user.save({ validateBeforeSave: false });
    const remaining = 5 - user.pendingEmail.attempts;
    throw new ApiError(
      400,
      `Invalid verification code. ${remaining > 0 ? `${remaining} attempts remaining.` : "Please request a new code."}`
    );
  }

  const newVerifiedEmail = user.pendingEmail.email;

  // Double check uniqueness right before commit
  const collision = await User.findOne({
    email: newVerifiedEmail,
    _id: { $ne: user._id },
  });
  if (collision) {
    await User.findByIdAndUpdate(user._id, { $unset: { pendingEmail: 1 } });
    throw new ApiError(400, "An account with this email address was registered by another user.");
  }

  // Apply new email and clear pendingEmail atomically
  const updatedUser = await User.findByIdAndUpdate(
    user._id,
    {
      $set: { email: newVerifiedEmail },
      $unset: { pendingEmail: 1 },
    },
    { returnDocument: "after" }
  )
    .select("-password -refreshToken -otp -pendingEmail")
    .populate("Profile");

  // Issue fresh tokens reflecting the updated email
  const { accessToken, refreshToken } = await generateToken(user._id);

  const options = {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  };

  const responsePayload = {
    ...updatedUser.toObject(),
    accessToken,
    refreshToken,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        responsePayload,
        "Email address verified and updated successfully!"
      )
    );
});

// Resend Email Change OTP (Authenticated)
const resendEmailChangeOtp = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (!user.pendingEmail || !user.pendingEmail.email) {
    throw new ApiError(400, "No pending email change request found.");
  }

  const targetEmail = user.pendingEmail.email;
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  user.pendingEmail.code = otpCode;
  user.pendingEmail.expiresAt = expiresAt;
  user.pendingEmail.attempts = 0;
  await user.save({ validateBeforeSave: false });

  console.log(`\n==============================================`);
  console.log(`🔑 [RESENT EMAIL CHANGE VERIFICATION OTP]`);
  console.log(`User: ${user.name}`);
  console.log(`Target New Email: ${targetEmail}`);
  console.log(`OTP Code: ${otpCode}`);
  console.log(`==============================================\n`);

  sendZohoEmail(targetEmail, "otp", { otpCode }).catch((emailErr) => {
    console.error("Failed to resend email-change verification code:", emailErr.message || emailErr);
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      { pendingEmail: targetEmail, expiresAt },
      "A new verification code has been sent to your email address."
    )
  );
});


// Upload / Update Profile Picture (Avatar)
const uploadUserAvatar = asyncHandler(async (req, res) => {
  const userId = req.params.id || req.user?._id;

  // Enforce ownership: users can only update their own profile picture
  if (req.user._id.toString() !== userId.toString()) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    throw new ApiError(403, "You can only update your own profile picture");
  }

  if (!req.file) {
    throw new ApiError(400, "Please select an image file to upload");
  }

  // Validate mime type
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
  if (!allowedMimeTypes.includes(req.file.mimetype)) {
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    throw new ApiError(400, "Only JPEG, PNG, and WebP image formats are allowed");
  }

  // Validate file size (max 5MB)
  const maxSize = 5 * 1024 * 1024;
  if (req.file.size > maxSize) {
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    throw new ApiError(400, "Image size exceeds 5MB limit");
  }

  const uploadResult = await uploadOnCloudinary(req.file.path, {
    folder: "vibe_avatars",
  });

  if (!uploadResult || !uploadResult.secure_url) {
    throw new ApiError(500, "Failed to upload image to storage service");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.ImageUrl && user.ImageUrl.includes("cloudinary.com") && user.ImageUrl.includes("vibe_avatars")) {
    try {
      await deleteFromCloudinary(user.ImageUrl);
    } catch (e) {
      // Ignore deletion failure of previous avatar
    }
  }

  user.ImageUrl = uploadResult.secure_url;
  await user.save({ validateBeforeSave: false });

  const updatedUser = await User.findById(userId)
    .select("-password -refreshToken")
    .populate("Profile");

  const userObj = updatedUser.toObject();
  const enrichedUser = await enrichStudentSkills(userObj);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        user: enrichedUser,
        imageUrl: uploadResult.secure_url,
      },
      "Profile picture updated successfully"
    )
  );
});

// Remove Profile Picture (Avatar)
const removeUserAvatar = asyncHandler(async (req, res) => {
  const userId = req.params.id || req.user?._id;
  if (req.user._id.toString() !== userId.toString()) {
    throw new ApiError(403, "You can only update your own profile picture");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.ImageUrl && user.ImageUrl.includes("cloudinary.com") && user.ImageUrl.includes("vibe_avatars")) {
    try {
      await deleteFromCloudinary(user.ImageUrl);
    } catch (e) {}
  }

  user.ImageUrl = "";
  await user.save({ validateBeforeSave: false });

  const updatedUser = await User.findById(userId)
    .select("-password -refreshToken")
    .populate("Profile");

  const userObj = updatedUser.toObject();
  const enrichedUser = await enrichStudentSkills(userObj);

  res.status(200).json(
    new ApiResponse(
      200,
      {
        user: enrichedUser,
        imageUrl: "",
      },
      "Profile picture removed successfully"
    )
  );
});

// Cancel Email Change Request (Authenticated)
const cancelEmailChange = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const user = await User.findByIdAndUpdate(
    userId,
    { $unset: { pendingEmail: 1 } },
    { returnDocument: "after" }
  );
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return res.status(200).json(
    new ApiResponse(200, {}, "Email change request cancelled.")
  );
});

export { registerUser, loginUser, updateUser, getUserById, logoutUser, getCurrentUser, sendOtp, forgotPassword, verifyResetOtp, resetPassword, changePassword, requestEmailChange, verifyEmailChange, resendEmailChangeOtp, cancelEmailChange, uploadUserAvatar, removeUserAvatar };
