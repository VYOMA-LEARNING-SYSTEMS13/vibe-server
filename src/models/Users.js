// degree type 
//branch for college students
//year of student

//position of faculty
// experience level for industry expert
//expertics

// location of comanay
//intership type 
// yearsince establish 
import mongoose from "mongoose";
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    mobileNo: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: [true, "password must be require"],
    },
    dob: {
      type: Date,
      required: function() {
        return this.accountType === 'student' || this.accountType === 'faculty';
      },
    },
    accountType: {
      type: String,
      enum: ["student", "faculty","industry expert"],
      required: true,
    },
    ImageUrl:{
      type: String,
      default:"",
    },
    Profile:{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Profile",
    },
    // institutionType: {
    //   type: String,
    //   enum: ["school", "college","coaching","industry"],  // change to here
    //   default: "school",
    //   required: true,
    // },
    // institutionName: {
    //   type: String,
    //   default: "",
    //   required: false,
    // },
    // level: {
    //   type: String,
    //   default: "",
    //   // required: true,
    // }, // School → Standard, College → Year

    otp: {
      code: { 
        type: String  // 6-digit OTP
      },        
      expiresAt: { 
        type: Date  // Expiration time for the OTP
      },    
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    inviteSent: { 
      type: Boolean,
      default: false 
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    currentToken:{
      type: String,
      default: null
    }
  },

  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return "error is here";

  this.password = await bcrypt.hash(this.password, 10);
  return "success";
});

userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      name: this.name,
    },
    process.env.JWT_ACCESSTOKEN_SECRET,
    {
      expiresIn: process.env.JWT_ACCESSTOKEN_EXPIRY,
    }
  );
};

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.JWT_REFRESHTOKEN_SECRET,
    {
      expiresIn: process.env.JWT_REFRESHTOKEN_EXPIRY,
    }
  );
};

export const User = mongoose.model("User", userSchema);