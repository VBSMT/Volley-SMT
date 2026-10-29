import { describe, expect, it } from "vitest";
import { isAllowedPushEndpoint } from "./push";

describe("adresses d'abonnement push", () => {
  it("accepte les services des navigateurs", () => {
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://web.push.apple.com/QW1")).toBe(true);
    expect(isAllowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/x")).toBe(true);
    expect(isAllowedPushEndpoint("https://wns2-par02p.notify.windows.com/w/?token=x")).toBe(true);
  });
  it("refuse toute autre adresse", () => {
    expect(isAllowedPushEndpoint("https://exemple.fr/hook")).toBe(false);
    expect(isAllowedPushEndpoint("http://fcm.googleapis.com/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com.exemple.fr/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com:8443/x")).toBe(false);
    expect(isAllowedPushEndpoint("pas une url")).toBe(false);
  });
});
