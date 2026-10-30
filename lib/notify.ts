import "server-only";
import { isAllowedPushEndpoint } from "@/lib/domain/push";
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
    // Connexions réutilisées et limitées : un envoi groupé (70 adhérents) n'ouvre pas 70 connexions SMTP.
    pool: true,
    maxConnections: 3,
    auth: { user: process.env.BREVO_SMTP_USER, pass: process.env.BREVO_SMTP_PASS },
  });
  return mailer;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);


/**
 * Envoie un message à chaque destinataire : notification de l'appli (push) sur ses appareils abonnés.
 * Pas d'email de secours (choix du club) : sans notifications activées, rien n'est envoyé.
 * Les abonnements expirés sont supprimés.
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
      for (const sub of (byMember.get(recipient.id) ?? []).filter((x) => isAllowedPushEndpoint(x.endpoint))) {
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
      result.set(recipient.id, delivered ? "push" : "none");
    }),
  );

  if (expired.length) await admin.from("push_subscriptions").delete().in("id", expired);
  return result;
}

/** Email d'invitation envoyé par le Bureau à l'import des adhérents. */
export async function sendInvitation(to: Recipient, options: { reminder?: boolean } = {}) {
  const link = `${siteUrl()}/connexion`;
  await getMailer().sendMail({
    from: process.env.MAIL_FROM,
    to: to.email,
    subject: options.reminder ? "Rappel : ton accès à Volley SMT, l'appli du club" : "Bienvenue sur Volley SMT, l'appli du club",
    text: `Bonjour ${to.first_name},

Le club Volley-Ball Loisirs Saint-Mathieu-de-Tréviers a son application : entraînements, matchs, renforts…

Pour te connecter : ${link}
Saisis cette adresse email (${to.email}), tu recevras un code de connexion. Pas de mot de passe.

Astuce : ajoute l'appli à l'écran d'accueil de ton téléphone et active les notifications.

Le Bureau`,
    html: `<p>Bonjour ${escapeHtml(to.first_name)},</p>
<p>Le club <strong>Volley-Ball Loisirs Saint-Mathieu-de-Tréviers</strong> a son application : entraînements, matchs, renforts…</p>
<p><a href="${link}" style="display:inline-block;padding:10px 16px;background:#FFE81A;color:#111111;border:2px solid #111111;border-radius:8px;font-weight:bold;text-decoration:none">Ouvrir Volley SMT</a></p>
<p>Saisis ton adresse email (<strong>${escapeHtml(to.email)}</strong>) : tu recevras un code de connexion. Pas de mot de passe.</p>
<p>Astuce : ajoute l'appli à l'écran d'accueil de ton téléphone et active les notifications.</p>
<p>Le Bureau</p>`,
  });
}
