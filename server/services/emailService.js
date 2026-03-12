const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD
    }
});

const sendOTP = async (toEmail, otp, type = 'verify') => {
    const isReset = type === 'reset';
    const subject = isReset ? 'Reset your EaseMessage password' : 'Verify your EaseMessage account';
    const title = isReset ? 'Password Reset' : 'Email Verification';
    const message = isReset
        ? 'Your password reset code is:'
        : 'Your verification code is:';

    const mailOptions = {
        from: `"EaseMessage" <${process.env.SMTP_EMAIL}>`,
        to: toEmail,
        subject: subject,
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
                <div style="background: linear-gradient(135deg, #4F46E5, #7C3AED); padding: 32px 24px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">EaseMessage</h1>
                    <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">${title}</p>
                </div>
                <div style="padding: 32px 24px; text-align: center;">
                    <p style="color: #374151; font-size: 16px; margin: 0 0 8px;">${message}</p>
                    <div style="background: #F3F4F6; border-radius: 12px; padding: 20px; margin: 16px 0;">
                        <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #4F46E5;">${otp}</span>
                    </div>
                    <p style="color: #6B7280; font-size: 14px; margin: 16px 0 0;">This code expires in <strong>10 minutes</strong>.</p>
                    <p style="color: #6B7280; font-size: 13px; margin: 8px 0 0;">If you didn't request this, please ignore this email.</p>
                </div>
                <div style="background: #F9FAFB; padding: 16px 24px; text-align: center; border-top: 1px solid #E5E7EB;">
                    <p style="color: #9CA3AF; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} EaseMessage. All rights reserved.</p>
                </div>
            </div>
        `
    };

    await transporter.sendMail(mailOptions);
};

const sendWorkspaceInvite = async ({ toEmail, inviterName, workspaceName, acceptUrl }) => {
    const mailOptions = {
        from: `"EaseMessage" <${process.env.SMTP_EMAIL}>`,
        to: toEmail,
        subject: `Join ${workspaceName} on EaseMessage`,
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
                <div style="background: linear-gradient(135deg, #0f766e, #2563eb); padding: 32px 24px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700;">EaseMessage</h1>
                    <p style="color: rgba(255,255,255,0.88); margin: 8px 0 0; font-size: 14px;">Workspace invitation</p>
                </div>
                <div style="padding: 32px 24px;">
                    <p style="color: #111827; font-size: 16px; margin: 0 0 12px;">${inviterName} invited you to join <strong>${workspaceName}</strong> on EaseMessage.</p>
                    <p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">Accept the invitation to collaborate inside the workspace, manage WhatsApp campaigns, and access shared settings.</p>
                    <div style="text-align: center; margin: 28px 0;">
                        <a href="${acceptUrl}" style="display: inline-block; background: linear-gradient(135deg, #0f766e, #2563eb); color: #ffffff; text-decoration: none; padding: 14px 22px; border-radius: 12px; font-weight: 600;">Accept invitation</a>
                    </div>
                    <p style="color: #6b7280; font-size: 13px; line-height: 1.6; margin: 0;">If the button does not work, open this link:</p>
                    <p style="word-break: break-all; color: #2563eb; font-size: 13px; margin: 10px 0 0;">${acceptUrl}</p>
                </div>
                <div style="background: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} EaseMessage. All rights reserved.</p>
                </div>
            </div>
        `
    };

    await transporter.sendMail(mailOptions);
};

module.exports = { sendOTP, sendWorkspaceInvite };
