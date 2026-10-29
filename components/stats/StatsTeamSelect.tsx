"use client";

import { useRouter } from "next/navigation";

export function StatsTeamSelect({ teams, value }: { teams: { id: string; name: string }[]; value: string }) {
  const router = useRouter();
  return (
    <div className="stats-select">
      <label htmlFor="stats-team" className="sr-only">Équipe</label>
      <select id="stats-team" value={value} onChange={(e) => router.replace(`/stats?equipe=${e.target.value}`)}>
        <option value="club">Tout le club</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
    </div>
  );
}
