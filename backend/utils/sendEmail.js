const nodemailer = require("nodemailer");

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    if (
      !process.env.EMAIL_HOST ||
      !process.env.EMAIL_USER ||
      !process.env.EMAIL_PASS
    ) {
      console.log("Email skipped: email environment variables are missing.");
      return {
        sent: false,
        reason: "Email environment variables missing"
      };
    }

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT || 465),
      secure: Number(process.env.EMAIL_PORT || 465) === 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject,
      text,
      html
    });

    return {
      sent: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.log("Email send failed:", error.message);

    return {
      sent: false,
      reason: error.message
    };
  }
};

module.exports = sendEmail;
