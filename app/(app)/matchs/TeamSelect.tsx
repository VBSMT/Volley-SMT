"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function TeamSelect({ teams, value }: { teams: { id: string; name: string }[]; value: string }) {
  const router = useRouter();
  const params = useSearchParams();

  return (
    <>
      <label htmlFor="equipe">Équipe</label>
      <select
        id="equipe"
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params);
          next.set("equipe", e.target.value);
          router.replace(`/matchs?${next}`);
        }}
      >
        <option value="tout">Tout le club</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </>
  );
}
