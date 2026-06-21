import nodemailer from "nodemailer";
import { resolveSiteContact } from "@shared/siteContact";

const appUrl = () => process.env.APP_URL || "http://localhost:3000";

export function getSiteContact() {
  return resolveSiteContact(process.env as Record<string, string | undefined>);
}

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
}

export function buildVerificationUrl(token: string): string {
  return `${appUrl()}/auth?verify=${encodeURIComponent(token)}`;
}

export async function sendVerificationEmail(
  to: string,
  token: string,
): Promise<{ sent: boolean; verifyUrl: string }> {
  const verifyUrl = buildVerificationUrl(token);
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@reelforge.local";
  const transporter = getTransporter();

  if (!transporter) {
    console.log(`[email] Verification link for ${to}: ${verifyUrl}`);
    return { sent: false, verifyUrl };
  }

  await transporter.sendMail({
    from,
    to,
    subject: "Verify your ReelForge AI email",
    html: `
      <h2>Welcome to ReelForge AI</h2>
      <p>Please verify your email address by clicking the link below:</p>
      <p><a href="${verifyUrl}">Verify my email</a></p>
      <p>This link expires in 24 hours.</p>
      <p>If you did not create an account, you can ignore this email.</p>
    `,
    text: `Verify your ReelForge AI account: ${verifyUrl}`,
  });

  return { sent: true, verifyUrl };
}

export function buildPasswordResetUrl(token: string): string {
  return `${appUrl()}/auth?reset=${encodeURIComponent(token)}`;
}

