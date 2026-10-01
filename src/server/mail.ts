/**
 * Outbound email abstraction. The default "console" driver logs messages (development).
 * Plug in SMTP / Resend / SES / Postmark here for production password-reset emails.
 */
export type MailMessage = { to: string; subject: string; text: string };

export async function sendMail(message: MailMessage) {
  if (process.env.NODE_ENV === "production" && !process.env.MAIL_DRIVER) {
    console.warn("[kinetic] MAIL_DRIVER not configured — password reset email not delivered to", message.to);
    return;
  }
  console.info(`\n📧  Mail to ${message.to}\n    Subject: ${message.subject}\n    ${message.text.replace(/\n/g, "\n    ")}\n`);
}
