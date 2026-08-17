import dotenv from "dotenv";
dotenv.config();
import { User } from "../models/Users.js";
import axios from "axios";

async function getZohoAccessToken() {
  const region = process.env.ZOHO_REGION || "com";
  const tokenUrl = `https://accounts.zoho.${region}/oauth/v2/token`;

  const params = new URLSearchParams({
    refresh_token: process.env.ZOHO_REFRESH_TOKEN,
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    grant_type: "refresh_token",
  });

  const res = await axios.post(tokenUrl, params);
  return res.data.access_token;
}


/**
 * Send email via Zoho with different templates
 * @param {string|string[]} recipients - single email OR array of emails
 * @param {string} type - 'otp' | 'task' | 'comment'
 * @param {object} data - dynamic data
 * @param {boolean} isBulk - if true, send one mail with BCC
 */
export async function sendZohoEmail(recipients, type, data, isBulk = false) {
  const region = process.env.ZOHO_REGION || "com";
  const accountId = process.env.ZOHO_ACCOUNT_ID;
  const fromEmail = process.env.ZOHO_FROM_EMAIL;
  const support_email = "hello@curioteach.com";

  const accessToken = await getZohoAccessToken();
  const url = `https://mail.zoho.${region}/api/accounts/${accountId}/messages`;

  let subject = "";
  let htmlContent = "";

  // For personalization: only works in single mode
  let name = "User";
  if (!isBulk && typeof recipients === "string") {
    const user = await User.findOne({ email: recipients });
    if (user) {
      name = user.name || "User";
    }
  }
  

  switch (type) {
    case "otp":
      subject = "Your Email Verification Code";
      htmlContent = getOtpTemplate(name, data.otpCode, support_email);
      break;
    case "reset":
      subject = "Your Password Reset Code";
      htmlContent = getResetTemplate(name, data.otpCode, support_email);
      break;

    case "task":
      subject = "New Task Added in TaskMania";
      htmlContent = getTaskTemplate(name, data.title, data.description, data.link);
      break;

    case "comment":
      subject = "New Comment on Your Community Post";
      htmlContent = getCommentTemplate(name, data.comment, data.link);
      break;

    case "submission":
      subject = "New Submission on Your Given Task";
      htmlContent = getSubmissionTemplate(name, data.taskTitle, data.link);
      break;

    case "review":
      subject= "Your Submission has been reviwed";
      htmlContent = getEvaluationTemplate(name,data.taskTitle, data.result, data.feedback, data.reviewer, data.reviewLink);

    case "hired": // 🔹 Add this
      subject = "🎉 Congratulations, You’re Hired!";
      htmlContent = getHiredTemplate(
        name,
        data.roleOffered,
        data.packageRange,
        data.companyName,
        data.skillsRequired,
        data.hrContact,
        data.detailsLink
      );
      break;

    case "instituteWelcome":
      subject = `Your Institute Account for Curio.AI is Ready!`;
      htmlContent = getNewInstituteWelcomeTemplate(
        data.instituteName,
        data.loginEmail,
        data.activationKey,
        data.loginLink
      );
      break;


    

    default:
      throw new Error("Invalid email type");
  }

  // Build payload
  const emailData = {
    fromAddress: fromEmail,
    subject,
    content: htmlContent,
    mailFormat: "html",
    askReceipt: "no",
  };

  if (isBulk && Array.isArray(recipients)) {
    // Bulk: send to self, add all in BCC
    emailData.toAddress = fromEmail;
    emailData.bccAddress = recipients.join(",");
  } else {
    // Single mode
    emailData.toAddress = recipients;
  }

  try{

    const res = await axios.post(url, emailData, {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        "Content-Type": "application/json",
      },
    });


    return res.data;

  }catch(err){

    throw err;

  }


}

/** Utility: Add hidden unique marker */
function uniqueMarker() {
  return `<span style="display:none;font-size:0;line-height:0;">${Date.now()}-${Math.random().toString(36).substring(2,8)}</span>`;
}

 // Add this new function to your zohoMail.js file

