import dotenv from "dotenv";

dotenv.config({
	path: './.env'
});
import connectDB from "./DB/index.js";
import { app } from "./app.js";

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
	console.log(`⚙️ Server is ready and running on port: ${PORT}`);
});

connectDB().catch((err) => {
	console.error("MongoDB connection error:", err.message || err);
});
