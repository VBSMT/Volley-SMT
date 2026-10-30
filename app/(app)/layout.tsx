import Image from "next/image";
import Link from "next/link";
import { GuidedTour } from "@/components/GuidedTour";
import { FeedbackProvider } from "@/components/Feedback";
import { TabBar } from "@/components/TabBar";
import { getUnread } from "@/lib/chat";
import { getCurrentMember, hasRole } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const member = await getCurrentMember();
  // Messages non lus (tous salons) pour la pastille de l'en-tête.
  const unread = member ? [...(await getUnread(await createClient())).values()].reduce((a, b) => a + b, 0) : 0;

  return (
    <>
      <header className="app-header">
        <Image src="/logo.png" alt="" width={40} height={40} priority />
        <span className="brand">Volley SMT</span>
        {member && hasRole(member, "board") && (
          <Link href="/jeu" className="header-game" aria-label="VUT, Volley Ultimate Team">
            VUT
          </Link>
        )}
        {member && (
          <Link href="/chat" className="header-chat" aria-label={unread ? `Messages, ${unread} non lu${unread > 1 ? "s" : ""}` : "Messages"}>
            <span aria-hidden="true">💬</span>
            {unread > 0 && <span className="chat-badge">{unread > 99 ? "99+" : unread}</span>}
          </Link>
        )}
        <Link href="/profil" className="header-profile" aria-label="Mon profil" data-tour="profile">
          {member ? `${member.first_name[0]}${member.last_name[0]}` : "?"}
        </Link>
      </header>
      <div className="app-content">
        {member ? (
          <FeedbackProvider>
            {children}
            <GuidedTour
              // La clé recrée le guide quand l'avancement change en base (« Revoir le guide »).
              key={`${(member as { onboarding_step?: number }).onboarding_step ?? 0}-${!!(member as { onboarding_done_at?: string | null }).onboarding_done_at}`}
              initialStep={(member as { onboarding_step?: number }).onboarding_step ?? 0}
              done={!!(member as { onboarding_done_at?: string | null }).onboarding_done_at}
            />
          </FeedbackProvider>
        ) : (
          <main className="page stack">
            <p className="error" role="alert">
              Votre compte n&apos;est rattaché à aucune fiche adhérent. Contactez le Bureau.
            </p>
            <form action="/auth/deconnexion" method="post">
              <button type="submit" className="btn-secondary">Se déconnecter</button>
            </form>
          </main>
        )}
      </div>
      {member && <TabBar isBoard={hasRole(member, "board")} />}
    </>
  );
}
