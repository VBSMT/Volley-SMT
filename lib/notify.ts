import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import webpush from "web-push";
import type { Message } from "@/lib/domain/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

export type Recipient = { id: string; email: string; first_name: string };
export type Channel = "push" | "email" | "none";
type Subscription = { id: string; member_id: string; endpoint: string; p256dh: string; auth: string };

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "";

let mailer: Transporter | null = null;
function getMailer() {
  mailer ??= nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    auth: { user: process.env.BREVO_SMTP_USER, pass: process.env.BREVO_SMTP_PASS },
  });
  return mailer;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

async function sendEmail(to: Recipient, msg: Message) {
  const link = `${siteUrl()}${msg.url}`;
  await getMailer().sendMail({
    from: process.env.MAIL_FROM,
    to: to.email,
    subject: msg.title.replace(/^\p{Extended_Pictographic}\s*/u, ""),
    text: `Bonjour ${to.first_name},\n\n${msg.body}\n\n${link}\n\nVolley SMT`,
    html: `<p>Bonjour ${escapeHtml(to.first_name)},</p>
<p><strong>${escapeHtml(msg.title)}</strong><br>${escapeHtml(msg.body)}</p>
<p><a href="${link}" style="display:inline-block;padding:10px 16px;background:#FFE81A;color:#111111;border:2px solid #111111;border-radius:8px;font-weight:bold;text-decoration:none">Ouvrir Volley SMT</a></p>
<p style="color:#555555;font-size:13px">Pour recevoir ces messages en notification, activez-les depuis votre profil dans l'appli.</p>`,
  });
}

/**
 * Envoie un message à chaque destinataire : push sur ses appareils abonnés,
 * sinon email (secours). Les abonnements expirés sont supprimés.
 */
export async function notifyMembers(
  recipients: { recipient: Recipient; message: Message }[],
): Promise<Map<string, Channel>> {
  const result = new Map<string, Channel>();
  if (!recipients.length) return result;

  webpush.setVapidDetails(
    `mailto:${process.env.MAIL_FROM_ADDRESS ?? "contact@volley-smt.fr"}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, member_id, endpoint, p256dh, auth")
    .in("member_id", recipients.map((r) => r.recipient.id));
  const byMember = new Map<string, Subscription[]>();
  for (const s of (subs ?? []) as Subscription[]) {
    byMember.set(s.member_id, [...(byMember.get(s.member_id) ?? []), s]);
  }
  const expired: string[] = [];

  await Promise.all(
    recipients.map(async ({ recipient, message }) => {
      let delivered = false;
      for (const sub of byMember.get(recipient.id) ?? []) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify(message),
            { TTL: 6 * 3600, urgency: "normal" },
          );
          delivered = true;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) expired.push(sub.id);
          else console.error("Push en échec", status);
        }
      }
      if (delivered) return result.set(recipient.id, "push");
      try {
        await sendEmail(recipient, message);
        result.set(recipient.id, "email");
      } catch (e) {
        console.error("Email en échec", (e as Error).message);
        result.set(recipient.id, "none");
      }
    }),
  );

  if (expired.length) await admin.from("push_subscriptions").delete().in("id", expired);
  return result;
}
