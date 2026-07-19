import "dotenv/config";
import express from "express";
import morgan from "morgan";
const app = express();
app.use(morgan("dev"));
import sendEmail from "./services/email.js ";
import channel from "./config/mq.js";

app.get("/", (req, res) => {
  res.send("Hello from Notification Servic !");
});

app.get("/_status/healthz", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/_status/readyz", (req, res) => {
  res.status(200).json({ status: "ready" });
});

channel.consume("auth_notification_queue", async (msg) => {
  if (msg !== null) {
    const messageContent = msg.content.toString();
    console.log("Received message from queue:", messageContent);

    try {
      const { userId, timestamp, email } = JSON.parse(messageContent);

      const subject = "New Login Notification";
      const text = `
Welcome to Capstone!

Thank you for joining us.

If you have any questions, simply reply to this email.

Regards,
Capstone Team
  `;
      const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Welcome</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;">
          <tr>
            <td style="background:#2563eb;padding:20px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;">Capstone</h1>
            </td>
          </tr>

          <tr>
            <td style="padding:40px;color:#333333;">
              <h2 style="margin-top:0;">Hello 👋</h2>

              <p style="font-size:16px;line-height:24px;">
                Thank you for joining <strong>Capstone</strong>.
                We're excited to have you with us.
              </p>

              <p style="font-size:16px;line-height:24px;">
                Click the button below to get started.
              </p>

              <p style="text-align:center;margin:30px 0;">
                <a href="https://sujalpanchal.online"
                  style="background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:6px;display:inline-block;">
                  Get Started
                </a>
              </p>

              <p style="font-size:15px;line-height:24px;">
                If you didn't request this email, you can safely ignore it.
              </p>

              <hr style="border:none;border-top:1px solid #eeeeee;margin:30px 0;">

              <p style="font-size:13px;color:#666666;text-align:center;">
                © 2026 Capstone. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

      await sendEmail(email, subject, text, html);

      channel.ack(msg);
    } catch (error) {
      console.error("Error processing message:", error);
      // Optionally, you can choose to nack the message to requeue it
      // channel.nack(msg);
    }
  } else {
    console.log("Received null message");
  }
});
export default app;
