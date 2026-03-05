import { access } from "node:fs/promises";
import path from "node:path";

import nodemailer, { type Transporter } from "nodemailer";
import type Mail from "nodemailer/lib/mailer";

import { EMAIL_CONFIG } from "../config/email.constants";
import { env } from "../config/env";
import { LOG_CONTEXT } from "../config/log.constants";
import { logger } from "./logger";
import { maskEmail } from "./log.utils";

export interface SendOtpInput {
  email: string;
  otp: string;
  ttlMinutes: number;
}

interface OtpTemplateInput {
  email: string;
  otp: string;
  ttlMinutes: number;
  logoCid: string;
}

const smtpTransporter: Transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS
  }
});

const otpBoxStyle = [
  "display:inline-block",
  "min-width:42px",
  "padding:10px 12px",
  "margin:0 4px",
  "border-radius:10px",
  "font-size:24px",
  "font-weight:700",
  "font-family:Segoe UI, Arial, sans-serif",
  "color:#ff9a4d",
  "background:#1d1533",
  "border:1px solid #3b2f5e"
].join(";");

const buildOtpText = ({ otp, ttlMinutes }: Pick<OtpTemplateInput, "otp" | "ttlMinutes">): string =>
  [
    `${EMAIL_CONFIG.BRAND_NAME} Sign-In OTP`,
    "",
    `Your OTP is: ${otp}`,
    `This code expires in ${ttlMinutes} minute(s).`,
    "Do not share this code with anyone."
  ].join("\n");

const buildOtpHtml = ({ email, otp, ttlMinutes, logoCid }: OtpTemplateInput): string => {
  const otpMarkup = otp
    .split("")
    .map((digit) => `<span style="${otpBoxStyle}">${digit}</span>`)
    .join("");

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${EMAIL_CONFIG.BRAND_NAME} OTP</title>
  </head>
  <body style="margin:0;padding:0;background:#090713;font-family:Segoe UI,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;background:radial-gradient(circle at top,#1a1230 0%,#090713 55%);">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#0f0b1f;border:1px solid #2a2045;border-radius:20px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 20px;text-align:center;background:linear-gradient(180deg,#15102a 0%,#0f0b1f 100%);">
                <img src="cid:${logoCid}" alt="${EMAIL_CONFIG.BRAND_NAME} logo" style="max-width:260px;width:100%;height:auto;display:block;margin:0 auto;" />
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 0;color:#f4efff;text-align:center;">
                <h1 style="margin:0;font-size:24px;line-height:1.3;">Your one-time passcode</h1>
                <p style="margin:10px 0 0;color:#c8bddf;font-size:14px;">Use this OTP to continue signing in to ${EMAIL_CONFIG.BRAND_NAME}.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 20px 10px;text-align:center;">
                ${otpMarkup}
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 8px;text-align:center;color:#ffce9e;font-size:14px;">
                Expires in <strong>${ttlMinutes} minute(s)</strong>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 24px;text-align:center;color:#9d91b8;font-size:13px;line-height:1.6;">
                Requested for: ${email}<br />
                If you did not request this OTP, you can safely ignore this email.
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 24px;text-align:center;background:#0b0916;border-top:1px solid #241c3a;color:#7f7598;font-size:12px;line-height:1.6;">
                Need help? Contact ${EMAIL_CONFIG.SUPPORT_EMAIL}
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

const resolveLogoAttachment = async (): Promise<Mail.Attachment[]> => {
  const logoAbsolutePath = path.resolve(process.cwd(), EMAIL_CONFIG.LOGO_RELATIVE_PATH);

  try {
    await access(logoAbsolutePath);

    return [
      {
        filename: path.basename(logoAbsolutePath),
        path: logoAbsolutePath,
        cid: EMAIL_CONFIG.LOGO_CID
      }
    ];
  } catch {
    logger.warn("OTP email logo file not found", {
      context: LOG_CONTEXT.EMAIL,
      logoPath: logoAbsolutePath
    });
    return [];
  }
};

export const sendOtpEmail = async ({ email, otp, ttlMinutes }: SendOtpInput): Promise<void> => {
  const attachments = await resolveLogoAttachment();

  const sentMessage = await smtpTransporter.sendMail({
    from: `"${env.SMTP_FROM_NAME || EMAIL_CONFIG.FROM_FALLBACK_NAME}" <${env.SMTP_FROM_EMAIL}>`,
    to: email,
    subject: EMAIL_CONFIG.OTP_SUBJECT,
    text: buildOtpText({ otp, ttlMinutes }),
    html: buildOtpHtml({
      email,
      otp,
      ttlMinutes,
      logoCid: EMAIL_CONFIG.LOGO_CID
    }),
    attachments
  });

  const previewUrl = nodemailer.getTestMessageUrl(sentMessage);

  if (previewUrl) {
    logger.info("OTP email preview available", {
      context: LOG_CONTEXT.EMAIL,
      recipient: maskEmail(email),
      previewUrl
    });
  }

  logger.info("OTP email sent", {
    context: LOG_CONTEXT.EMAIL,
    recipient: maskEmail(email),
    messageId: sentMessage.messageId
  });
};
