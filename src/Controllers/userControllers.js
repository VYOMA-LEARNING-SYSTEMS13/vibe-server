import { User } from "../models/Users.js";
import Profile from "../models/Profile.js";
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
    internshipType
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
      establishmentYear
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

  // Send Email
  try {
    await sendZohoEmail(email, "otp", { otpCode: otpCode });
  } catch (error) {
    console.error("OTP Email Error Detailed:", error);
    // Cleanup if email fails
    await User.findByIdAndDelete(newUser._id);
    await Profile.findByIdAndDelete(profile._id);
    throw new ApiError(500, `Failed to send OTP email: ${error.message}`);
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

  if (!email) {
    throw new ApiError(400, "Email is required");
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Generate 6-digit OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  user.otp = {
    code: otpCode,
    expiresAt: otpExpiresAt
  };
  await user.save({ validateBeforeSave: false });

  // Send Email
  try {
    await sendZohoEmail(email, "reset", { otpCode: otpCode });
  } catch (error) {
    console.error("Forgot Password Email Error:", error);
    throw new ApiError(500, "Failed to send reset email");
  }

  // try {
  //   await sendGmail(email, "notification", {
  //     message: `Your password reset code for VIBE is: <b>${otpCode}</b>. It is valid for 5 minutes.`,
  //   });
  // } catch (error) {
  //   console.error("Forgot Password Email Error:", error);
  //   throw new ApiError(500, "Failed to send reset email");
  // }
  
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Reset code sent successfully"));
});

// Reset Password - Verify OTP and Update Password
const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    throw new ApiError(400, "Email, OTP and new password are required");
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Check OTP
  if (!user.otp || !user.otp.code || !user.otp.expiresAt) {
     throw new ApiError(400, "No OTP request found. Please try again.");
  }

  if (user.otp.code !== otp) {
    throw new ApiError(400, "Invalid OTP");
  }

  if (new Date() > user.otp.expiresAt) {
    throw new ApiError(400, "OTP has expired. Please request a new one.");
  }

  // Update Password
  user.password = newPassword;
  user.otp = undefined; // Clear OTP
  await user.save({ validateBeforeSave: false }); // Pre-save hook will hash the password

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password reset successfully"));
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

//Get User by ID
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  res.status(200).json(new ApiResponse(201, user, "User got found"));
});

//Update User
const updateUser = asyncHandler(async (req, res) => {
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
    internshipType 
  } = req.body;

  const user = await User.findById(req.params.id);
  
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Update User fields
  if (name) user.name = name;
  if (mobileNo) user.mobileNo = mobileNo;
  if (dob) user.dob = dob;
  
  await user.save({ validateBeforeSave: false });

  // Update Profile fields if user has a profile
  if (user.Profile) {
    const profileUpdate = {};
    if (institutionName) profileUpdate.InstituteName = institutionName;
    if (degree) profileUpdate.degree = degree;
    if (branch) profileUpdate.branch = branch;
    if (currentYear) profileUpdate.yearOfStudy = currentYear;
    if (position) profileUpdate.position = position;
    if (experience) profileUpdate.YearOfExperience = experience;
    if (expertise) profileUpdate.ExpertiseDomains = expertise;
    if (industryType) profileUpdate.IndustryType = industryType;
    if (location) profileUpdate.location = location;
    if (internshipType) profileUpdate.internshipType = internshipType;
    if (establishmentYear) profileUpdate.establishmentYear = establishmentYear;

    await Profile.findByIdAndUpdate(user.Profile, profileUpdate, { new: true });
  }

  const updatedUser = await User.findById(req.params.id)
    .select("-password -refreshToken")
    .populate('Profile');

  res
    .status(200)
    .json(new ApiResponse(201, updatedUser, "User Updated SuccessFully"));
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
      new: true,
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

  res.status(200).json(new ApiResponse(200, user, "User found"));
});

export { registerUser, loginUser, updateUser, getUserById, logoutUser, getCurrentUser, sendOtp, forgotPassword, resetPassword };
