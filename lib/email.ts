import nodemailer from "nodemailer";

const EMAIL_USER = process.env.EMAIL_USER || process.env.SMTP_USER || "baldaniyaneev81@gmail.com";
const EMAIL_PASS = process.env.EMAIL_PASS || process.env.SMTP_PASS || "";
const rawAppUrl = process.env.NEXT_PUBLIC_APP_URL || "https://cus-doc.vercel.app";
const APP_URL = rawAppUrl.replace(/\/$/, "");

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

// Direct Nodemailer Gmail Service Transporter — reused across sends (pooled
// connections) instead of doing a fresh SMTP handshake + login every time,
// which was the main source of per-send latency.
declare global {
  // eslint-disable-next-line no-var
  var mailTransporter: nodemailer.Transporter | undefined;
}

export function getTransporter() {
  if (global.mailTransporter) {
    return global.mailTransporter;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
  });

  global.mailTransporter = transporter;
  return transporter;
}

interface SendCandidateEmailParams {
  senderEmail: string;
  recipientEmail: string;
  recipientName?: string;
  docName: string;
  docId: string;
  subject?: string;
  message?: string;
  baseUrl?: string;
}

// 1. Send E-Signature Link Email to Candidate via Nodemailer Gmail
export async function sendCandidateAgreementEmail({
  senderEmail,
  recipientEmail,
  recipientName,
  docName,
  docId,
  subject,
  message,
  baseUrl,
}: SendCandidateEmailParams) {
  if (!/^[a-fA-F0-9]{24}$/.test(docId)) {
    return { success: false, message: "Cannot email an invalid document link" };
  }

  const domainBase = APP_URL.replace(/\/$/, "");
  const publicBase = (baseUrl || APP_URL).replace(/\/$/, "");
  const signingUrl = `${domainBase}/sign/${docId}?candidate=${encodeURIComponent(recipientEmail)}`;
  const trackedClickUrl = `${domainBase}/api/documents/track/${docId}?event=click&candidate=${encodeURIComponent(recipientEmail)}`;
  const openPixelUrl = `${domainBase}/api/documents/track/${docId}?event=open`;
  const publicPixelUrl =
    publicBase && publicBase !== domainBase
      ? `${publicBase}/api/documents/track/${docId}?event=open`
      : "";
  const mailSubject = subject || `Signature Requested: ${docName}`;

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
      <div style="padding: 28px 32px; border-bottom: 1px solid #e5e7eb;">
        <p style="margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.02em; color: #0f172a;">CUS-DOC</p>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">Signature request</p>
      </div>

      <div style="padding: 32px;">
        <p style="font-size: 14px; color: #0f172a; margin: 0 0 16px 0;">
          Hello ${recipientName || "there"},
        </p>
        <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 20px 0;">
          <strong style="color: #0f172a;">${senderEmail}</strong> has requested your signature on the following document:
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 0 0 24px 0;">
          <p style="margin: 0; font-size: 14px; font-weight: 600; color: #0f172a;">${docName}</p>
          ${message ? `<p style="margin: 8px 0 0 0; font-size: 13px; color: #64748b;">"${message}"</p>` : ""}
        </div>

        <div style="text-align: center; margin: 0 0 24px 0;">
          <a href="${trackedClickUrl}" style="background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 600; display: inline-block;">
            Review &amp; sign document
          </a>
        </div>

        <p style="font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.6; margin: 0;">
          Or copy this link into your browser:<br/>
          <a href="${trackedClickUrl}" style="color: #2563eb; word-break: break-all;">${signingUrl}</a>
        </p>
      </div>

      <div style="border-top: 1px solid #e5e7eb; padding: 20px 32px; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #94a3b8;">Sent via CUS-DOC · 256-bit encrypted</p>
        <img src="${openPixelUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;outline:none;" />
        ${publicPixelUrl ? `<img src="${publicPixelUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;outline:none;" />` : ""}
      </div>
    </div>
  `;

  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: `CUS-DOC Platform <${EMAIL_USER || senderEmail}>`,
      to: recipientEmail,
      replyTo: senderEmail,
      subject: mailSubject,
      html: htmlContent,
    });
    console.log(`[Nodemailer] Agreement link email sent to candidate: ${recipientEmail} (Msg ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId, signingUrl };
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.warn(`[Nodemailer] Email delivery failed:`, message);
    return { success: false, message, signingUrl };
  }
}

