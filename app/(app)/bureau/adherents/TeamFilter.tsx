"use client";

import { useRouter } from "next/navigation";

export function TeamFilter({ teams, value }: { teams: string[]; value: string }) {
  const router = useRouter();
  return (
    <>
      <label htmlFor="team-filter">Équipe</label>
      <select
        id="team-filter"
        value={value}
        onChange={(e) =>
          router.replace(e.target.value ? `/bureau/adherents?equipe=${encodeURIComponent(e.target.value)}` : "/bureau/adherents")
        }
      >
        <option value="">Tous les adhérents</option>
        {teams.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
        <option value="aucune">Sans équipe</option>
      </select>
    </>
  );
}
