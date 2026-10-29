import { describe, expect, it } from "vitest";
import {
  announcementMessage,
  closureMessage,
  eventMessage,
  isClosureDue,
  isMatchReminderDue,
  matchMessage,
  matchPollMessage,
  offerMessage,
  reinforcementAudience,
  reinforcementMessage,
  rescheduleDecisionMessage,
  rescheduleRequestedMessage,
  wantedLabel,
  isReminderDue,
  parisClock,
  reminderAudience,
  reminderMessage,
} from "./notifications";

// Mardi 3 novembre 2026, 20h Paris = 19h UTC (heure d'hiver).
const TUESDAY_SESSION = "2026-11-03T19:00:00.000Z";

describe("parisClock", () => {
  it("donne l'heure de Paris, été comme hiver", () => {
    expect(parisClock(new Date("2026-11-02T19:00:00Z"))).toEqual({ date: "2026-11-02", hour: 20 });
    expect(parisClock(new Date("2027-06-21T18:00:00Z"))).toEqual({ date: "2027-06-21", hour: 20 });
    expect(parisClock(new Date("2026-11-02T23:30:00Z"))).toEqual({ date: "2026-11-03", hour: 0 });
  });
});

describe("isReminderDue", () => {
  it("envoie la veille à partir de l'heure réglée", () => {
    expect(isReminderDue(new Date("2026-11-02T18:59:00Z"), TUESDAY_SESSION, 20)).toBe(false); // lundi 19h59
    expect(isReminderDue(new Date("2026-11-02T19:00:00Z"), TUESDAY_SESSION, 20)).toBe(true); // lundi 20h
    expect(isReminderDue(new Date("2026-11-02T21:00:00Z"), TUESDAY_SESSION, 20)).toBe(true); // rattrapage 22h
  });
  it("n'envoie ni l'avant-veille ni le jour J", () => {
    expect(isReminderDue(new Date("2026-11-01T19:00:00Z"), TUESDAY_SESSION, 20)).toBe(false);
    expect(isReminderDue(new Date("2026-11-03T08:00:00Z"), TUESDAY_SESSION, 20)).toBe(false);
  });
  it("gère l'heure d'été", () => {
    expect(isReminderDue(new Date("2027-06-21T18:00:00Z"), "2027-06-22T18:00:00.000Z", 20)).toBe(true);
    expect(isReminderDue(new Date("2027-06-21T17:00:00Z"), "2027-06-22T18:00:00.000Z", 20)).toBe(false);
  });
});

describe("isClosureDue", () => {
  it("clôt à 12h heure de Paris le jour J", () => {
    expect(isClosureDue(new Date("2026-11-03T10:59:00Z"), TUESDAY_SESSION)).toBe(false);
    expect(isClosureDue(new Date("2026-11-03T11:00:00Z"), TUESDAY_SESSION)).toBe(true);
  });
});

describe("reminderAudience", () => {
  it("demande aux non-répondants, rappelle aux présents, rien aux absents", () => {
    const answers = new Map([
      ["present", true],
      ["absent", false],
    ]);
    expect(reminderAudience(["present", "absent", "silent"], answers)).toEqual([
      { memberId: "present", kind: "remind" },
      { memberId: "silent", kind: "ask" },
    ]);
  });
});

describe("messages", () => {
  it("formule la demande et le rappel", () => {
    expect(reminderMessage("ask", 0).body).toBe("Tu viens ? Réponds avant 12h demain.");
    expect(reminderMessage("remind", 1).body).toBe("20h–22h · 1 inscrit pour l'instant.");
    expect(reminderMessage("remind", 14).body).toBe("20h–22h · 14 inscrits pour l'instant.");
  });
  it("annonce la compo au Bureau", () => {
    expect(closureMessage(13, 2)).toEqual({
      title: "Compo prête pour ce soir",
      body: "13 présents, 2 terrains.",
      url: "/bureau/compo",
    });
    expect(closureMessage(9, 1, 2).body).toBe("9 présents, 1 terrain. 2 points d'attention.");
  });
});


describe("isMatchReminderDue", () => {
  // Jeudi 5 novembre 2026 20h Paris.
  const MATCH = "2026-11-05T19:00:00.000Z";
  it("envoie 2 jours avant, à partir de l'heure réglée", () => {
    expect(isMatchReminderDue(new Date("2026-11-03T18:59:00Z"), MATCH, 20)).toBe(false);
    expect(isMatchReminderDue(new Date("2026-11-03T19:00:00Z"), MATCH, 20)).toBe(true);
    expect(isMatchReminderDue(new Date("2026-11-04T19:00:00Z"), MATCH, 20)).toBe(false); // J-1
  });
});

describe("matchMessage", () => {
  it("décrit un match à l'extérieur", () => {
    const msg = matchMessage({
      startsAt: "2026-11-04T19:30:00.000Z", teamName: "Les Bras Cassés", opponent: "ASVG/Vachatak",
      isHome: false, venue: "Halle des Sports Patrice CANAYER", city: "Gigean",
    });
    expect(msg.title).toBe("🏐 Match mercredi 20:30 · Les Bras Cassés");
    expect(msg.body).toBe("Contre ASVG/Vachatak. À l'extérieur : Halle des Sports Patrice CANAYER, Gigean.");
  });
  it("décrit un match à domicile", () => {
    const msg = matchMessage({
      startsAt: "2026-11-03T19:00:00.000Z", teamName: "Les St Loup", opponent: "MHSC/BEES",
      isHome: true, venue: null, city: null,
    });
    expect(msg.body).toBe("Contre MHSC/BEES. À domicile.");
  });
});

