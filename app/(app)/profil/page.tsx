import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { NotificationToggle } from "@/components/NotificationToggle";
import { ThemeChooser } from "@/components/ThemeChooser";
import { PALETTE_COOKIE, THEME_COOKIE, type PaletteChoice, type ThemeChoice } from "@/lib/theme";
import { PaletteChooser } from "@/components/PaletteChooser";
import { RestartTourButton } from "@/components/GuidedTour";
import { ZelsyncFooter } from "@/components/ZelsyncFooter";
import { getCurrentMember, hasRole, ROLE_LABELS } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";
import { NotificationPrefs } from "./NotificationPrefs";
import { PhotoEditor } from "./PhotoEditor";
import { ProfileForm } from "./ProfileForm";
import { VolunteerRequest } from "./VolunteerRequest";

export const metadata: Metadata = { title: "Mon profil" };

export default async function ProfilPage() {
  const member = (await getCurrentMember())!;

  const supabase = await createClient();
  const { data: pendingRequest } = await supabase
    .from("volunteer_requests")
    .select("id")
    .eq("member_id", member.id)
    .eq("status", "pending")
    .maybeSingle();

  const roles = member.roles.length
    ? member.roles
        .map((r) => (r.role === "captain" && r.team ? `Capitaine (${r.team.name})` : ROLE_LABELS[r.role]))
        .join(", ")
    : ROLE_LABELS.member;

  return (
    <main className="page stack">
      <h1>
        {member.first_name} {member.last_name}
      </h1>

      <section className="card" data-tour="fiche">
        <h2>Ma fiche</h2>
        <p className="muted small">Pour corriger ces informations, contactez le Bureau.</p>
        <dl className="facts">
          <dt>Email</dt>
          <dd>{member.email}</dd>
          <dt>Sexe</dt>
          <dd>{member.sex === "F" ? "Femme" : "Homme"}</dd>
          <dt>{member.teams.length > 1 ? "Équipes" : "Équipe"}</dt>
          <dd>{member.teams.map((t) => t.name).join(", ") || "Aucune"}</dd>
          <dt>Rôles</dt>
          <dd>{roles}</dd>
          <dt>Licence FSGT</dt>
          <dd>
            {member.fsgt_license
              ? `${member.fsgt_license}${member.license_season ? ` (${member.license_season.label})` : ""}`
              : "Non renseignée"}
          </dd>
          <dt>Cotisation</dt>
          <dd>{member.dues_paid ? "Réglée" : "Non réglée"}</dd>
        </dl>
      </section>

      <ProfileForm member={member} />

      {hasRole(member, "board") && (
        <section className="card stack">
          <h2>Ma photo (VUT)</h2>
          <PhotoEditor
            memberId={member.id}
            consent={member.image_consent}
            version={member.photo_updated_at ? String(Date.parse(member.photo_updated_at)) : null}
          />
        </section>
      )}

      <section className="card stack" data-tour="notif-prefs">
        <h2>Notifications</h2>
        <NotificationToggle />
        {member.notify_training !== undefined && (
          <NotificationPrefs
            initial={{
              notify_training: member.notify_training,
              notify_match: member.notify_match ?? true,
              notify_reinforcement: member.notify_reinforcement ?? true,
              notify_mentions: member.notify_mentions ?? false,
            }}
          />
        )}
      </section>

      {!hasRole(member, "volunteer") && (
        <section className="card stack">
          <h2>Bénévolat</h2>
          {pendingRequest ? (
            <p className="notice">Votre demande est en attente de validation par le Bureau.</p>
          ) : (
            <VolunteerRequest />
          )}
        </section>
      )}

      <section className="card stack">
        <h2>Apparence</h2>
        <ThemeChooser initial={((await cookies()).get(THEME_COOKIE)?.value as ThemeChoice | undefined) ?? "auto"} />
        <PaletteChooser initial={((await cookies()).get(PALETTE_COOKIE)?.value as PaletteChoice | undefined) ?? "club"} />
      </section>

      <Link href="/liens" className="btn-secondary center">
        Liens utiles
      </Link>

      <form action="/auth/deconnexion" method="post">
        <button type="submit" className="btn-secondary full">
          Se déconnecter
        </button>
      </form>

      <RestartTourButton />
      <Link href="/aide" className="small">Aide : installation, notifications, utilisation →</Link>
      <ZelsyncFooter />
    </main>
  );
}