/**
 * Generates the HTML email for a new institute's credentials.
 * @param {string} instituteName - The name of the institute.
 * @param {string} loginEmail - The institute's login email.
 * @param {string} activationKey - The institute's unique activation key (password).
 * @param {string} loginLink - The URL to the institute login portal.
 * @returns {string} The complete HTML for the email.
 */
function getNewInstituteWelcomeTemplate(instituteName, loginEmail, activationKey, loginLink) {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Your Institute Account is Ready</title>
  </head>
  <body style="margin:0; padding:0; background:#f9fafb; font-family:Arial,sans-serif;">
    <div style="width:100%;padding:20px 0;display:flex;align-items:center;justify-content:center;background:#f9fafb;">
      <div style="max-width:600px;width:100%;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.1);border:1px solid #dbeafe;">
        <div style="background:#2563eb;font-weight:bold;text-align:center;color:#fff;padding:15px 20px;font-size:18px;">
          Welcome to the Curio.AI Platform
        </div>
        <div style="padding:40px 30px;text-align:center;background:#eff6ff;">
          <img src="https://www.curioteach.com/email-logo.png" alt="Logo" style="width:64px;margin-bottom:20px;"/>
          <p style="font-size:16px;color:#1e3a8a;margin:0 0 16px;">Hello <strong>${instituteName}</strong>,</p>
          <p style="font-size:16px;color:#1e40af;margin:0 0 24px;line-height:1.5;">
            Your institute account has been successfully created. You can now log in to the institute portal using the following credentials.
          </p>
          <div style="background:#f3f4f6;border:1px solid #d1d5db;border-radius:10px;padding:20px;margin-bottom:24px;text-align:left;">
            <p style="margin:0 0 10px;font-size:14px;color:#374151;"><strong>Login Email:</strong> ${loginEmail}</p>
            <p style="margin:0;font-size:14px;color:#374151;"><strong>Activation Key (Password):</strong> 
              <span style="font-weight:bold;font-family:monospace;background:#e5e7eb;padding:2px 6px;border-radius:4px;">${activationKey}</span>
            </p>
          </div>
          <a href="${loginLink}" style="display:inline-block;background:#2563eb;color:white;padding:12px 22px;font-weight:bold;border-radius:8px;text-decoration:none;font-size:16px;">Go to Institute Portal</a>
        </div>
        <div style="background:#e6f0fa;color:#555;padding:12px 20px;font-size:12px;text-align:center;">
          © ${new Date().getFullYear()} Curio.AI
        </div>
        ${uniqueMarker()}
      </div>
    </div>
  </body>
  </html>
  `;
}

  // html template for new task submission
  function getSubmissionTemplate(name, taskTitle, submissionLink) {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>New Submission Received</title>
  </head>
  <body style="margin:0; padding:0; background:#f9fafb; font-family:Arial,sans-serif;">
    <div style="width:100%;padding:20px 0;display:flex;align-items:center;justify-content:center;background:#f9fafb;">
      <div style="max-width:600px;width:100%;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.1);border:1px solid #dbeafe;">
        
        <!-- Header -->
        <div style="background:#2563eb;font-weight:bold;text-align:center;color:#fff;padding:15px 20px;font-size:18px;">
          New Submission in TaskMania
        </div>
        
        <!-- Body -->
        <div style="padding:40px 30px;text-align:center;background:#eff6ff;">
          <img src="https://www.curioteach.com/email-logo.png" alt="Logo" style="width:64px;margin-bottom:20px;"/>
          
          <p style="font-size:16px;color:#1e3a8a;margin:0 0 16px;">Hello <strong>${name}</strong>,</p>
          
          <p style="font-size:16px;color:#1e40af;margin:0 0 24px;">A new submission has been made for the task:</p>
          
          <div style="font-size:20px;font-weight:bold;color:#2563eb;margin-bottom:12px;">${taskTitle}</div>
          
          <div style="font-size:15px;color:#1e40af;margin-bottom:24px;line-height:1.5;">
            ${"The participant has submitted their work. You can review it using the button below."}
          </div>
          
          <a href="${submissionLink}" style="display:inline-block;background:#2563eb;color:white;padding:12px 22px;font-weight:bold;border-radius:8px;text-decoration:none;font-size:16px;">View Submission</a>
        </div>
        
        <!-- Footer -->
        <div style="background:#e6f0fa;color:#555;padding:12px 20px;font-size:12px;text-align:center;">
          © ${new Date().getFullYear()} Curio.AI
        </div>
        
        ${uniqueMarker()}
      </div>
    </div>
  </body>
  </html>
  `;
}

