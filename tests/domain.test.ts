import { describe, expect, it } from "vitest";
import { canTransition, isTerminal, OPPORTUNITY_STATUSES, STATUS_TRANSITIONS } from "@/lib/domain";
import { dayKey, relativeShort, startOfDayTz, startOfWeekTz } from "@/lib/dates";

describe("status transitions", () => {
  it("covers every status and never allows a self-transition", () => {
    for (const s of OPPORTUNITY_STATUSES) {
      expect(STATUS_TRANSITIONS[s]).toBeDefined();
      expect(canTransition(s, s)).toBe(false);
    }
  });

  it("allows forward moves and closing, and reopening a ghosted thread", () => {
    expect(canTransition("applied", "screening")).toBe(true);
    expect(canTransition("interviewing", "rejected")).toBe(true);
    expect(canTransition("ghosted", "screening")).toBe(true);
    expect(canTransition("accepted", "applied")).toBe(false);
    expect(canTransition("wishlist", "offer")).toBe(false);
  });

  it("classifies terminal statuses", () => {
    expect(isTerminal("ghosted")).toBe(true);
    expect(isTerminal("offer")).toBe(false);
  });
});

describe("timezone-aware dates", () => {
  const tz = "Africa/Tunis"; // UTC+1, no DST

  it("buckets by the local calendar day, not UTC", () => {
    // 23:30 UTC on the 24th is already the 25th in Tunis.
    expect(dayKey(new Date("2026-09-24T23:30:00Z"), tz)).toBe("2026-09-25");
    expect(startOfDayTz(new Date("2026-09-24T23:30:00Z"), tz).toISOString()).toBe("2026-09-24T23:00:00.000Z");
  });

  it("finds the start of the week for a configurable first day", () => {
    const thu = new Date("2026-09-24T10:00:00Z");
    expect(startOfWeekTz(thu, tz, 1).toISOString()).toBe("2026-09-20T23:00:00.000Z"); // Monday
    expect(startOfWeekTz(thu, tz, 0).toISOString()).toBe("2026-09-19T23:00:00.000Z"); // Sunday
  });

  it("formats relative labels deterministically", () => {
    const now = new Date("2026-09-24T12:00:00Z");
    expect(relativeShort(new Date("2026-09-24T11:58:30Z"), now, tz)).toBe("1m ago");
    expect(relativeShort(new Date("2026-09-23T09:00:00Z"), now, tz)).toBe("Yesterday");
    expect(relativeShort(new Date("2026-08-02T09:00:00Z"), now, tz)).toBe("Aug 2");
  });
});

import { fillTemplate, varsFor, variablesIn } from "@/lib/templates";

describe("templates", () => {
  it("fills known variables and reports missing ones", () => {
    const vars = varsFor({ contactName: "Sarah Ben Ali", company: "Koyeb", role: null });
    const r = fillTemplate("Hi {{first_name}}, {{ company }} is great. Re: {{role}}", vars);
    expect(r.text).toBe("Hi Sarah, Koyeb is great. Re: {{role}}");
    expect(r.missing).toEqual(["role"]);
    expect(vars.last_name).toBe("Ben Ali");
    expect(variablesIn("{{a}} {{b}} {{a}}")).toEqual(["a", "b"]);
  });
});
