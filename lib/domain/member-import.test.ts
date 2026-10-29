import { describe, expect, it } from "vitest";
import { parseCsv, parseMemberSheet } from "./member-import";

const TEAMS = ["Les St Loup", "Totally Spike"];

describe("parseCsv", () => {
  it("détecte le point-virgule (Excel français) et gère les guillemets", () => {
    expect(parseCsv('nom;prenom\r\nMartin;"Julie ""Ju"""\r\n')).toEqual([
      ["nom", "prenom"],
      ["Martin", 'Julie "Ju"'],
    ]);
  });
  it("accepte la virgule et retire le BOM", () => {
    expect(parseCsv("﻿nom,prenom\nMartin,Julie")).toEqual([["nom", "prenom"], ["Martin", "Julie"]]);
  });
});

describe("parseMemberSheet", () => {
  const header = ["Nom", "Prénom", "E-mail", "Sexe", "Équipe", "Capitaine", "Rôles", "Téléphone", "Licence", "Cotisation", "Niveau"];

  it("lit une ligne complète", () => {
    const { members, errors } = parseMemberSheet(
      [header, ["Martin", "Julie", "Julie.Martin@Mail.fr ", "f", "les st loup", "oui", "Bureau, bénévole", "06 12 34 56 78", "34-1", "oui", "3"]],
      TEAMS,
    );
    expect(errors).toEqual([]);
    expect(members[0]).toEqual({
      line: 2, email: "julie.martin@mail.fr", lastName: "Martin", firstName: "Julie", sex: "F",
      team: "Les St Loup", captain: true, roles: ["board", "volunteer"], phone: "06 12 34 56 78",
      license: "34-1", duesPaid: true, level: 3,
    });
  });

  it("se contente des colonnes obligatoires", () => {
    const { members } = parseMemberSheet([["prenom", "nom", "email", "sexe"], ["Paul", "Durand", "p@d.fr", "H"]], TEAMS);
    expect(members[0]).toMatchObject({ firstName: "Paul", sex: "M", team: null, roles: [], duesPaid: null, level: null });
  });

  it("accepte le nom d'équipe avec préfixe SMDT/", () => {
    const { members } = parseMemberSheet([["nom", "prenom", "email", "sexe", "equipe"], ["A", "B", "a@b.fr", "F", "SMDT/Totally Spike"]], TEAMS);
    expect(members[0].team).toBe("Totally Spike");
  });

  it("signale les colonnes obligatoires manquantes", () => {
    expect(parseMemberSheet([["nom", "email"]], TEAMS).errors[0]).toMatch(/« prenom », « sexe »/);
  });

  it("signale chaque ligne invalide et ignore les lignes vides", () => {
    const { members, errors } = parseMemberSheet(
      [
        header,
        ["Martin", "Julie", "pas-un-email", "X", "Inconnue", "oui", "chef", "", "", "peut-être", "7"],
        header.map(() => ""),
        ["Durand", "Paul", "p@d.fr", "M", "", "oui", "", "", "", "", ""],
        ["Durand", "Paula", "P@D.fr", "F", "", "", "", "", "", "", ""],
      ],
      TEAMS,
    );
    expect(members).toHaveLength(0);
    expect(errors).toEqual([
      "Ligne 2 : email invalide, sexe invalide (F ou M), équipe inconnue « Inconnue », rôles : bureau et/ou benevole, cotisation : oui ou non, niveau : 1 à 5.",
      "Ligne 4 : capitaine sans équipe.",
      "Ligne 5 : email déjà présent ligne 4.",
    ]);
  });
});
