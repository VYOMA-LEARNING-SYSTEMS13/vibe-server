import dotenv from "dotenv";

dotenv.config({
	path: './.env'
});
import connectDB from "./DB/index.js";
import { app } from "./app.js";
import { seedSkillTasks } from "./seeders/skillTasksSeed.js";

const PORT = process.env.PORT || 8000;

connectDB()
  .then(async () => {
    await seedSkillTasks();
    app.listen(PORT, () => {
      console.log(`⚙️ Server is ready and running on port: ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err.message || err);
    app.listen(PORT, () => {
      console.log(`⚠️ Server running in fallback mode on port: ${PORT}`);
    });
  });
