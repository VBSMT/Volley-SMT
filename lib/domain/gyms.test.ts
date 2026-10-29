import { describe, expect, it } from "vitest";
import { directionsUrl, findGym, parseGps, parseGyms } from "./gyms";

const json = JSON.stringify([
  { GymnaseCode: "BOIRARGUES_PALAIS", Nom: "Palais des Sports de Boirargues", Adresse: "13 rue du Merlot", CP: "34970", Ville: "Lattes", GPS: "43.58962691620008|3.9195008663032334", NomComplet: "Palais des Sports de Boirargues (Lattes)" },
  { GymnaseCode: "CASTELNAU_JM", Nom: "Gymnase Jean MOULIN", Adresse: "320 Chemin des Mendrous", CP: "34170", Ville: "Castelnau-le-Lez", GPS: "43,636091|3,916581", NomComplet: "Gymnase Jean MOULIN (Castelnau-le-Lez)" },
  { GymnaseCode: "GRABELS_SALLE_POLYV", Nom: "Salle Polyvalente", Ville: "Grabels", GPS: "43.645538|3.801639", NomComplet: "Salle Polyvalente (Grabels)" },
  { GymnaseCode: "VAILHAUQUES_SALLE_POLYV", Nom: "Salle Polyvalente", Adresse: "", Ville: "Vailhauquès", GPS: "43.669099|3.717802", NomComplet: "Salle Polyvalente (Vailhauquès)" },
  { GymnaseCode: "SMTP_HALLE_SPORTS", Nom: "Halle des Sports - Les Champs Noirs", Ville: "St Mathieu de Tréviers", GPS: "43.762333|3.860752", NomComplet: "Halle des Sports - Les Champs Noirs (St Mathieu de T.)" },
  { GymnaseCode: "SANS_GPS", Nom: "Gymnase X", Adresse: "1 rue Y", CP: "34000", Ville: "Montpellier", GPS: "" },
]);
const gyms = parseGyms(json);

describe("gymnases volley34", () => {
  it("lit les coordonnées, y compris avec virgule décimale", () => {
    expect(parseGps("43,636091|3,916581")).toEqual({ lat: 43.636091, lon: 3.916581 });
    expect(parseGps("")).toBeNull();
    expect(gyms).toHaveLength(6);
    expect(gyms[3].address).toBeNull();
  });

  it("retrouve le gymnase d'un lieu ICS", () => {
    expect(findGym("Palais des Sports de Boirargues", "Lattes", gyms)?.code).toBe("BOIRARGUES_PALAIS");
    expect(findGym("Salle Polyvalente", "Vailhauquès", gyms)?.code).toBe("VAILHAUQUES_SALLE_POLYV");
    expect(findGym("Halle des Sports - Les Champs Noirs", "St Mathieu de T.", gyms)?.code).toBe("SMTP_HALLE_SPORTS");
    expect(findGym("Gymnase Jean Moulin", "Castelnau le Lez", gyms)?.code).toBe("CASTELNAU_JM");
    expect(findGym("Salle Polyvalente", "Inconnue", gyms)).toBeNull();
    expect(findGym(null, null, gyms)).toBeNull();
  });

  it("construit le lien d'itinéraire", () => {
    expect(directionsUrl("Palais des Sports de Boirargues", "Lattes", gyms[0])).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=43.58962691620008%2C3.9195008663032334",
    );
    expect(directionsUrl("Gymnase X", null, gyms[5])).toContain(encodeURIComponent("Gymnase X, 1 rue Y, 34000, Montpellier"));
    expect(directionsUrl("Salle Z", "Sète", null)).toContain(encodeURIComponent("Salle Z, Sète"));
    expect(directionsUrl(null, null, null)).toBeNull();
  });
});
