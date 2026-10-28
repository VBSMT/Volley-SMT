import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Événements" };

export default function Page() {
  return (
    <ComingSoon title="Événements">
      Bientôt : tournois, événements de la ville et repas des adhérents.
    </ComingSoon>
  );
}