export async function sendPasswordResetEmail(
  to: string,
  token: string,
): Promise<{ sent: boolean; resetUrl: string }> {
  const resetUrl = buildPasswordResetUrl(token);
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@reelforge.local";
  const transporter = getTransporter();

  if (!transporter) {
    console.log(`[email] Password reset link for ${to}: ${resetUrl}`);
    return { sent: false, resetUrl };
  }

  await transporter.sendMail({
    from,
    to,
    subject: "Reset your ReelForge AI password",
    html: `
      <h2>Reset your password</h2>
      <p>We received a request to reset the password for your ReelForge AI account.</p>
      <p><a href="${resetUrl}">Reset my password</a></p>
      <p>This link expires in 1 hour.</p>
      <p>If you did not request a password reset, you can ignore this email.</p>
    `,
    text: `Reset your ReelForge AI password: ${resetUrl}`,
  });

  return { sent: true, resetUrl };
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatEmailDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildPurchaseEmailHtml(options: {
  appName: string;
  greetingName: string;
  packageName: string;
  credits: number;
  amountCents: number;
  paymentReference: string;
  creditsBalance: number;
  purchaseDate: string;
  dashboardUrl: string;
  settingsUrl: string;
  supportEmail: string;
  emergencyEmail: string;
  supportHours: string;
}): string {
  const {
    appName,
    greetingName,
    packageName,
    credits,
    amountCents,
    paymentReference,
    creditsBalance,
    purchaseDate,
    dashboardUrl,
    settingsUrl,
    supportEmail,
    emergencyEmail,
    supportHours,
  } = options;

  const priceLabel = formatPrice(amountCents);
  const safeAppName = escapeHtml(appName);
  const safeGreeting = escapeHtml(greetingName);
  const safePackage = escapeHtml(packageName);
  const safeReference = escapeHtml(paymentReference);
  const safePurchaseDate = escapeHtml(purchaseDate);
  const safeSupportEmail = escapeHtml(supportEmail);
  const safeEmergencyEmail = escapeHtml(emergencyEmail);
  const safeSupportHours = escapeHtml(supportHours);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payment confirmation</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="background:linear-gradient(135deg,#111827 0%,#1f2937 100%);padding:28px 32px;">
              <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;">Payment confirmed</p>
              <h1 style="margin:0;font-size:24px;line-height:1.3;font-weight:700;color:#ffffff;">Thank you for your purchase</h1>
              <p style="margin:10px 0 0;font-size:14px;line-height:1.5;color:#d1d5db;">Your ${safeAppName} credit pack is ready to use.</p>
            </td>
          </tr>

          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">
                Dear ${safeGreeting},
              </p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">
                We have successfully processed your payment. A summary of your order is below for your records.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:24px;">
                <tr>
                  <td colspan="2" style="padding:14px 18px;background-color:#f9fafb;border-bottom:1px solid #e5e7eb;">
                    <strong style="font-size:14px;color:#111827;">Order summary</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 18px;font-size:14px;color:#6b7280;border-bottom:1px solid #f3f4f6;">Receipt number</td>
                  <td style="padding:12px 18px;font-size:14px;color:#111827;text-align:right;border-bottom:1px solid #f3f4f6;"><strong>${safeReference}</strong></td>
                </tr>
                <tr>
                  <td style="padding:12px 18px;font-size:14px;color:#6b7280;border-bottom:1px solid #f3f4f6;">Date</td>
                  <td style="padding:12px 18px;font-size:14px;color:#111827;text-align:right;border-bottom:1px solid #f3f4f6;">${safePurchaseDate}</td>
                </tr>
                <tr>
                  <td style="padding:12px 18px;font-size:14px;color:#6b7280;border-bottom:1px solid #f3f4f6;">Plan purchased</td>
                  <td style="padding:12px 18px;font-size:14px;color:#111827;text-align:right;border-bottom:1px solid #f3f4f6;"><strong>${safePackage}</strong></td>
                </tr>
                <tr>
                  <td style="padding:12px 18px;font-size:14px;color:#6b7280;border-bottom:1px solid #f3f4f6;">Credits added</td>
                  <td style="padding:12px 18px;font-size:14px;color:#111827;text-align:right;border-bottom:1px solid #f3f4f6;"><strong>${credits.toLocaleString()}</strong></td>
                </tr>
                <tr>
                  <td style="padding:12px 18px;font-size:14px;color:#6b7280;border-bottom:1px solid #f3f4f6;">Amount paid</td>
                  <td style="padding:12px 18px;font-size:14px;color:#111827;text-align:right;border-bottom:1px solid #f3f4f6;"><strong>${priceLabel}</strong></td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;font-size:14px;color:#6b7280;">Current balance</td>
                  <td style="padding:14px 18px;font-size:15px;color:#111827;text-align:right;"><strong>${creditsBalance.toLocaleString()} credits</strong></td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="border-radius:8px;background-color:#111827;">
                    <a href="${dashboardUrl}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">Go to dashboard</a>
                  </td>
                  <td style="padding-left:12px;">
                    <a href="${settingsUrl}" style="font-size:14px;font-weight:600;color:#111827;text-decoration:underline;">View billing settings</a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#374151;">
                You can start creating reels immediately. If you need assistance with billing, uploads, or processing, our support team is available to help.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;">
                <tr>
                  <td style="padding:18px;">
                    <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#111827;">Customer support</p>
                    <p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:#4b5563;">
                      General inquiries: <a href="mailto:${safeSupportEmail}" style="color:#111827;">${safeSupportEmail}</a>
                    </p>
                    <p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:#4b5563;">
                      Urgent issues: <a href="mailto:${safeEmergencyEmail}" style="color:#111827;">${safeEmergencyEmail}</a>
                    </p>
                    <p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">Hours: ${safeSupportHours}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid #e5e7eb;background-color:#fcfcfd;">
              <p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:#6b7280;">
                Kind regards,<br />
                <strong style="color:#111827;">The ${safeAppName} Team</strong>
              </p>
              <p style="margin:12px 0 0;font-size:11px;line-height:1.5;color:#9ca3af;">
                This is an automated receipt for your ${safeAppName} purchase. Please retain this email for your records.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export async function sendPlanPurchaseEmail(params: {
  to: string;
  firstName?: string | null;
  packageName: string;
  credits: number;
  amountCents: number;
  paymentReference: string;
  creditsBalance: number;
}): Promise<{ sent: boolean }> {
  const contact = getSiteContact();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@reelforge.local";
  const transporter = getTransporter();
  const greetingName = params.firstName?.trim() || "Customer";
  const dashboardUrl = `${appUrl()}/dashboard`;
  const settingsUrl = `${appUrl()}/settings`;
  const priceLabel = formatPrice(params.amountCents);
  const purchaseDate = formatEmailDate(new Date());

  const text = [
    `${contact.appName} — Payment Confirmation`,
    "",
    `Dear ${greetingName},`,
    "",
    "Thank you for your purchase. Your payment has been processed successfully.",
    "",
    "ORDER SUMMARY",
    `Receipt number: ${params.paymentReference}`,
    `Date: ${purchaseDate}`,
    `Plan purchased: ${params.packageName}`,
    `Credits added: ${params.credits.toLocaleString()}`,
    `Amount paid: ${priceLabel}`,
    `Current balance: ${params.creditsBalance.toLocaleString()} credits`,
    "",
    `Dashboard: ${dashboardUrl}`,
    `Billing settings: ${settingsUrl}`,
    "",
    "CUSTOMER SUPPORT",
    `General inquiries: ${contact.supportEmail}`,
    `Urgent issues: ${contact.emergencyEmail}`,
    `Hours: ${contact.supportHours}`,
    "",
    `Kind regards,`,
    `The ${contact.appName} Team`,
    "",
    "This is an automated receipt. Please retain this email for your records.",
  ].join("\n");

  const html = buildPurchaseEmailHtml({
    appName: contact.appName,
    greetingName,
    packageName: params.packageName,
    credits: params.credits,
    amountCents: params.amountCents,
    paymentReference: params.paymentReference,
    creditsBalance: params.creditsBalance,
    purchaseDate,
    dashboardUrl,
    settingsUrl,
    supportEmail: contact.supportEmail,
    emergencyEmail: contact.emergencyEmail,
    supportHours: contact.supportHours,
  });

  if (!transporter) {
    console.log(`[email] Plan purchase confirmation for ${params.to}:\n${text}`);
    return { sent: false };
  }

  await transporter.sendMail({
    from: `"${contact.appName}" <${from}>`,
    to: params.to,
    replyTo: contact.supportEmail,
    subject: `Payment Confirmation — ${params.packageName} | ${contact.appName}`,
    html,
    text,
  });

  return { sent: true };
}
