"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
// Create a test account dynamically if credentials are not provided
let transporter;
const initTransporter = async () => {
    if (transporter)
        return transporter;
    try {
        const user = process.env.GMAIL_USER;
        const pass = process.env.GMAIL_APP_PASSWORD;
        if (!user || !pass) {
            console.warn('⚠️ GMAIL_USER or GMAIL_APP_PASSWORD not found in environment variables. Email service disabled.');
            return null;
        }
        transporter = nodemailer_1.default.createTransport({
            service: 'gmail',
            auth: {
                user,
                pass,
            },
        });
        console.log(`📧 Gmail Service initialized for: ${user}`);
    }
    catch (error) {
        console.error('Failed to initialize Gmail:', error);
    }
    return transporter;
};
const sendEmail = async (options) => {
    const t = await initTransporter();
    if (!t) {
        console.warn('⚠️ Transporter not initialized. Mocking email send to:', options.to);
        return;
    }
    try {
        const fromEmail = process.env.GMAIL_USER || 'no-reply@clinic.example.com';
        const info = await t.sendMail({
            from: `"Clinic Admin" <${fromEmail}>`,
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html,
            attachments: options.attachments,
        });
        console.log(`✅ Message sent: ${info.messageId}`);
        // Preview only available when sending through an Ethereal account
        console.log(`👀 Preview URL: ${nodemailer_1.default.getTestMessageUrl(info)}`);
        return info;
    }
    catch (error) {
        console.error('Failed to send email:', error);
    }
};
exports.sendEmail = sendEmail;
//# sourceMappingURL=email.js.map