describe("reinforcementAudience", () => {
  const members = [
    { id: "cap", sex: "M" as const, team_ids: ["t1"], notify_reinforcement: true },
    { id: "coequipiere", sex: "F" as const, team_ids: ["t1"], notify_reinforcement: true },
    { id: "double-equipe", sex: "F" as const, team_ids: ["t2", "t1"], notify_reinforcement: true },
    { id: "f-autre", sex: "F" as const, team_ids: ["t2"], notify_reinforcement: true },
    { id: "f-sans-equipe", sex: "F" as const, team_ids: [], notify_reinforcement: true },
    { id: "f-desactive", sex: "F" as const, team_ids: [], notify_reinforcement: false },
    { id: "m-autre", sex: "M" as const, team_ids: ["t2"], notify_reinforcement: true },
  ];
  it("vise les adhérents hors équipe (même en double équipe), du sexe demandé, ayant activé les renforts", () => {
    const ids = reinforcementAudience(members, { teamId: "t1", sex: "F", captainId: "cap" }).map((m) => m.id);
    expect(ids).toEqual(["f-autre", "f-sans-equipe"]);
  });
  it("sans sexe demandé : tout le monde hors équipe", () => {
    const ids = reinforcementAudience(members, { teamId: "t1", sex: null, captainId: "cap" }).map((m) => m.id);
    expect(ids).toEqual(["f-autre", "f-sans-equipe", "m-autre"]);
  });
});

describe("messages de renfort", () => {
  it("décrit le profil recherché", () => {
    expect(wantedLabel("F", "setter")).toBe("une joueuse au poste de passeur·se");
    expect(wantedLabel("M", "front")).toBe("un joueur au poste d'avant");
    expect(wantedLabel(null, "back")).toBe("un·e joueur·se au poste de fond");
    expect(wantedLabel(null, null)).toBe("un·e joueur·se");
  });
  it("annonce la demande et les propositions", () => {
    const msg = reinforcementMessage({
      teamName: "Les St Loup", matchStartsAt: "2026-11-10T19:00:00.000Z", sex: "F", position: null,
    });
    expect(msg.title).toBe("🙋 Renfort recherché · Les St Loup");
    expect(msg.body).toBe("Une joueuse pour le match du mardi 10 novembre à 20:00. Tu peux aider ?");
    expect(offerMessage("Eve Martin", "Les St Loup").body).toBe("Eve Martin propose son aide à Les St Loup.");
  });
});

describe("matchPollMessage", () => {
  it("demande la dispo de l'équipe et ouvre le match", () => {
    const msg = matchPollMessage({ id: "m1", startsAt: "2026-11-10T19:00:00.000Z", teamName: "Les St Loup", opponent: "CLAPIERS/Spike Tyson" });
    expect(msg).toEqual({
      title: "📋 Les St Loup : es-tu dispo ?",
      body: "Match du mardi 10 novembre à 20:00 contre CLAPIERS/Spike Tyson. Réponds dans l'appli.",
      url: "/matchs/m1",
    });
  });
});

describe("messages de report", () => {
  const r = {
    matchId: "m1", teamName: "Les St Loup", opponent: "MHSC/BEES",
    matchStartsAt: "2026-11-03T19:00:00.000Z", slotStartsAt: "2026-11-26T19:00:00.000Z",
  };
  it("prévient le Bureau d'une demande", () => {
    expect(rescheduleRequestedMessage(r)).toEqual({
      title: "📅 Demande de report · Les St Loup",
      body: "Match contre MHSC/BEES du mardi 3 novembre → créneau du jeudi 26 novembre demandé.",
      url: "/bureau/reports",
    });
  });
  it("informe les capitaines de la décision", () => {
    expect(rescheduleDecisionMessage(r, "approved").title).toBe("✅ Report : créneau pré-réservé · Les St Loup");
    expect(rescheduleDecisionMessage(r, "abandoned", "expired").body).toBe(
      "Report non confirmé à J-3 : le créneau du jeudi 26 novembre est libéré (match contre MHSC/BEES).",
    );
    expect(rescheduleDecisionMessage(r, "confirmed").url).toBe("/matchs/m1");
  });
});

describe("announcementMessage", () => {
  it("reprend le titre, le texte et l'auteur", () => {
    expect(announcementMessage({ id: "a1", title: "Gymnase fermé", body: "Pas d'entraînement\njeudi.", author: "Benjamin Recoules" })).toEqual({
      title: "📣 Gymnase fermé",
      body: "Pas d'entraînement jeudi. — Benjamin Recoules",
      url: "/annonces#a1",
    });
  });
  it("tronque les messages longs", () => {
    const msg = announcementMessage({ id: "a2", title: "T", body: "x ".repeat(400), author: null });
    expect(msg.body.length).toBeLessThanOrEqual(280);
    expect(msg.body.endsWith("…")).toBe(true);
  });
});

describe("eventMessage", () => {
  it("annonce l'événement avec date et lieu", () => {
    expect(eventMessage({ id: "e1", title: "Repas de fin d'année", startsAt: "2026-12-12T18:30:00.000Z", location: "Salle des fêtes" })).toEqual({
      title: "🎉 Repas de fin d'année",
      body: "samedi 12 décembre à 19:30 · Salle des fêtes. Infos et réponse dans l'appli.",
      url: "/evenements/e1",
    });
  });
});
