/**
 * =============================================================================
 * EMAIL SERVICE CONFIGURATION
 * =============================================================================
 *
 * Nodemailer configuration for sending emails to customers.
 * Uses Gmail SMTP with App Password for authentication.
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to your Google Account settings
 * 2. Enable 2-Factor Authentication
 * 3. Go to Security > App passwords
 * 4. Generate a new app password for "Mail"
 * 5. Add the credentials to your .env file:
 *    - EMAIL_USER=your-gmail@gmail.com
 *    - EMAIL_PASSWORD=your-app-password (16 characters, no spaces)
 *
 * =============================================================================
 */

import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// =============================================================================
// TRANSPORTER CONFIGURATION
// =============================================================================

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Verify connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.log("⚠️ Email service not configured:", error.message);
    console.log(
      "📧 To enable email notifications, add EMAIL_USER and EMAIL_PASSWORD to .env",
    );
  } else {
    console.log("✅ Email service ready");
  }
});

// =============================================================================
// EMAIL TEMPLATES
// =============================================================================

/**
 * Generate HTML email template for inquiry response
 */
const generateInquiryResponseEmail = (
  customerName,
  inquirySubject,
  response,
  branchName,
) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lilycrest Dormitory - Response to Your Inquiry</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Lilycrest Dormitory</h1>
              <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0; font-size: 14px;">${branchName} Branch</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #333333; margin: 0 0 20px; font-size: 22px;">Hello ${customerName}!</h2>
              
              <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Thank you for reaching out to us. We have reviewed your inquiry and here is our response:
              </p>
              
              <!-- Original Inquiry -->
              <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <p style="color: #888888; font-size: 12px; margin: 0 0 5px; text-transform: uppercase; letter-spacing: 1px;">Your Inquiry</p>
                <p style="color: #333333; font-size: 14px; margin: 0; font-style: italic;">${inquirySubject}</p>
              </div>
              
              <!-- Response -->
              <div style="background-color: #e8f5e9; border-left: 4px solid #4caf50; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <p style="color: #888888; font-size: 12px; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 1px;">Our Response</p>
                <p style="color: #333333; font-size: 15px; margin: 0; line-height: 1.7; white-space: pre-wrap;">${response}</p>
              </div>
              
              <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 20px 0 0;">
                If you have any further questions, feel free to reply to this email or submit another inquiry through our website.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 25px 40px; text-align: center; border-top: 1px solid #eeeeee;">
              <p style="color: #888888; font-size: 14px; margin: 0 0 10px;">
                Best regards,<br>
                <strong style="color: #667eea;">Lilycrest Dormitory Team</strong>
              </p>
              <p style="color: #aaaaaa; font-size: 12px; margin: 15px 0 0;">
                This is an automated response. Please do not reply directly to this email.
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
};

// =============================================================================
// EMAIL SENDING FUNCTIONS
// =============================================================================

/**
 * Send inquiry response email to customer
 *
 * @param {Object} options - Email options
 * @param {string} options.to - Customer's email address
 * @param {string} options.customerName - Customer's name
 * @param {string} options.inquirySubject - Original inquiry subject/message
 * @param {string} options.response - Admin's response message
 * @param {string} options.branchName - Branch name (Gil Puyat or Guadalupe)
 * @returns {Promise<Object>} - Email send result
 */
export const sendInquiryResponseEmail = async ({
  to,
  customerName,
  inquirySubject,
  response,
  branchName = "Lilycrest",
}) => {
  // Check if email is configured
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.log(
      "⚠️ Email not sent - EMAIL_USER and EMAIL_PASSWORD not configured",
    );
    return { success: false, message: "Email service not configured" };
  }

  const mailOptions = {
    from: {
      name: "Lilycrest Dormitory",
      address: process.env.EMAIL_USER,
    },
    to: to,
    subject: `Re: Your Inquiry - Lilycrest Dormitory ${branchName}`,
    html: generateInquiryResponseEmail(
      customerName,
      inquirySubject,
      response,
      branchName,
    ),
    text: `
Hello ${customerName}!

Thank you for reaching out to us. We have reviewed your inquiry and here is our response:

Your Inquiry:
${inquirySubject}

Our Response:
${response}

If you have any further questions, feel free to reply to this email or submit another inquiry through our website.

Best regards,
Lilycrest Dormitory Team
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error.message);
    return { success: false, error: error.message };
  }
};

export default transporter;
