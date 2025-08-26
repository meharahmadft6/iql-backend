const nodemailer = require("nodemailer");
const pug = require("pug");
const { htmlToText } = require("html-to-text");
const path = require("path");

class Email {
  constructor(user, resetUrl = null, isApproved = null) {
    this.to = user.email;
    this.firstName = user.name.split(" ")[0];
    this.resetUrl = resetUrl;
    this.isApproved = isApproved;
    this.from = `Infinity Quotient Learning <${process.env.EMAIL_FROM}>`;
  }

  // Create different transports for different environments
  newTransport() {
    // Development configuration
    if (process.env.NODE_ENV === "development") {
      return nodemailer.createTransport({
        host: process.env.EMAIL_HOST_DEV,
        port: process.env.EMAIL_PORT_DEV,
        auth: {
          user: "api", // Fixed username for Mailtrap API
          pass: process.env.EMAIL_PASSWORD_DEV, // Your API token
        },
        secure: false, // true for 465, false for other ports
        tls: {
          rejectUnauthorized: false, // For testing only, remove in production
        },
      });
    }

    // Production configuration (Amazon SES)
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_PORT === "465", // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  // Render email template
  async renderTemplate(template, subject) {
    const templatePath = path.join(
      __dirname,
      `../views/emails/${template}.pug`
    );

    return pug.renderFile(templatePath, {
      firstName: this.firstName,
      resetUrl: this.resetUrl,
      isApproved: this.isApproved,
      subject,
      currentYear: new Date().getFullYear(),
    });
  }

  // Send email with template
  async send(template, subject) {
    try {
      // 1) Render HTML
      const html = await this.renderTemplate(template, subject);

      // 2) Create mail options
      const mailOptions = {
        from: this.from,
        to: this.to,
        subject,
        html,
        text: htmlToText(html),
      };

      // 3) Create transport
      const transporter = this.newTransport();

      // 4) Verify connection first
      await transporter.verify();

      // 5) Send email
      const info = await transporter.sendMail(mailOptions);

      return info;
    } catch (error) {
      console.error("Full email sending error:", {
        error: error.message,
        stack: error.stack,
        template,
        subject,
        to: this.to,
        from: this.from,
        isApproved: this.isApproved,
      });
      throw new Error(`Email could not be sent: ${error.message}`);
    }
  }

  // Specific email methods
  async sendPasswordReset() {
    await this.send(
      "passwordReset",
      "Your password reset link (expires in 10 minutes)"
    );
  }

  async sendPasswordChangeConfirmation() {
    await this.send(
      "passwordChanged",
      "Your password has been successfully changed"
    );
  }

  // New method for teacher approval status
  async sendTeacherApprovalStatus() {
    const subject = this.isApproved
      ? " Your Teacher Application Has Been Approved!"
      : "Update on Your Teacher Application";

    await this.send("approval", subject);
  }
  async sendWelcome() {
    await this.send(
      "welcome",
      "Welcome to Infinity Quotient Learning - Verify Your Email"
    );
  }
}

module.exports = Email;
