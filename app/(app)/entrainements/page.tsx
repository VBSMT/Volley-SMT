import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Entraînements" };

export default function Page() {
  return (
    <ComingSoon title="Entraînements">
      Bientôt : les séances du mardi et du jeudi, et le sondage de présence.
    </ComingSoon>
  );
}
