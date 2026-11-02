import mongoose from "mongoose";
const profileSchema=new mongoose.Schema({
    InstituteName:{
        type:String,
        default:"",
    },
    degree:{
        type:String,
        default:"",
    },
    branch:{
        type:String,
        default:"", 
    },
    yearOfStudy:{
        type:String,
        default:"",
    },
    position:{
        type:String,
        default:"",
    },
    YearOfExperience:{
        type:String,
        default:"",
    },
    ExpertiseDomains:{
        type:String,
        default:"",
    },
    IndustryType:{
        type:String,
        default:"",
    },
    location:{
        type:String,
        default:"",
    },
    internshipType:{
        type:String,
        default:"",
    },
    establishmentYear:{
        type:String,
        default:"",
    },
    website:{
        type:String,
        default:"",
    },
    skills: [
        {
            name: {
                type: String,
                required: true,
                trim: true,
            },
            category: {
                type: String,
                enum: ["Technical", "Tools", "Soft Skills"],
                default: "Technical",
            },
            level: {
                type: String,
                default: "Intermediate",
            },
            score: {
                type: Number,
                default: 85,
            },
            verified: {
                type: Boolean,
                default: false,
            },
        },
    ],
});

const Profile = mongoose.model("Profile", profileSchema);
export default Profile;