/** HTML Template for OTP */
function getOtpTemplate(name, otpCode, support_email) {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Your OTP Code</title>
  </head>
  <body style="margin:0; padding:0; background:#ffffff; font-family:Arial,sans-serif;">
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff;">
      <div style="background:#eff6ff;border:1px solid #bfdbfe;box-shadow:0 4px 15px rgba(0,0,0,0.1);border-radius:24px;padding:40px;max-width:600px;width:100%;text-align:center;">
        
        <img src="https://www.curioteach.com/email-logo.png" alt="Curio Logo" style="width:240px;margin-bottom:24px;"/>
        
        <h1 style="font-size:24px;font-weight:bold;color:#f97316;margin-bottom:16px;">Your OTP Code</h1>
        
        <p style="font-size:18px;color:#1e3a8a;margin:0 0 16px;">Hello <strong>${name}</strong>,</p>
        
        <p style="font-size:16px;color:#1e40af;margin:0 0 24px;">Use the following one-time password (OTP) to proceed:</p>
        
        <div style="display:inline-block;background:#0f172a;color:#fff;padding:12px 16px;font-weight:bold;border-radius:8px;letter-spacing:2px;font-size:20px;margin-bottom:24px;">
          ${otpCode}
        </div>
        
        <p style="font-size:16px;color:#1e40af;margin:0 0 24px;">This code will expire in <span style="color:#ea580c;font-weight:600;">10 minutes</span>.</p>
        
        <p style="font-size:13px;color:#94a3b8;line-height:1.5;">
          If you didn’t request this, you can safely ignore this email.<br/>
          Need help? Contact us at <a href="mailto:${support_email}" style="color:#0ea5a4;text-decoration:none;">${support_email}</a>
        </p>

        <div style="margin-top:24px;font-size:12px;color:#94a3b8;text-align:center;">
          © ${new Date().getFullYear()} Curio • Building immersive learning
        </div>
        
        ${uniqueMarker()}
      </div>
    </div>
  </body>
  </html>
  `;
}

function getResetTemplate(name, otpCode, support_email) {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Password Reset Code</title>
  </head>
  <body style="margin:0; padding:0; background:#ffffff; font-family:Arial,sans-serif;">
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff;">
      <div style="background:#eff6ff;border:1px solid #bfdbfe;box-shadow:0 4px 15px rgba(0,0,0,0.1);border-radius:24px;padding:40px;max-width:600px;width:100%;text-align:center;">
        
        <img src="https://www.curioteach.com/email-logo.png" alt="Curio Logo" style="width:240px;margin-bottom:24px;"/>
        
        <h1 style="font-size:24px;font-weight:bold;color:#0ea5a4;margin-bottom:16px;">Password Reset Code</h1>
        
        <p style="font-size:18px;color:#1e3a8a;margin:0 0 16px;">Hello <strong>${name}</strong>,</p>
        
        <p style="font-size:16px;color:#1e40af;margin:0 0 24px;">Use the following code to reset your password:</p>
        
        <div style="display:inline-block;background:#0f172a;color:#fff;padding:12px 16px;font-weight:bold;border-radius:8px;letter-spacing:2px;font-size:20px;margin-bottom:24px;">
          ${otpCode}
        </div>
        
        <p style="font-size:16px;color:#1e40af;margin:0 0 24px;">This code will expire in <span style="color:#ea580c;font-weight:600;">10 minutes</span>.</p>
        
        <p style="font-size:13px;color:#94a3b8;line-height:1.5;">
          If you didn’t request a password reset, you can safely ignore this email.<br/>
          Need help? Contact us at <a href="mailto:${support_email}" style="color:#0ea5a4;text-decoration:none;">${support_email}</a>
        </p>

        <div style="margin-top:24px;font-size:12px;color:#94a3b8;text-align:center;">
          © ${new Date().getFullYear()} Curio • Building immersive learning
        </div>
        
        ${uniqueMarker()}
      </div>
    </div>
  </body>
  </html>
  `;
}

