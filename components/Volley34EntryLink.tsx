import { volley34EntryUrl } from "@/lib/domain/volley34";

/** Lien vers la saisie du résultat ou du report sur volley34 (capitaines et Bureau). */
export function Volley34EntryLink({ competition, variant = "button" }: { competition: string | null; variant?: "button" | "link" }) {
  return (
    <a
      href={volley34EntryUrl(competition)}
      target="_blank"
      rel="noopener noreferrer"
      className={variant === "button" ? "btn-secondary center" : "small renfort-link"}
    >
      {variant === "button" ? "Saisir le résultat / le report sur volley34 ↗" : "Saisie volley34 ↗"}
    </a>
  );
}
