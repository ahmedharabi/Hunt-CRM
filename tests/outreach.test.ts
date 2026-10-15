import { describe, expect, it } from "vitest";
import { buildPerson, buildThreads, personStage, type OutreachActivity } from "@/lib/outreach";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 15);
let nextId = 1;

function act(over: Partial<OutreachActivity>): OutreachActivity {
  return {
    id: nextId++,
    at: NOW - 10 * DAY,
    type: "linkedin_dm",
    direction: "outbound",
    outcome: "pending",
    subject: null,
    summary: null,
    parentActivityId: null,
    followUpDueAt: null,
    companyId: 1,
    contactId: 1,
    opportunityId: null,
    ...over,
  };
}

const person = { id: 1, name: "Sarah", role: "Recruiter", contactType: null, linkedinUrl: null, email: null };
const stageOf = (acts: OutreachActivity[]) => personStage(buildThreads(acts));

describe("outreach threads", () => {
  it("nests follow-ups and replies under the message that started them", () => {
    const dm = act({ at: NOW - 5 * DAY });
    const followUp = act({ type: "follow_up", parentActivityId: dm.id, at: NOW - 2 * DAY });
    const reply = act({ direction: "inbound", outcome: "replied", parentActivityId: dm.id, at: NOW - DAY });
    const invite = act({ type: "linkedin_connection", at: NOW - 9 * DAY });
    const threads = buildThreads([reply, invite, dm, followUp]);
    expect(threads.map((t) => t.root.id)).toEqual([dm.id, invite.id]);
    expect(threads[0].children.map((c) => c.id)).toEqual([followUp.id, reply.id]);
  });
});

describe("person stage", () => {
  it("walks invited → connected → messaged → replied → talking", () => {
    expect(stageOf([])).toBe("new");
    const invite = act({ type: "linkedin_connection" });
    expect(stageOf([invite])).toBe("invited");
    const accepted = { ...invite, outcome: "replied" as const };
    expect(stageOf([accepted])).toBe("connected");
    const dm = act({});
    expect(stageOf([accepted, dm])).toBe("messaged");
    expect(stageOf([accepted, { ...dm, outcome: "replied" }])).toBe("replied");
    expect(stageOf([accepted, { ...dm, outcome: "positive" }])).toBe("talking");
    expect(stageOf([accepted, dm, act({ type: "call" })])).toBe("talking");
  });

  it("treats an inbound reply in a thread as replied, and ignores notes", () => {
    const email = act({ type: "cold_email" });
    expect(stageOf([email, act({ direction: "inbound", parentActivityId: email.id, outcome: "replied" })])).toBe("replied");
    expect(stageOf([act({ type: "note" })])).toBe("new");
  });

  it("counts them inviting you as connected", () => {
    expect(stageOf([act({ type: "linkedin_connection", direction: "inbound", outcome: "replied" })])).toBe("connected");
  });
});

describe("next action", () => {
  it("asks for a follow-up once the reminder is due", () => {
    const dm = act({ followUpDueAt: NOW - DAY });
    const p = buildPerson(person, [dm], NOW);
    expect(p.next).toBe("follow_up");
    expect(p.followUpDueAt).toBe(NOW - DAY);
  });

  it("asks for a first message once an invite is accepted", () => {
    const p = buildPerson(person, [act({ type: "linkedin_connection", outcome: "replied" })], NOW);
    expect(p.next).toBe("send_message");
  });

  it("is quiet while waiting on a reply with no reminder due", () => {
    const p = buildPerson(person, [act({ followUpDueAt: NOW + 3 * DAY })], NOW);
    expect(p.next).toBeNull();
    expect(p.followUpDueAt).toBe(NOW + 3 * DAY);
  });
});
