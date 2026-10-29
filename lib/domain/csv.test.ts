import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("produit un CSV Excel français (BOM, ;, CRLF)", () => {
    expect(toCsv(["nom", "cotisation"], [["Martin", true], ["Durand", false]])).toBe("﻿nom;cotisation\r\nMartin;oui\r\nDurand;non\r\n");
  });
  it("met entre guillemets les valeurs avec ; guillemet ou retour à la ligne", () => {
    expect(toCsv(["a"], [['Les "Yoyos"; mixte']])).toBe('﻿a\r\n"Les ""Yoyos""; mixte"\r\n');
  });
  it("neutralise les formules mais garde les nombres négatifs", () => {
    expect(toCsv(["a", "b"], [["=SOMME(A1)", "-3"]])).toBe("﻿a;b\r\n'=SOMME(A1);-3\r\n");
  });
  it("laisse vide les valeurs nulles", () => {
    expect(toCsv(["a", "b"], [[null, undefined]])).toBe("﻿a;b\r\n;\r\n");
  });
});
