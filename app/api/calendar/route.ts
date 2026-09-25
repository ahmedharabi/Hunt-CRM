import { getDb } from "@/db/client";
import { buildIcs, type IcsEvent } from "@/lib/ics";
import { INTERVIEW_STAGE_META, ACTIVITY_META } from "@/lib/meta";
import type { ActivityType, InterviewStage } from "@/lib/domain";

export const dynamic = "force-dynamic";

/** Interviews, deadlines and follow-ups from the last 30 days onward, as .ics. */
export function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const sqlite = getDb().$client;
  const since = Date.now() - 30 * 86_400_000;
  const events: IcsEvent[] = [];

  const interviews = sqlite
    .prepare(
      `select i.id, i.stage, i.scheduled_at as at, i.duration_minutes as mins, i.prep_notes as prep, o.id as oppId, o.title, c.name as company
       from interviews i join opportunities o on o.id = i.opportunity_id join companies c on c.id = o.company_id
       where i.deleted_at is null and i.outcome != 'cancelled' and i.scheduled_at >= ?`,
    )
    .all(since) as { id: number; stage: InterviewStage; at: number; mins: number; prep: string | null; oppId: number; title: string; company: string }[];
  for (const i of interviews) {
    events.push({
      uid: `interview-${i.id}`,
      start: new Date(i.at),
      end: new Date(i.at + i.mins * 60_000),
      title: `${INTERVIEW_STAGE_META[i.stage].label} · ${i.company}`,
      description: [i.title, i.prep].filter(Boolean).join("\n\n"),
      url: `${origin}/opportunities/${i.oppId}`,
    });
  }

  const deadlines = sqlite
    .prepare(
      `select o.id, o.title, o.deadline, c.name as company from opportunities o join companies c on c.id = o.company_id
       where o.deleted_at is null and o.deadline >= ? and o.status in ('wishlist','applied','screening','interviewing','offer')`,
    )
    .all(since) as { id: number; title: string; deadline: number; company: string }[];
  for (const d of deadlines) {
    events.push({
      uid: `deadline-${d.id}`,
      start: new Date(d.deadline),
      allDay: true,
      title: `Deadline: ${d.title} · ${d.company}`,
      url: `${origin}/opportunities/${d.id}`,
    });
  }

  const followUps = sqlite
    .prepare(
      `select a.id, a.type, a.follow_up_due_at as due, c.name as company, p.name as contact
       from activities a left join companies c on c.id = a.company_id left join contacts p on p.id = a.contact_id
       where a.deleted_at is null and a.outcome = 'pending' and a.follow_up_due_at >= ?`,
    )
    .all(since) as { id: number; type: ActivityType; due: number; company: string | null; contact: string | null }[];
  for (const f of followUps) {
    events.push({
      uid: `followup-${f.id}`,
      start: new Date(f.due),
      allDay: true,
      title: `Follow up: ${f.contact ?? f.company ?? "thread"}`,
      description: `${ACTIVITY_META[f.type].label}${f.company ? ` · ${f.company}` : ""}`,
      url: `${origin}/follow-ups`,
    });
  }

  return new Response(buildIcs(events), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'attachment; filename="hunt.ics"',
    },
  });
}
