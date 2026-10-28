import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Matchs" };

export default function Page() {
  return (
    <ComingSoon title="Matchs">
      Bientôt : le calendrier des matchs de votre équipe et du club.
    </ComingSoon>
  );
}
