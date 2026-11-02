import { v2 as cloudinary } from "cloudinary"; 
import fs from "fs";

const configureCloudinary = () => {
	cloudinary.config({
		cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
		api_key: process.env.CLOUDINARY_API_KEY,
		api_secret: process.env.CLOUDINARY_API_SECRET
	});
};

// Initial config attempt
configureCloudinary();

const uploadOnCloudinary = async (localFilePath, customOptions = {}) => {
	try {
		if (!localFilePath) return null;
		configureCloudinary();

		// upload on cloudinary with auto resource_type by default
		const response = await cloudinary.uploader.upload(localFilePath, {
			resource_type: "auto",
			...customOptions
		});

		if (fs.existsSync(localFilePath)) {
			fs.unlinkSync(localFilePath);
		}
		return response;
	} catch (error) {
		console.error("Cloudinary upload error:", error);
		if (fs.existsSync(localFilePath)) {
			fs.unlinkSync(localFilePath);
		}
		return null;
	}
};

const deleteFromCloudinary = async (cloudinaryFilepath) => {
	try {
	  if (!cloudinaryFilepath) return null;
	  configureCloudinary();
	  const fileName = cloudinaryFilepath.split("/").pop().split(".")[0];
	  const response = await cloudinary.uploader.destroy(fileName);
	  return response;
	} catch (error) {
	  console.log("Error while deleting file from cloudinary : ", error);
	  return null;
	}
};

export {
	uploadOnCloudinary,
	deleteFromCloudinary
};
