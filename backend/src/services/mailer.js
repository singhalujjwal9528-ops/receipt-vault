const nodemailer = require("nodemailer");

const port = Number(process.env.SMTP_PORT) || 587;
const isSecure = port === 465;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port,
  secure: isSecure,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send an email with text or html content
 * @param {object} options
 * @param {string} options.to
 * @param {string} options.subject
 * @param {string} [options.text]
 * @param {string} [options.html]
 */
async function sendMail({ to, subject, text, html }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("[Mailer] SMTP credentials not fully configured; skipping email dispatch.");
    return;
  }

  const fromAddress = process.env.SMTP_FROM || `"Receipt Vault" <${process.env.SMTP_USER}>`;

  return transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    text,
    html,
  });
}

/**
 * Backward-compatible helper for reminder emails
 */
async function sendReminderEmail(to, subject, text, html) {
  return sendMail({ to, subject, text, html });
}

module.exports = {
  transporter,
  sendMail,
  sendReminderEmail,
};