/** HTML Template for Task Notification */
function getTaskTemplate(name, title, description, link) {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>New Task Created</title>
  </head>
  <body style="margin:0; padding:0; background:#f4f8fb; font-family:Arial,sans-serif;">
    <div style="width:100%;padding:20px 0;display:flex;align-items:center;justify-content:center;background:#f4f8fb;">
      <div style="max-width:600px;width:100%;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.1);border:1px solid #bfdbfe;">
        
        <div style="background:#ff8c42;font-weight:bold;text-align:center;color:#fff;padding:15px 20px;font-size:18px;">
          New Task in TaskMania
        </div>
        
        <div style="padding:40px 30px;text-align:center;background:#eff6ff;">
          <img src="https://www.curioteach.com/email-logo.png" alt="Logo" style="width:64px;margin-bottom:20px;"/>
          
          <p style="font-size:16px;color:#1e3a8a;margin:0 0 16px;">Hello <strong>${name}</strong>,</p>
          
          <p style="font-size:16px;color:#1e40af;margin:0 0 24px;">A new task has been assigned to you in TaskMania:</p>
          
          <div style="font-size:20px;font-weight:bold;color:#f97316;margin-bottom:12px;">${title}</div>
          
          <div style="font-size:15px;color:#1e40af;margin-bottom:24px;line-height:1.4;">${description || "Check it from the button below."}</div>
          
          <a href="${link}" style="display:inline-block;background:#1e3a8a;color:white;padding:12px 20px;font-weight:bold;border-radius:8px;text-decoration:none;font-size:16px;">View Task</a>
        </div>
        
        <div style="background:#e6f0fa;color:#555;padding:12px 20px;font-size:12px;text-align:center;">
          © ${new Date().getFullYear()} Curio.AI
        </div>

        ${uniqueMarker()}
      </div>
    </div>
  </body>
  </html>
  `;
}

/** HTML Template for Comment Notification */
function getCommentTemplate(name, comment, link) {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>New Comment Notification</title>
  </head>
  <body style="margin:0; padding:0; background:#f4f8fb; font-family:Arial,sans-serif;">
    <div style="width:100%;padding:20px 0;display:flex;align-items:center;justify-content:center;background:#f4f8fb;">
      <div style="max-width:600px;width:100%;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.1);border:1px solid #bfdbfe;">
        
        <div style="background:#2196F3;font-weight:bold;text-align:center;color:white;padding:15px 20px;font-size:18px;">
          New Comment on Your Post
        </div>
        
        <div style="padding:40px 30px;text-align:center;background:#eff6ff;">
          <img src="https://www.curioteach.com/email-logo.png" alt="Logo" style="width:64px;margin-bottom:20px;"/>
          
          <p style="font-size:16px;color:#1e3a8a;margin:0 0 16px;">Hello <strong>${name}</strong>,</p>
          
          <p style="font-size:16px;color:#1e40af;margin:0 0 24px;">Someone just commented on your post:</p>
          
          <!-- Replaced blockquote -->
          <div style="margin:0 auto 24px;max-width:480px;background:#fff;border:1px solid #ddd;padding:12px 16px;font-size:15px;color:#444;line-height:1.5;text-align:left;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,0.05);">
            ${comment}
          </div>
          
          <a href="${link}" style="display:inline-block;background:#2196F3;color:white;padding:12px 20px;font-weight:bold;border-radius:8px;text-decoration:none;font-size:16px;">View Comment</a>
        </div>
        
        <div style="background:#e6f0fa;color:#555;padding:12px 20px;font-size:12px;text-align:center;">
          © ${new Date().getFullYear()} Curio.AI
        </div>

        ${uniqueMarker()}
      </div>
    </div>
  </body>
  </html>
  `;



}

