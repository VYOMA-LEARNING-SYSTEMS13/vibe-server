# VIBE Server (Backend API)

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express-v5-blue.svg)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-brightgreen.svg)](https://mongoosejs.com/)
[![License](https://img.shields.io/badge/license-ISC-orange.svg)]()

**VIBE Server** is the RESTful backend engine for the VIBE Platform (Verified Internship & Mentorship System). It provides multi-role authentication (Students, Faculty, Industry Experts), challenge management (Task Mania), mentorship request lifecycle, social community feed, and virtual resume generation.

---

## Key Features

- **Multi-Role Authentication**: JWT access & refresh token rotation, bcrypt password hashing, and 6-digit OTP verification via email.
- **Resilient Server Startup & Database Auto-Fallback**: Server starts immediately regardless of remote database status and automatically falls back to local MongoDB (`mongodb://127.0.0.1:27017/vibedatabase`) if primary URI is unavailable.
- **Task Mania (Challenges)**: Industry experts post verified real-world tasks; students review and submit solutions.
- **Mentorship Requests**: Students send mentorship requests to verified faculty mentors; faculty can approve or reject requests.
- **Community Feed**: Posts, comments, and upvoting/vibe score tracking for peer engagement.
- **Virtual Resume Engine**: Dynamic user profile summary and portfolio generation.
- **Media Uploads**: Cloudinary integration for attachment & asset storage via Multer.
- **Health Check & Diagnostics**: `/api/v1/health` endpoint for monitoring backend and database connectivity.

---

## System Architecture

```mermaid
flowchart TD
    CLIENT["VIBE Client (React + Vite)"]

    subgraph SERVER["VIBE Backend Server (Port 8000)"]
        APP["Express Application"]
        MW["Middleware Layer (CORS + Cookies + Auth)"]
        ROUTES["API Routes (/api/v1)"]

        USER_ROUTE["User Routes"]
        TASK_ROUTE["Task Routes"]
        SUB_ROUTE["Submission Routes"]
        MENTOR_ROUTE["Mentor Request Routes"]
        POST_ROUTE["Post Routes"]
        RESUME_ROUTE["Virtual Resume Routes"]
        HEALTH_ROUTE["Health Route"]

        USER_CTRL["User Controller"]
        TASK_CTRL["Task Controller"]
        SUB_CTRL["Submission Controller"]
        MENTOR_CTRL["Mentor Controller"]
        POST_CTRL["Post Controller"]
        RESUME_CTRL["Resume Controller"]

        USER_MODEL["User + Profile Models"]
        TASK_MODEL["Task + Submission Models"]
        MENTOR_MODEL["Mentor Request Model"]
        POST_MODEL["Post + Comment Models"]
    end

    subgraph SERVICES["External Services"]
        ATLAS[("MongoDB Atlas")]
        LOCAL[("Local MongoDB")]
        CLOUDINARY["Cloudinary"]
        EMAIL["Zoho Mail"]
    end

    CLIENT -->|"HTTP / REST API"| APP
    APP --> MW
    MW --> ROUTES

    ROUTES --> USER_ROUTE
    ROUTES --> TASK_ROUTE
    ROUTES --> SUB_ROUTE
    ROUTES --> MENTOR_ROUTE
    ROUTES --> POST_ROUTE
    ROUTES --> RESUME_ROUTE
    ROUTES --> HEALTH_ROUTE

    USER_ROUTE --> USER_CTRL
    TASK_ROUTE --> TASK_CTRL
    SUB_ROUTE --> SUB_CTRL
    MENTOR_ROUTE --> MENTOR_CTRL
    POST_ROUTE --> POST_CTRL
    RESUME_ROUTE --> RESUME_CTRL

    USER_CTRL --> USER_MODEL
    TASK_CTRL --> TASK_MODEL
    SUB_CTRL --> TASK_MODEL
    MENTOR_CTRL --> MENTOR_MODEL
    POST_CTRL --> POST_MODEL
    RESUME_CTRL --> USER_MODEL

    USER_MODEL --> ATLAS
    TASK_MODEL --> ATLAS
    MENTOR_MODEL --> ATLAS
    POST_MODEL --> ATLAS

    ATLAS -.->|"Fallback"| LOCAL

    USER_CTRL -->|"OTP Email"| EMAIL
    POST_CTRL -->|"Media Upload"| CLOUDINARY
```

## Authentication & OTP Sequence Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Student / Faculty / Industry
    participant Client as VIBE Client
    participant Server as Express Server
    participant DB as MongoDB
    participant Mail as Zoho Email Service

    User->>Client: Fill Signup Form (Step 1-3)
    Client->>Server: POST /api/v1/users/register (User & Profile Data)
    Server->>DB: Save Unverified User & Generate OTP
    Server->>Mail: Send OTP Email to User
    Server-->>Client: 200 Verification Code Sent
    
    User->>Client: Enter 6-digit OTP
    Client->>Server: POST /api/v1/users/verify-otp (email, otp)
    Server->>DB: Validate OTP & Set isVerified = true
    Server-->>Client: 201 User Registered & Verified

    User->>Client: Login (Email & Password)
    Client->>Server: POST /api/v1/users/login
    Server->>DB: Validate Credentials
    Server->>Server: Generate JWT Access & Refresh Tokens
    Server-->>Client: 200 OK + JWT Tokens (Cookies & Response)
    Client->>Client: Save Access Token to LocalStorage
```

---

## Directory Structure

```
vibe-server/
├── public/                 # Static public assets
├── src/
│   ├── Controllers/        # Business logic controllers
│   │   ├── Comment.controller.JS
│   │   ├── Post.controllers.js
│   │   ├── VirtualResumeController.js
│   │   ├── mentorRequest.controller.js
│   │   ├── task.controller.js
│   │   ├── taskSubmission.controller.js
│   │   └── userControllers.js
│   ├── DB/
│   │   └── index.js        # Mongoose database connection with fallback
│   ├── middlewares/        # Express custom middlewares
│   │   ├── authMiddleware.js
│   │   └── multerMiddleware.js
│   ├── models/             # Mongoose schemas & data models
│   │   ├── MentorRequest.js
│   │   ├── Post.js
│   │   ├── Profile.js
│   │   ├── TaskMania.js
│   │   ├── TaskSubmission.js
│   │   └── Users.js
│   ├── routes/             # REST endpoint route definitions
│   │   ├── VirtualResume.js
│   │   ├── mentorRequest.routes.js
│   │   ├── postRoutes.js
│   │   ├── taskRoutes.js
│   │   ├── taskSubmissionRoutes.js
│   │   └── userRoutes.js
│   ├── services/           # Mail and external API integrations
│   │   └── zohoMail.js
│   ├── utils/              # Helper utilities
│   │   ├── ApiError.js
│   │   ├── ApiResponse.js
│   │   ├── asyncHandler.js
│   │   └── cloudinary.js
│   ├── app.js              # Express app setup, CORS, route mapping & error handlers
│   ├── constants.js        # Global constants (DB_NAME)
│   └── index.js            # Node server listener entry point
├── .env                    # Environment configuration
├── package.json
└── README.md
```

---

## Environment Variables Setup

Create a `.env` file in the root of `vibe-server`:

```env
PORT=8000

# Database Connections (Primary URI & Local Fallback)
MONGODB_URI=mongodb://127.0.0.1:27017/vibedatabase
# MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.qzyqwoa.mongodb.net

# JWT Configuration
JWT_ACCESSTOKEN_SECRET=your_jwt_access_secret_key_here
JWT_ACCESSTOKEN_EXPIRY=1d
JWT_REFRESHTOKEN_SECRET=your_jwt_refresh_secret_key_here
JWT_REFRESHTOKEN_EXPIRY=7d

# CORS Allowed Origins
CORS_ORIGIN=http://localhost:3000,https://vibe-platform-zeta.vercel.app

# Email Service (Zoho SMTP)
ZOHO_USER=contact@curioteach.com
ZOHO_FROM=contact@curioteach.com
ZOHO_FROM_EMAIL=contact@curioteach.com
ZOHO_SMTP_PORT=465

# Cloudinary Setup
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

---

## Getting Started

### Prerequisites

- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher
- **MongoDB**: Local MongoDB instance or Mongo Atlas Cluster

### Installation & Execution

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Server in Development Mode**:
   ```bash
   npm run dev
   ```

3. **Run Server in Production Mode**:
   ```bash
   npm start
   ```

---

## Main API Endpoints Summary

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/api/v1/health` | Diagnostic check for server & database status | No |
| `POST` | `/api/v1/users/register` | Initiate registration & send 6-digit OTP email | No |
| `POST` | `/api/v1/users/verify-otp` | Verify OTP & complete user creation | No |
| `POST` | `/api/v1/users/login` | Authenticate user & receive JWT tokens | No |
| `GET` | `/api/v1/users/me` | Fetch authenticated user profile & role | Yes |
| `GET` | `/api/v1/tasks` | Fetch all Task Mania challenges | Yes |
| `POST` | `/api/v1/tasks` | Post a new industry task challenge | Yes |
| `POST` | `/api/v1/submissions/submit` | Submit solution for a task challenge | Yes |
| `POST` | `/api/v1/mentor-requests/request` | Submit mentorship request to faculty | Yes |
| `GET` | `/api/v1/mentor-requests/faculty-requests` | Faculty view pending student requests | Yes |
| `GET` | `/api/v1/posts` | Fetch community feed posts | No |
| `POST` | `/api/v1/posts/create` | Publish a post with optional attachments | Yes |
| `GET` | `/api/v1/virtualresume/:userId` | Get generated Virtual Resume data | Yes |

---

## License

Distributed under the **ISC License**.

---

## AWS EC2 & GitHub Actions CI/CD Deployment Guide

The `vibe-server` project includes an automated GitHub Actions workflow (`.github/workflows/deploy.yml`) that builds, tests, and deploys the backend application to an AWS EC2 instance using **SSH** and **PM2**.

### 1. GitHub Repository Secrets Setup

Navigate to **GitHub Repository Settings > Secrets and variables > Actions** and add the following secrets:

#### AWS EC2 SSH Access Secrets
| Secret Name | Description | Example Value |
| :--- | :--- | :--- |
| `EC2_HOST` | Public IPv4 Address or Elastic IP of EC2 | `54.210.12.34` |
| `EC2_USER` | SSH Username for EC2 OS | `ubuntu` (or `ec2-user`) |
| `EC2_SSH_KEY` | Private SSH Key (`.pem` file content) | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `EC2_PORT` | *(Optional)* SSH Port | `22` |

#### Application & Environment Secrets
| Secret Name | Required? | Description | Example / Default |
| :--- | :---: | :--- | :--- |
| `PORT` | Optional | Backend Server HTTP Port | `8000` |
| `MONGODB_URI` | **Yes** | MongoDB Atlas / Production URI | `mongodb+srv://user:pass@cluster.mongodb.net/vibedb` |
| `CORS_ORIGIN` | **Yes** | Allowed CORS Origins | `http://localhost:3000,https://vibe-platform-zeta.vercel.app` |
| `JWT_ACCESSTOKEN_SECRET` | **Yes** | JWT Access Token Secret Key | `super_secret_access_key` |
| `JWT_ACCESSTOKEN_EXPIRY` | Optional | Access Token Expiry | `1d` |
| `JWT_REFRESHTOKEN_SECRET` | **Yes** | JWT Refresh Token Secret Key | `super_secret_refresh_key` |
| `JWT_REFRESHTOKEN_EXPIRY` | Optional | Refresh Token Expiry | `7d` |
| `CLOUDINARY_CLOUD_NAME` | **Yes** | Cloudinary Cloud Name | `your_cloud_name` |
| `CLOUDINARY_API_KEY` | **Yes** | Cloudinary API Key | `1234567890` |
| `CLOUDINARY_API_SECRET` | **Yes** | Cloudinary API Secret | `abcdef123456` |
| `ZOHO_REGION` | Optional | Zoho OAuth Region | `com` |
| `ZOHO_REFRESH_TOKEN` | Optional | Zoho OAuth Refresh Token | `1000.xxxx.yyyy` |
| `ZOHO_CLIENT_ID` | Optional | Zoho OAuth Client ID | `1000.zzzz` |
| `ZOHO_CLIENT_SECRET` | Optional | Zoho OAuth Client Secret | `aaaaa...` |
| `ZOHO_ACCOUNT_ID` | Optional | Zoho Account ID | `123456` |
| `ZOHO_FROM_EMAIL` | Optional | Zoho Sender Email | `contact@curioteach.com` |
| `SMTP_USER` | Optional | Brevo SMTP Login Email | `welcome@curioteach.com` |
| `SMTP_KEY` | Optional | Brevo SMTP Key | `xsmtpsib-...` |

---

### 2. EC2 Server Prerequisites

On your EC2 instance, make sure Node.js (v18+) and PM2 are installed:

```bash
# Update package list and install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Ensure deployment directory exists and has correct permissions
sudo mkdir -p /var/www/vibe-server
sudo chown -R $USER:$USER /var/www/vibe-server
```

---

### 3. Nginx Reverse Proxy Setup (Optional but Recommended)

To expose the application on HTTP (Port 80) or HTTPS (Port 443):

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

