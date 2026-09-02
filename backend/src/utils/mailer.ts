import nodemailer from 'nodemailer';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  if (env.SMTP_HOST && env.SMTP_PORT) {
    logger.info('Initializing SMTP Transporter:', {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      user: env.SMTP_USER,
      secure: env.SMTP_SECURE,
    });
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE ?? false,
      auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  } else {
    // Ethereal / preview transport for development
    logger.info('SMTP not configured; using dev jsonTransport');
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }

  return transporter;
}

export interface InviteEmailOptions {
  to: string;
  orgName: string;
  role: string;
  inviteUrl: string;
}

/**
 * Send an invitation email to a teammate.
 * In development (no SMTP configured) the email is logged to the console.
 * In production, configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in env.
 */
export async function sendInviteEmail(opts: InviteEmailOptions): Promise<void> {
  const from = env.SMTP_FROM || (env.SMTP_USER ? `Grid Sentry <${env.SMTP_USER}>` : `Grid Sentry <no-reply@gridsentry.io>`);

  const html = `
    <div style="font-family:sans-serif;max-width:540px;margin:0 auto;padding:24px;border:1px solid #334155;border-radius:8px;background:#0f172a;color:#f8fafc">
      <h2 style="color:#38bdf8;margin-top:0">You've been invited to <strong>${opts.orgName}</strong></h2>
      <p style="color:#94a3b8;font-size:14px;line-height:1.5">You've been invited to join the Grid Sentry Security Operations Console with <strong style="color:#f8fafc">${opts.role.toUpperCase()}</strong> privileges.</p>
      <div style="margin:24px 0">
        <a href="${opts.inviteUrl}" style="display:inline-block;padding:12px 24px;background:#0284c7;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:14px">
          Accept Invitation & Setup Account
        </a>
      </div>
      <p style="color:#64748b;font-size:12px;margin-bottom:4px">Direct link: <a href="${opts.inviteUrl}" style="color:#38bdf8">${opts.inviteUrl}</a></p>
      <p style="color:#64748b;font-size:12px">This invitation is valid for 72 hours. If you did not expect this, you can safely ignore this email.</p>
    </div>
  `;

  const mailOptions: nodemailer.SendMailOptions = {
    from,
    to: opts.to,
    subject: `Invitation: Join ${opts.orgName} on Grid Sentry`,
    html,
    text: `You've been invited as a ${opts.role} in ${opts.orgName} on Grid Sentry.\n\nAccept invitation: ${opts.inviteUrl}\n\nThis link expires in 72 hours.`,
  };

  try {
    const info = await getTransporter().sendMail(mailOptions);
    logger.info('Invite email successfully sent:', {
      to: opts.to,
      messageId: (info as any).messageId,
      response: (info as any).response,
    });
  } catch (err) {
    logger.error('Failed to dispatch invite email via SMTP:', {
      to: opts.to,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

