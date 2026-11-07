// lib/email.ts
// Central email transmission service for HBaOMS notifications using Nodemailer.
// Supports Gmail SMTP, Mailtrap, Brevo, or any standard SMTP host.

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { formatCurrency, formatDate } from "@/lib/utils";

// Singleton Transporter
let transporter: Transporter | null = null;

export function getEmailTransporter(): Transporter | null {
  if (transporter) return transporter;

  const host = process.env.EMAIL_HOST;
  const port = Number(process.env.EMAIL_PORT) || 587;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  // If credentials are not configured, return null for graceful fallback
  if (!host || !user || !pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for 587 or others
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false, // Prevents self-signed cert blocks in testing
    },
  });

  return transporter;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  skipped?: boolean;
}

/**
 * Sends an email using the configured SMTP transporter.
 * Falls back safely if SMTP is not configured without throwing an unhandled exception.
 */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendEmailResult> {
  const mailer = getEmailTransporter();
  const from = process.env.EMAIL_FROM || '"Le Paradis Royal" <no-reply@leparadisroyal.mu>';

  if (!mailer) {
    console.warn(`[EMAIL SKIPPED] No SMTP configuration found. Intended recipient: ${to}, Subject: "${subject}".`);
    return {
      success: false,
      skipped: true,
      error: "SMTP configuration missing (EMAIL_HOST, EMAIL_USER, or EMAIL_PASS not set).",
    };
  }

  // Validate recipient email syntax to prevent malformed address rejection
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!to || !emailRegex.test(to.trim())) {
    console.warn(`[EMAIL SKIPPED] Invalid recipient email address: "${to}".`);
    return {
      success: false,
      error: `Invalid email address format: "${to}"`,
    };
  }

  try {
    const info = await mailer.sendMail({
      from,
      to,
      subject,
      html,
    });

    console.log(`[EMAIL SENT] To: ${to}, Subject: "${subject}", MessageID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error(`[EMAIL ERROR] Failed to send email to ${to}:`, err.message || err);
    return { success: false, error: err.message || "Failed to send email via SMTP" };
  }
}

// =============================================================================
// HTML TEMPLATE BUILDERS (Le Paradis Royal Luxury Theme)
// =============================================================================

function renderEmailLayout({
  title,
  preheader,
  contentHtml,
}: {
  title: string;
  preheader: string;
  contentHtml: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #F8F7F4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1A202C; -webkit-font-smoothing: antialiased; }
    .container { max-width: 600px; margin: 30px auto; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; border: 1px solid #E5E2DC; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { background-color: #1A202C; padding: 36px 30px; text-align: center; border-bottom: 2px solid #A37836; }
    .brand-title { color: #FFFFFF; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; margin: 0; }
    .brand-sub { color: #A37836; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 2.5px; margin-top: 6px; }
    .content { padding: 36px 32px; line-height: 1.6; }
    .h1 { font-size: 24px; font-weight: 800; color: #1A202C; margin-top: 0; margin-bottom: 12px; }
    .card-box { background-color: #F8F7F4; border: 1px solid #E5E2DC; border-radius: 14px; padding: 20px; margin: 24px 0; }
    .table-details { width: 100%; border-collapse: collapse; font-size: 13px; }
    .table-details td { padding: 8px 0; border-bottom: 1px solid #E5E2DC; }
    .table-details tr:last-child td { border-bottom: none; }
    .label { color: #64748B; font-weight: 500; }
    .value { color: #1A202C; font-weight: 700; text-align: right; }
    .highlight-gold { color: #A37836; font-weight: 800; }
    .btn { display: inline-block; background-color: #A37836; color: #FFFFFF !important; font-weight: 700; font-size: 14px; text-decoration: none; padding: 14px 28px; border-radius: 12px; margin-top: 20px; }
    .footer { background-color: #F8F7F4; padding: 24px; text-align: center; font-size: 12px; color: #64748B; border-top: 1px solid #E5E2DC; }
  </style>
</head>
<body>
  <span style="display:none;font-size:1px;color:#fff;max-height:0">${preheader}</span>
  <div class="container">
    <div class="header">
      <h1 class="brand-title">Le Paradis Royal</h1>
      <div class="brand-sub">Hotel &amp; Ocean Spa &bull; Mauritius</div>
    </div>
    <div class="content">
      ${contentHtml}
    </div>
    <div class="footer">
      <p style="margin:0 0 6px 0;"><strong>Le Paradis Royal Sanctuary &bull; Grand Baie, Mauritius</strong></p>
      <p style="margin:0 0 10px 0;">Phone: +230 200 8888 &bull; Concierge: concierge@leparadisroyal.mu</p>
      <p style="margin:0;font-size:11px;color:#94A3B8;">&copy; ${new Date().getFullYear()} Le Paradis Royal Hotel &amp; Ocean Spa. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * 1. Booking Confirmation Email Template
 */
export function buildBookingConfirmationHtml({
  guestName,
  bookingId,
  roomTypeName,
  roomId,
  checkInDate,
  checkOutDate,
  boardType,
  numAdults,
  numChildren,
  totalAmount,
  portalUrl,
}: {
  guestName: string;
  bookingId: number;
  roomTypeName: string;
  roomId?: number | string | null;
  checkInDate: string;
  checkOutDate: string;
  boardType: string;
  numAdults: number;
  numChildren: number;
  totalAmount: number;
  portalUrl?: string;
}): { subject: string; html: string } {
  const subject = `Booking Confirmed #${bookingId} - Le Paradis Royal Mauritius`;
  const preheader = `Your reservation #${bookingId} at Le Paradis Royal is confirmed. We look forward to welcoming you.`;

  const boardLabel =
    boardType === "HB"
      ? "Half Board (Breakfast & Dinner)"
      : boardType === "FB"
      ? "Full Board (All Meals)"
      : "Room Only (RO)";

  const contentHtml = `
    <h2 class="h1">Your Reservation is Confirmed</h2>
    <p>Dear ${guestName},</p>
    <p>Thank you for choosing <strong>Le Paradis Royal</strong>. We are delighted to confirm your upcoming stay with us on the beautiful shores of Grand Baie.</p>
    
    <div class="card-box">
      <table class="table-details">
        <tr>
          <td class="label">Reservation ID</td>
          <td class="value highlight-gold">#${bookingId}</td>
        </tr>
        <tr>
          <td class="label">Accommodation</td>
          <td class="value">${roomTypeName}${roomId ? ` (Room #${roomId})` : ""}</td>
        </tr>
        <tr>
          <td class="label">Check-In Date</td>
          <td class="value">${formatDate(checkInDate)} (From 14:00)</td>
        </tr>
        <tr>
          <td class="label">Check-Out Date</td>
          <td class="value">${formatDate(checkOutDate)} (Until 11:00)</td>
        </tr>
        <tr>
          <td class="label">Board Basis</td>
          <td class="value">${boardLabel}</td>
        </tr>
        <tr>
          <td class="label">Guests</td>
          <td class="value">${numAdults} Adult${numAdults > 1 ? "s" : ""}${numChildren > 0 ? `, ${numChildren} Child${numChildren > 1 ? "ren" : ""}` : ""}</td>
        </tr>
        <tr>
          <td class="label">Total Paid (incl. 15% VAT)</td>
          <td class="value highlight-gold" style="font-size:16px;">${formatCurrency(totalAmount)}</td>
        </tr>
      </table>
    </div>

    <p style="font-size:13px;color:#475569;">
      <strong>Enhance Your Stay:</strong> Spa treatments, private beach dinners, and catamaran island excursions can be booked directly through your personalized Guest Portal.
    </p>

    <div style="text-align:center;margin:30px 0 10px 0;">
      <a href="${portalUrl || "https://hbaoms.vercel.app/customer/bookings"}" class="btn">View Reservation &amp; Add-ons</a>
    </div>
  `;

  return { subject, html: renderEmailLayout({ title: subject, preheader, contentHtml }) };
}

/**
 * 2. Booking Cancellation Email Template
 */
export function buildCancellationHtml({
  guestName,
  bookingId,
  roomTypeName,
  refundAmount,
  reason,
}: {
  guestName: string;
  bookingId: number;
  roomTypeName: string;
  refundAmount: number;
  reason?: string;
}): { subject: string; html: string } {
  const subject = `Booking Cancellation Confirmation #${bookingId} - Le Paradis Royal`;
  const preheader = `Your reservation #${bookingId} has been cancelled.`;

  const contentHtml = `
    <h2 class="h1">Reservation Cancellation</h2>
    <p>Dear ${guestName},</p>
    <p>This email confirms that your reservation <strong>#${bookingId}</strong> for <strong>${roomTypeName}</strong> has been cancelled.</p>

    <div class="card-box">
      <table class="table-details">
        <tr>
          <td class="label">Reservation ID</td>
          <td class="value">#${bookingId}</td>
        </tr>
        <tr>
          <td class="label">Status</td>
          <td class="value" style="color:#DC2626;">Cancelled</td>
        </tr>
        ${
          reason
            ? `<tr>
                <td class="label">Reason</td>
                <td class="value">${reason}</td>
              </tr>`
            : ""
        }
        <tr>
          <td class="label">Refund Amount Processed</td>
          <td class="value highlight-gold">${formatCurrency(refundAmount)}</td>
        </tr>
      </table>
    </div>

    <p style="font-size:13px;color:#475569;">
      If eligible for a refund per our graduated cancellation policy, the amount has been submitted to your original payment card via Stripe and typically reflects within 5 to 10 business days.
    </p>

    <p style="margin-top:24px;">We hope to welcome you to Le Paradis Royal in the near future.</p>
  `;

  return { subject, html: renderEmailLayout({ title: subject, preheader, contentHtml }) };
}

/**
 * 3. Check-in Reminder Email Template
 */
export function buildCheckInReminderHtml({
  guestName,
  bookingId,
  roomTypeName,
  checkInDate,
  checkOutDate,
  portalUrl,
}: {
  guestName: string;
  bookingId: number;
  roomTypeName: string;
  checkInDate: string;
  checkOutDate: string;
  portalUrl?: string;
}): { subject: string; html: string } {
  const subject = `Your Stay Begins Tomorrow! Check-in Reminder #${bookingId} - Le Paradis Royal`;
  const preheader = `We look forward to welcoming you to Le Paradis Royal tomorrow.`;

  const contentHtml = `
    <h2 class="h1">We Look Forward to Welcoming You</h2>
    <p>Dear ${guestName},</p>
    <p>Your tropical escape begins tomorrow! Our team is preparing your <strong>${roomTypeName}</strong> for your arrival.</p>

    <div class="card-box">
      <table class="table-details">
        <tr>
          <td class="label">Reservation ID</td>
          <td class="value highlight-gold">#${bookingId}</td>
        </tr>
        <tr>
          <td class="label">Check-In Time</td>
          <td class="value">Tomorrow, ${formatDate(checkInDate)} at 14:00</td>
        </tr>
        <tr>
          <td class="label">Check-Out Date</td>
          <td class="value">${formatDate(checkOutDate)} at 11:00</td>
        </tr>
        <tr>
          <td class="label">Resort Address</td>
          <td class="value">Grand Baie Coastal Road, Mauritius</td>
        </tr>
      </table>
    </div>

    <div style="background-color:#F4EFE6;border:1px solid #E5E2DC;border-radius:12px;padding:16px;margin:20px 0;font-size:13px;">
      <strong style="color:#8B6327;">Check-in Guidelines:</strong>
      <ul style="margin:8px 0 0 16px;padding:0;color:#64748B;">
        <li>Please present a valid passport or government ID upon check-in.</li>
        <li>Early arrival? Enjoy our lagoon lounge while your room is completed.</li>
        <li>Airport transfer required? Contact our concierge immediately at +230 200 8888.</li>
      </ul>
    </div>

    <div style="text-align:center;margin:24px 0 10px 0;">
      <a href="${portalUrl || "https://hbaoms.vercel.app/customer/bookings"}" class="btn">Access Guest Portal</a>
    </div>
  `;

  return { subject, html: renderEmailLayout({ title: subject, preheader, contentHtml }) };
}

