import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "5kb" }));
app.use(express.urlencoded({ extended: true, limit: "5kb" }));
app.use(express.static("public"));

app.use(cookieParser());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Middleware to check DB connection status for API routes
const checkDbConnection = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      statusCode: 503,
      message: "Database connection is not available. Please verify MONGODB_URI in your backend .env file.",
    });
  }
  next();
};

// Healthcheck route
app.get("/api/v1/health", (req, res) => {
  const dbStates = ["disconnected", "connected", "connecting", "disconnecting"];
  const dbStatus = dbStates[mongoose.connection.readyState] || "unknown";
  res.status(200).json({
    status: "online",
    message: "Backend server is running",
    database: {
      status: dbStatus,
      isConnected: mongoose.connection.readyState === 1,
    },
  });
});

// router imports
import userRouter from "./routes/userRoutes.js";
import postRouter from "./routes/postRoutes.js";
import taskRouter from "./routes/taskRoutes.js";
import submissionRouter from "./routes/taskSubmissionRoutes.js";
import virtualresume from "./routes/VirtualResume.js";  
import mentorRequestRouter from "./routes/mentorRequest.routes.js";

// router declarations
app.use("/api/v1/mentor-requests", (req, res, next) => {
  console.log("Entering mentorRequest router");
  next();
}, checkDbConnection, mentorRequestRouter);
app.use("/api/v1/users", checkDbConnection, userRouter);
app.use("/api/v1/posts", checkDbConnection, postRouter);
app.use("/api/v1/tasks", checkDbConnection, taskRouter);
app.use("/api/v1/submissions", checkDbConnection, submissionRouter);
app.use("/api/v1/virtualresume", checkDbConnection, virtualresume);

// 404 handler
app.use((req, res) => {
  console.log(`404 at ${req.method} ${req.url}`);
  res.status(404).json({ message: `Route ${req.method} ${req.url} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || err.code || 500;
  const message = err.message || "Internal Server Error";
  res.status(typeof statusCode === "number" && statusCode >= 100 && statusCode < 600 ? statusCode : 500).json({
    success: false,
    statusCode: statusCode,
    message: message,
    errors: err.errors || [],
  });
});

export { app };
