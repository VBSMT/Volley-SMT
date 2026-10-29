import "server-only";
import { parisClock } from "@/lib/domain/notifications";
import { parisDate } from "@/lib/domain/training";
import { parseGyms } from "@/lib/domain/gyms";
import { poolOf, parseStandings } from "@/lib/domain/standings";
import { parseIcs, parseTeams, reconcile, teamMatches } from "@/lib/domain/volley34";
import { notifyMembers, type Recipient } from "@/lib/notify";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

const TEAMS_URL = "https://api.volley34.fr/v1/equipes";
const ICS_URL = (code: string) => `http://calendrier.volley34.fr/?equipe=${encodeURIComponent(code)}`;
const STANDINGS_URL = (code: string) => `https://api.volley34.fr/v1/equipes/${encodeURIComponent(code)}/classements`;
const GYMS_URL = "https://api.volley34.fr/v1/gymnases";
const CLUB_CODE = "SMDT";
const SYNC_HOUR = 6;

async function fetchText(url: string, accept = "*/*") {
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
    headers: { Accept: accept, "User-Agent": "VolleySMT/1.0 (appli du club SMDT)" },
  });
  if (!res.ok) throw new Error(`${url} : HTTP ${res.status}`);
  return res.text();
}

export type SyncSummary = { teams: number; updated: number; moved: number; created: number; standings: number };

/**
 * Synchronise le calendrier des équipes SMDT depuis volley34 (flux ICS par équipe).
 * volley34 fait foi pour la date et le lieu ; rien n'est supprimé. En cas d'erreur,
 * rien n'est modifié pour l'équipe concernée et le planning reste sur la dernière version.
 */