export async function sendCandidateReminderEmail({
  senderEmail,
  recipientEmail,
  recipientName,
  docName,
  docId,
}: {
  senderEmail: string;
  recipientEmail: string;
  recipientName?: string;
  docName: string;
  docId: string;
}) {
  const signingUrl = `${APP_URL}/api/documents/track/${docId}?event=click&candidate=${encodeURIComponent(recipientEmail)}`;
  const openPixelUrl = `${APP_URL}/api/documents/track/${docId}?event=open`;
  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">
      <div style="padding:24px 30px; background:#f0f9ff; border-bottom:1px solid #bae6fd;">
        <p style="margin:0; color:#0284c7; font-size:18px; font-weight:800;">CUS-DOC Reminder</p>
      </div>
      <div style="padding:30px;">
        <p style="margin:0 0 16px; color:#0f172a; font-size:14px;">Hello ${recipientName || "there"},</p>
        <p style="margin:0 0 20px; color:#475569; font-size:14px; line-height:1.6;">
          This is a reminder from <strong style="color:#0f172a;">${senderEmail}</strong>. Your document is still waiting to be reviewed and completed.
        </p>
        <div style="padding:14px 16px; margin-bottom:24px; background:#f8fafc; border-radius:8px; color:#0f172a; font-size:14px; font-weight:700;">
          ${docName}
        </div>
        <div style="text-align:center;">
          <a href="${signingUrl}" style="display:inline-block; padding:12px 26px; color:#ffffff; background:#059669; border-radius:8px; text-decoration:none; font-size:14px; font-weight:700;">
            Review &amp; complete document
          </a>
        </div>
        <img src="${openPixelUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />
      </div>
    </div>
  `;

  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: `CUS-DOC Platform <${EMAIL_USER || senderEmail}>`,
      to: recipientEmail,
      replyTo: senderEmail,
      subject: `Reminder: Please complete ${docName}`,
      html: htmlContent,
    });
    return { success: true, messageId: info.messageId };
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.warn("[Nodemailer] Reminder delivery failed:", message);
    return { success: false, message };
  }
}

// 3. Send Completed Agreement Email to BOTH Candidate & Logged-in Recruiter Gmail
export async function sendCompletedAgreementEmail({
  senderEmail,
  recipientEmail,
  recipientName,
  docName,
  docId,
}: {
  senderEmail: string;
  recipientEmail: string;
  recipientName?: string;
  docName: string;
  docId: string;
}) {
  const docUrl = `${APP_URL}/sign/${docId}`;

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden;">
      <div style="padding: 28px 32px; border-bottom: 1px solid #e5e7eb;">
        <p style="margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.02em; color: #0f172a;">CUS-DOC</p>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">Document signed &amp; completed</p>
      </div>

      <div style="padding: 32px;">
        <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 20px 0;">
          The document <strong style="color: #0f172a;">"${docName}"</strong> has been reviewed and signed by <strong style="color: #0f172a;">${recipientName || recipientEmail}</strong>. It is now fully executed.
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 0 0 24px 0;">
          <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">Copies sent to</p>
          <p style="margin: 0; font-size: 13px; color: #334155; line-height: 1.7;">
            ${senderEmail}<br/>
            ${recipientEmail}
          </p>
        </div>

        <div style="text-align: center;">
          <a href="${docUrl}" style="background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 600; display: inline-block;">
            View signed document
          </a>
        </div>
      </div>

      <div style="border-top: 1px solid #e5e7eb; padding: 20px 32px; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #94a3b8;">Sent via CUS-DOC · 256-bit encrypted</p>
      </div>
    </div>
  `;

  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: `CUS-DOC Platform <${EMAIL_USER || senderEmail}>`,
      to: [recipientEmail, senderEmail],
      subject: `Completed & signed: ${docName}`,
      html: htmlContent,
    });
    console.log(`[Nodemailer] Completed agreement email sent to both ${recipientEmail} and ${senderEmail}`);
    return { success: true, messageId: info.messageId };
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.warn(`[Nodemailer] Completed email delivery failed:`, message);
    return { success: false, message };
  }
}
