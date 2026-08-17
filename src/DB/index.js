import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
	const primaryUri = process.env.MONGODB_URI || `mongodb://127.0.0.1:27017/${DB_NAME}`;
	const fallbackUri = `mongodb://127.0.0.1:27017/${DB_NAME}`;

	try {
		const connectInstance = await mongoose.connect(primaryUri, { dbName: DB_NAME });
		console.log(`\n✅ MongoDB connected successfully! DB HOST: ${connectInstance.connection.host}`);
		return connectInstance;
	} catch (error) {
		console.error("❌ Primary MongoDB connection error:", error.message || error);
		
		// If primary URI was not local, attempt fallback to local MongoDB
		if (primaryUri !== fallbackUri) {
			try {
				console.log(`🔄 Attempting fallback connection to local MongoDB (${fallbackUri})...`);
				const localInstance = await mongoose.connect(fallbackUri, { dbName: DB_NAME });
				console.log(`\n✅ Local fallback MongoDB connected successfully! DB HOST: ${localInstance.connection.host}`);
				return localInstance;
			} catch (fallbackError) {
				console.error("❌ Local MongoDB fallback error:", fallbackError.message || fallbackError);
			}
		}

		console.warn("⚠️ Server will continue running, but database operations will fail until a valid MongoDB connection is established.");
		return null;
	}
};

export default connectDB;
