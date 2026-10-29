import { describe, expect, it } from "vitest";
import { DEFAULT_SCHEDULE, parseSchedule, scheduleToSettings } from "./settings";

describe("parseSchedule", () => {
  it("lit les réglages enregistrés", () => {
    expect(
      parseSchedule([
        { key: "poll_reminder", value: { days_before: 1, time: "19:00" } },
        { key: "poll_close_time", value: "11:00" },
        { key: "reschedule_expiry_days", value: 2 },
      ]),
    ).toEqual({ reminderHour: 19, closeHour: 11, expiryDays: 2 });
  });
  it("revient aux valeurs par défaut si absent ou hors limites", () => {
    expect(parseSchedule([])).toEqual(DEFAULT_SCHEDULE);
    expect(parseSchedule([{ key: "poll_close_time", value: "23:00" }, { key: "reschedule_expiry_days", value: "x" }])).toEqual(DEFAULT_SCHEDULE);
  });
  it("fait l'aller-retour avec scheduleToSettings", () => {
    const s = { reminderHour: 18, closeHour: 10, expiryDays: 5 };
    expect(parseSchedule(scheduleToSettings(s))).toEqual(s);
  });
});
