import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("EMAIL_PASSWORD length:", process.env.EMAIL_PASSWORD?.length);

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

console.log("Verifying email connection...");

transporter.verify((error, success) => {
  if (error) {
    console.log("❌ Email verification failed:", error.message);
  } else {
    console.log("✅ Email service ready! Sending test email...");

    // Send a test email
    transporter.sendMail(
      {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER, // Send to yourself for testing
        subject: "Test Email from Lilycrest",
        text: "This is a test email to verify email configuration works!",
        html: "<h1>Test Email</h1><p>This is a test email to verify email configuration works!</p>",
      },
      (err, info) => {
        if (err) {
          console.log("❌ Failed to send test email:", err.message);
        } else {
          console.log("✅ Test email sent successfully!");
          console.log("Message ID:", info.messageId);
        }
        process.exit(0);
      },
    );
  }
});
