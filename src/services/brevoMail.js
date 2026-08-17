import dotenv from "dotenv";
dotenv.config();
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false, // Use true if you change to port 465
  auth: {
    user: process.env.SMTP_USER, // Brevo SMTP login
    pass: process.env.SMTP_KEY, // your Brevo SMTP key from dashboard
  },
});

export const sendOnboardingEmail = async (to, name, password, classData) => {
  // IMPORTANT: Replace this with your actual login page URL
  const loginUrl = 'https://curioteach.com/login';

  const mailOptions = {
    from: `"Curio" <welcome@curioteach.com>`,
    to,
    subject: "Welcome to Curio! Your Account is Ready",
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Curio</title>
        <style>
          /* Base styles */
          body {
            margin: 0;
            padding: 0;
            background-color: #f4f7f6;
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
          }
          table {
            border-spacing: 0;
          }
          td {
            padding: 0;
          }
          img {
            border: 0;
          }
          .wrapper {
            width: 100%;
            table-layout: fixed;
            background-color: #f4f7f6;
            padding-bottom: 60px;
          }
          .main {
            background-color: #ffffff;
            margin: 0 auto;
            width: 100%;
            max-width: 600px;
            border-spacing: 0;
            font-family: Arial, sans-serif;
            color: #333333;
            border-radius: 10px;
          }
          .content {
            padding: 20px 30px;
            text-align: left;
            line-height: 1.6;
          }
          .credentials {
            background-color: #f0f5ff;
            border-left: 5px solid #0052cc;
            padding: 15px;
            margin: 20px 0;
            font-size: 16px;
          }
          .button {
            background-color: #0052cc;
            color: #ffffff;
            padding: 12px 25px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            display: inline-block;
          }
          .footer {
            text-align: center;
            font-size: 12px;
            color: #777777;
            padding-top: 20px;
          }

          /* Responsive styles for screens smaller than 600px */
          @media screen and (max-width: 600px) {
            .content {
              padding: 20px 20px !important;
            }
            .button {
              display: block !important;
              width: 100%;
              box-sizing: border-box; /* Ensures padding doesn't break 100% width */
              text-align: center;
            }
          }
        </style>
      </head>
      <body>
        <center class="wrapper">
          <table class="main" width="100%">
            <tr>
              <td style="padding: 20px 0; text-align: center;">
                <img src="http://curioteach.com/email-logo.png" alt="Curio Logo" width="150" style="max-width: 150px;">
              </td>
            </tr>

            <tr>
              <td>
                <div class="content">
                  <h2 style="color: #0052cc; margin-top: 0;">Welcome, ${name}!</h2>
                  <p>Your account has been successfully created for the <b>${classData.name}</b> classroom.</p>
                  <p>Below are your temporary login details. For your security, please change your password after logging in for the first time.</p>
                  
                  <div class="credentials">
                    <p style="margin: 5px 0;"><b>Email:</b> ${to}</p>
                    <p style="margin: 5px 0;"><b>Password:</b> ${password}</p>
                  </div>

                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="center" style="padding: 20px 0;">
                        <a href="${loginUrl}" target="_blank" class="button" style="background-color:#0052cc; color:#ffffff; padding:12px 25px; text-decoration:none; border-radius:5px; font-weight:bold; display:inline-block;">Login Now</a>
                      </td>
                    </tr>
                  </table>
                  
                  <p>If you have any questions, feel free to contact our support team.</p>
                  <p>Best Regards,<br><b>The Classroom Team</b></p>
                </div>
              </td>
            </tr>

            <tr>
              <td class="footer" style="padding: 20px 30px;">
                <p>&copy; ${new Date().getFullYear()} Curio. All rights reserved.<br>Find The Why!</p>
              </td>
            </tr>
          </table>
        </center>
      </body>
      </html>
    `,
  };


  await transporter.sendMail(mailOptions);
  console.log("✅ Email sent successfully to:", to);
};

const taskTemplate = (title, description, link) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>New Task</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif;">
  <div style="width:100%;padding:20px 0;display:flex;align-items:center;justify-content:center;background:#f9fafb;">
    <div style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);border:1px solid #e5e7eb;">
      <div style="background:#1e3a8a;color:#fff;font-weight:bold;text-align:center;padding:16px 20px;font-size:18px;">
        New Task in TaskMania
      </div>
      <div style="padding:32px 28px;text-align:center;background:#f3f4f6;">
        <img src="https://www.curioteach.com/email-logo.png" alt="Logo" style="width:64px;margin-bottom:16px;"/>
        <p style="font-size:16px;color:#1f2937;margin:0 0 16px;">A new task has been posted:</p>
        <div style="font-size:20px;font-weight:bold;color:#111827;margin-bottom:12px;">${title}</div>
        <div style="font-size:15px;color:#374151;margin-bottom:22px;line-height:1.5;">${description || ""}</div>
        <a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">View Task</a>
      </div>
      <div style="background:#e5e7eb;color:#4b5563;padding:12px 20px;font-size:12px;text-align:center;">
        © ${new Date().getFullYear()} Curio.AI
      </div>
    </div>
  </div>
</body>
</html>
`;

export const sendBrevoEmail = async (recipients, type, data, options = {}) => {
  let subject = "";
  let html = "";

  if (type === "task") {
    subject = "New Task Added in TaskMania";
    html = taskTemplate(data.title, data.description, data.link);
  } else {
    throw new Error("Unsupported email type");
  }

  const from = `"Curio" <welcome@curioteach.com>`;

  const isArray = Array.isArray(recipients);
  const useBcc = options.bcc && isArray;

  const mailOptions = useBcc
    ? {
        from,
        to: from,
        bcc: recipients.join(","),
        subject,
        html,
      }
    : {
        from,
        to: isArray ? recipients.join(",") : recipients,
        subject,
        html,
      };

  await transporter.sendMail(mailOptions);
};
