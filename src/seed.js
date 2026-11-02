import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import mongoose from "mongoose";
import connectDB from "./DB/index.js";
import { User } from "./models/Users.js";
import Profile from "./models/Profile.js";

const seedFaculty = async () => {
  try {
    console.log("🌱 Connecting to MongoDB to seed Faculty account...");
    await connectDB();

    const facultyEmail = "faculty@vibe.dev";
    const existingFaculty = await User.findOne({ email: facultyEmail });

    if (existingFaculty) {
      console.log(`ℹ️ Seed Faculty user (${facultyEmail}) already exists.`);
      process.exit(0);
    }

    const profile = await Profile.create({
      InstituteName: "National Institute of Technology",
      position: "Associate Professor",
      YearOfExperience: "8",
      ExpertiseDomains: "Computer Science, AI, Web Development",
    });

    const facultyUser = new User({
      name: "Dr. Sarah Jenkins",
      email: facultyEmail,
      mobileNo: "+91 9876543210",
      password: "FacultyPassword123",
      dob: new Date("1985-06-15"),
      accountType: "faculty",
      Profile: profile._id,
      isVerified: true,
    });

    await facultyUser.save();

    console.log("✅ Seed Faculty User created successfully!");
    console.log("==========================================");
    console.log(`Email:    ${facultyEmail}`);
    console.log(`Password: FacultyPassword123`);
    console.log(`Role:     faculty`);
    console.log("==========================================");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
};

seedFaculty();
