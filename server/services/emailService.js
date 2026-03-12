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

const sendBillingReminderEmail = async ({ toEmail, workspaceName, reminderCode, dueDate, amountDue, currency, paymentUrl }) => {
    const labels = {
        due_in_3: 'Your invoice is due in 3 days',
        due_in_1: 'Your invoice is due tomorrow',
        due_today: 'Your invoice is due today',
        overdue_3: 'Your invoice is overdue',
        overdue_6: 'Final reminder before account restriction'
    };

    const subject = labels[reminderCode] || 'EaseMessage billing reminder';
    const formattedAmount = typeof amountDue === 'number'
        ? `${currency?.toUpperCase?.() || 'USD'} ${amountDue / 100}`
        : '';

    const mailOptions = {
        from: `"EaseMessage" <${process.env.SMTP_EMAIL}>`,
        to: toEmail,
        subject,
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
                <div style="background: linear-gradient(135deg, #0f766e, #2563eb); padding: 32px 24px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700;">EaseMessage</h1>
                    <p style="color: rgba(255,255,255,0.88); margin: 8px 0 0; font-size: 14px;">Billing reminder</p>
                </div>
                <div style="padding: 32px 24px;">
                    <p style="color: #111827; font-size: 16px; margin: 0 0 12px;">${workspaceName || 'Your workspace'} has an invoice that needs attention.</p>
                    <p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">Due date: <strong>${dueDate ? new Date(dueDate).toLocaleDateString() : 'N/A'}</strong><br />Amount: <strong>${formattedAmount}</strong></p>
                    ${paymentUrl ? `<div style="text-align: center; margin: 28px 0;"><a href="${paymentUrl}" style="display: inline-block; background: linear-gradient(135deg, #0f766e, #2563eb); color: #ffffff; text-decoration: none; padding: 14px 22px; border-radius: 12px; font-weight: 600;">Pay invoice</a></div>` : ''}
                </div>
                <div style="background: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} EaseMessage. All rights reserved.</p>
                </div>
            </div>
        `
    };

    await transporter.sendMail(mailOptions);
};

const sendEnterprisePlanRequest = async ({ adminEmail, requesterName, requesterEmail, workspaceName, companyName, note }) => {
    const mailOptions = {
        from: `"EaseMessage" <${process.env.SMTP_EMAIL}>`,
        to: adminEmail,
        subject: `Enterprise plan request from ${workspaceName || requesterName || 'EaseMessage workspace'}`,
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
                <div style="background: linear-gradient(135deg, #0f766e, #2563eb); padding: 32px 24px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700;">EaseMessage</h1>
                    <p style="color: rgba(255,255,255,0.88); margin: 8px 0 0; font-size: 14px;">Enterprise plan request</p>
                </div>
                <div style="padding: 32px 24px; color: #111827;">
                    <p style="margin: 0 0 16px; font-size: 15px;">A workspace has requested the Enterprise plan.</p>
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <tr><td style="padding: 8px 0; color: #6b7280;">Requester</td><td style="padding: 8px 0; font-weight: 600;">${requesterName || 'Unknown user'}</td></tr>
                        <tr><td style="padding: 8px 0; color: #6b7280;">Email</td><td style="padding: 8px 0; font-weight: 600;">${requesterEmail || 'Not available'}</td></tr>
                        <tr><td style="padding: 8px 0; color: #6b7280;">Workspace</td><td style="padding: 8px 0; font-weight: 600;">${workspaceName || 'Not available'}</td></tr>
                        <tr><td style="padding: 8px 0; color: #6b7280;">Company</td><td style="padding: 8px 0; font-weight: 600;">${companyName || 'Not provided'}</td></tr>
                    </table>
                    ${note ? `<div style="margin-top: 20px; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; background: #f9fafb;"><p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">Requester note</p><p style="margin: 0; white-space: pre-wrap; font-size: 14px;">${note}</p></div>` : ''}
                </div>
                <div style="background: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} EaseMessage. All rights reserved.</p>
                </div>
            </div>
        `
    };

    await transporter.sendMail(mailOptions);
};

module.exports = { sendOTP, sendWorkspaceInvite, sendBillingReminderEmail, sendEnterprisePlanRequest };