export async function syncVolley34(admin: Admin): Promise<SyncSummary> {
  const body = await fetchText(TEAMS_URL, "application/xml, application/json;q=0.9");
  const remoteTeams = parseTeams(body, CLUB_CODE);
  if (!remoteTeams.length) {
    // Début de la réponse dans le message, pour diagnostiquer depuis Bureau > Calendrier.
    throw new Error(`Aucune équipe SMDT dans la réponse volley34 (début : ${body.slice(0, 120).replace(/\s+/g, " ")})`);
  }

  const { data: teams, error } = await admin.from("teams").select("id, name, volley34_ref");
  if (error) throw new Error(error.message);
  const summary: SyncSummary = { teams: 0, updated: 0, moved: 0, created: 0, standings: 0 };

  for (const remoteTeam of remoteTeams) {
    const shortName = remoteTeam.name.replace(/^SMDT\s*\/\s*/i, "").trim();
    let team = teams.find((t) => t.volley34_ref === remoteTeam.code) ?? teams.find((t) => t.name === shortName);
    if (!team) {
      const { data, error: e } = await admin
        .from("teams")
        .insert({ name: shortName, volley34_ref: remoteTeam.code })
        .select("id, name, volley34_ref")
        .single();
      if (e) throw new Error(e.message);
      team = data;
    } else if (team.volley34_ref !== remoteTeam.code) {
      await admin.from("teams").update({ volley34_ref: remoteTeam.code }).eq("id", team.id);
    }

    const remote = teamMatches(parseIcs(await fetchText(ICS_URL(remoteTeam.code))), remoteTeam.name);
    const { data: existing, error: e2 } = await admin
      .from("matches")
      .select("id, opponent, is_home, starts_at, volley34_ref, competition")
      .eq("team_id", team.id);
    if (e2) throw new Error(e2.message);
    // Sécurité : un flux vide alors que l'équipe a des matchs = flux anormal, on ne touche à rien.
    if (!remote.length && existing.length) throw new Error(`Flux vide pour ${remoteTeam.name}`);

    const { updates, inserts } = reconcile(remote, existing);
    const now = new Date().toISOString();
    for (const u of updates) {
      const { error: e3 } = await admin
        .from("matches")
        .update({
          starts_at: u.match.startsAt,
          venue: u.match.venue,
          city: u.match.city,
          volley34_ref: u.match.uid,
          source: "volley34",
          updated_at: now,
        })
        .eq("id", u.id);
      if (e3) throw new Error(e3.message);
    }
    if (inserts.length) {
      const competition = existing[0]?.competition ?? "Championnat";
      const { error: e4 } = await admin.from("matches").upsert(
        inserts.map((m) => ({
          team_id: team.id,
          opponent: m.opponent,
          is_home: m.isHome,
          starts_at: m.startsAt,
          venue: m.venue,
          city: m.city,
          competition,
          volley34_ref: m.uid,
          source: "volley34" as const,
          updated_at: now,
        })),
        { onConflict: "volley34_ref" },
      );
      if (e4) throw new Error(e4.message);
    }

    // Classement de la poule : facultatif (vide en début de saison), sans bloquer le calendrier.
    try {
      const pool = poolOf(parseStandings(await fetchText(STANDINGS_URL(remoteTeam.code), "application/xml, application/json;q=0.9")), {
        code: remoteTeam.code,
        fullName: remoteTeam.name,
      });
      const mine = pool.find((r) => r.code === remoteTeam.code) ?? pool.find((r) => r.name === remoteTeam.name);
      if (mine) {
        await admin.from("standings_snapshots").upsert(
          {
            team_id: team.id,
            taken_on: parisDate(new Date().toISOString()),
            rows: pool,
            rank: mine.rank,
            pool_size: pool.length,
            played: mine.played,
            won: mine.won,
            lost: mine.lost,
            points: mine.points,
            set_diff: mine.setDiff,
            point_diff: mine.pointDiff,
            updated_at: now,
          },
          { onConflict: "team_id,taken_on" },
        );
        summary.standings++;
      }
    } catch (e) {
      console.error("Classement non lu", remoteTeam.code, (e as Error).message);
    }

    summary.teams++;
    summary.updated += updates.length;
    summary.moved += updates.filter((u) => u.moved).length;
    summary.created += inserts.length;
  }

  // Gymnases (itinéraires) : facultatif, sans bloquer la synchro.
  try {
    const gyms = parseGyms(await fetchText(GYMS_URL, "application/json"));
    if (gyms.length) {
      const { error: e } = await admin.from("gyms").upsert(
        gyms.map((g) => ({
          code: g.code,
          name: g.name,
          full_name: g.fullName,
          address: g.address,
          postal_code: g.postalCode,
          city: g.city,
          lat: g.lat,
          lon: g.lon,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "code" },
      );
      if (e) throw new Error(e.message);
    }
  } catch (e) {
    console.error("Gymnases non lus", (e as Error).message);
  }
  return summary;
}

/** Lance la synchro, journalise le résultat et prévient le Bureau au passage en échec. */
export async function runVolley34Sync(admin: Admin, board: Recipient[]) {
  const startedAt = new Date().toISOString();
  const { data: previous } = await admin
    .from("sync_runs")
    .select("success")
    .eq("source", "volley34")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  try {
    const summary = await syncVolley34(admin);
    await admin.from("sync_runs").insert({
      source: "volley34",
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      success: true,
      message: `${summary.teams} équipes · ${summary.updated} matchs à jour (${summary.moved} déplacés) · ${summary.created} ajoutés · ${summary.standings} classements`,
    });
    return { ok: true as const, summary };
  } catch (e) {
    const message = (e as Error).message.slice(0, 500);
    await admin.from("sync_runs").insert({
      source: "volley34",
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      success: false,
      message,
    });
    // Une seule alerte par panne : seulement si la tentative précédente avait réussi.
    if (previous?.success !== false) {
      await notifyMembers(
        board.map((recipient) => ({
          recipient,
          message: {
            title: "Synchro volley34 en échec",
            body: "Le calendrier reste sur la dernière version valide. Détails dans Bureau > Calendrier.",
            url: "/bureau/matchs",
          },
        })),
      );
    }
    return { ok: false as const, error: message };
  }
}

/** Synchro due : à partir de 6h (Paris), si aucune synchro réussie aujourd'hui. */
export async function isVolley34SyncDue(admin: Admin, now: Date) {
  const { date, hour } = parisClock(now);
  if (hour < SYNC_HOUR) return false;
  const { data: last } = await admin
    .from("sync_runs")
    .select("finished_at")
    .eq("source", "volley34")
    .eq("success", true)
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return !last?.finished_at || parisDate(last.finished_at) !== date;
}