function getEvaluationTemplate(name, taskTitle, result, feedback, reviewer, reviewLink) {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Task Evaluation Completed</title>
  </head>
  <body style="margin:0; padding:0; background:#f9fafb; font-family:Arial,sans-serif;">
    <div style="width:100%;padding:20px 0;display:flex;align-items:center;justify-content:center;background:#f9fafb;">
      <div style="max-width:600px;width:100%;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 15px rgba(0,0,0,0.1);border:1px solid #d1fae5;">
        
        <!-- Header -->
        <div style="background:#10b981;font-weight:bold;text-align:center;color:#fff;padding:15px 20px;font-size:18px;">
          Task Evaluation Completed
        </div>
        
        <!-- Body -->
        <div style="padding:40px 30px;text-align:center;background:#ecfdf5;">
          <img src="https://www.curioteach.com/email-logo.png" alt="Logo" style="width:64px;margin-bottom:20px;"/>
          
          <p style="font-size:16px;color:#065f46;margin:0 0 16px;">Hello <strong>${name}</strong>,</p>
          <p style="font-size:16px;color:#047857;margin:0 0 24px;">Your submission for the task has been reviewed:</p>
          
          <div style="font-size:20px;font-weight:bold;color:#10b981;margin-bottom:20px;">${taskTitle}</div>
          
          <!-- Review Summary Table -->
          <div style="background:#ffffff;border:1px solid #d1fae5;border-radius:12px;padding:20px;text-align:left;max-width:500px;margin:0 auto 24px;">
            <h3 style="margin:0 0 16px;font-size:16px;color:#065f46;border-bottom:1px solid #d1fae5;padding-bottom:8px;">
              📋 Review Summary
            </h3>
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:8px 12px;font-weight:bold;color:#065f46;width:30%;">✅ Result</td>
                <td style="padding:8px 12px;color:#065f46;">${result || "Pending"}</td>
              </tr>
              <tr>
                <td style="padding:8px 12px;font-weight:bold;color:#065f46;vertical-align:top;">💬 Feedback</td>
                <td style="padding:8px 12px;color:#065f46;line-height:1.4;">${feedback || "No additional feedback was provided."}</td>
              </tr>
              <tr>
                <td style="padding:8px 12px;font-weight:bold;color:#065f46;">👤 Reviewed By</td>
                <td style="padding:8px 12px;color:#065f46;">${reviewer || "Anonymous Reviewer"}</td>
              </tr>
            </table>
          </div>
          
          <a href="${reviewLink}" style="display:inline-block;background:#10b981;color:white;padding:12px 22px;font-weight:bold;border-radius:8px;text-decoration:none;font-size:16px;">View Detailed Evaluation</a>
        </div>
        
        <!-- Footer -->
        <div style="background:#d1fae5;color:#555;padding:12px 20px;font-size:12px;text-align:center;">
          © ${new Date().getFullYear()} Curio.AI
        </div>
        
        ${uniqueMarker()}
      </div>
    </div>
  </body>
  </html>
  `;
}

function getHiredTemplate(name, roleOffered, packageRange, companyName, skillsRequired, hrContact, detailsLink) {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Congratulations! You are Hired</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background: #f9fafb;
        font-family: Arial, sans-serif;
      }
      .container {
        width: 100%;
        padding: 20px 0;
        display: flex;
        justify-content: center;
        background: #f9fafb;
      }
      .card {
        max-width: 650px;
        width: 100%;
        background: #fff;
        border-radius: 20px;
        overflow: hidden;
        box-shadow: 0 6px 18px rgba(0,0,0,0.12);
        border: 1px solid #dbeafe;
      }
      .header {
        background: #16a34a;
        font-weight: bold;
        text-align: center;
        color: #fff;
        padding: 20px;
        font-size: 20px;
      }
      .body {
        padding: 40px 30px;
        text-align: center;
        background: #ecfdf5;
      }
      .body img {
        width: 72px;
        margin-bottom: 20px;
      }
      .details {
        background: #ffffff;
        border: 1px solid #bbf7d0;
        border-radius: 12px;
        padding: 20px;
        text-align: left;
        max-width: 520px;
        margin: 0 auto 30px;
      }
      .details h3 {
        margin: 0 0 16px;
        font-size: 16px;
        color: #065f46;
        border-bottom: 1px solid #bbf7d0;
        padding-bottom: 8px;
      }
      .details table {
        width: 100%;
        border-collapse: collapse;
      }
      .details td {
        padding: 8px 12px;
        color: #065f46;
        vertical-align: top;
      }
      .details td:first-child {
        font-weight: bold;
        width: 40%;
      }
      .button {
        display: inline-block;
        background: #16a34a;
        color: white;
        padding: 14px 28px;
        font-weight: bold;
        border-radius: 10px;
        text-decoration: none;
        font-size: 16px;
      }
      .footer {
        background: #bbf7d0;
        color: #064e3b;
        padding: 14px 20px;
        font-size: 12px;
        text-align: center;
      }
      /* Responsive adjustments */
      @media (max-width: 600px) {
        .body {
          padding: 20px 15px;
        }
        .details td {
          display: block;
          width: 100% !important;
          padding: 6px 0;
        }
        .details td:first-child {
          font-weight: bold;
          margin-top: 10px;
        }
        .button {
          display: block;
          width: 100%;
          text-align: center;
        }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="card">
        
        <!-- Header -->
        <div class="header">
          🎉 Congratulations, You’re Hired!
        </div>
        
        <!-- Body -->
        <div class="body">
          <img src="https://www.curioteach.com/email-logo.png" alt="Logo"/>
          
          <p style="font-size:18px;color:#065f46;margin:0 0 16px;">Dear <strong>${name}</strong>,</p>
          
          <p style="font-size:16px;color:#047857;margin:0 0 24px;line-height:1.5;">
            We are thrilled to inform you that you have been <strong>hired</strong> for the role of 
            <strong>${roleOffered}</strong> at <strong>${companyName}</strong>.
          </p>

          <p style="font-size:15px;color:#065f46;margin:0 0 30px;line-height:1.5;">
            The industry person from <strong>${companyName}</strong> will be contacting you soon with the next steps.
          </p>
          
          <!-- Offer Details -->
          <div class="details">
            <h3>📋 Offer Details</h3>
            <table>
              <tr>
                <td>🏢 Company</td>
                <td>${companyName}</td>
              </tr>
              <tr>
                <td>📌 Role</td>
                <td>${roleOffered}</td>
              </tr>
              <tr>
                <td>💰 Package/Perks</td>
                <td>${packageRange}</td>
              </tr>
              <tr>
                <td>🛠 Skills</td>
                <td>${skillsRequired?.length ? skillsRequired.join(", ") : "N/A"}</td>
              </tr>
            </table>
          </div>
          
          <a href="${detailsLink}" class="button">View Offer Letter</a>
        </div>
        
        <!-- Footer -->
        <div class="footer">
          © ${new Date().getFullYear()} ${companyName} Careers — Welcome to the team!
        </div>
        
        ${uniqueMarker()}
      </div>
    </div>
  </body>
  </html>
  `;
}
