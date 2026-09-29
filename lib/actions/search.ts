"use server";

import { z } from "zod";
import { getDb } from "@/db/client";
import { run } from "./run";

export type SearchHit = {
  kind: "company" | "contact" | "opportunity" | "activity" | "interview" | "template" | "note";
  id: number;
  title: string;
  snippet: string;
  href: string;
  subtitle: string | null;
};

/** Turn free text into a safe FTS5 prefix query: `kube ops` → `"kube"* "ops"*`. */
function toFtsQuery(q: string) {
  return q
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .map((t) => `"${t}"*`)
    .join(" ");
}

export async function globalSearch(query: string) {
  return run(
    () => {
      const q = toFtsQuery(z.string().max(200).parse(query));
      if (!q) return [] as SearchHit[];
      const rows = getDb()
        .$client.prepare(
          `select si.kind, si.ref_id as id, si.title,
             snippet(search_index, 3, '«', '»', '…', 12) as snippet,
             case si.kind
               when 'company' then (select industry from companies where id = si.ref_id)
               when 'contact' then (select c.name from contacts p left join companies c on c.id = p.company_id where p.id = si.ref_id)
               when 'opportunity' then (select c.name from opportunities o join companies c on c.id = o.company_id where o.id = si.ref_id)
               when 'activity' then (select c.name from activities a left join companies c on c.id = a.company_id where a.id = si.ref_id)
               when 'interview' then (select c.name from interviews i join opportunities o on o.id = i.opportunity_id join companies c on c.id = o.company_id where i.id = si.ref_id)
               else null end as subtitle,
             case si.kind
               when 'activity' then (select coalesce(a.opportunity_id, -1) || ':' || coalesce(a.company_id, -1) from activities a where a.id = si.ref_id)
               when 'interview' then (select opportunity_id from interviews where id = si.ref_id)
               else null end as link
           from search_index si
           where search_index match @q
             and case si.kind
               when 'company' then exists(select 1 from companies where id = si.ref_id and deleted_at is null)
               when 'contact' then exists(select 1 from contacts where id = si.ref_id and deleted_at is null)
               when 'opportunity' then exists(select 1 from opportunities where id = si.ref_id and deleted_at is null)
               when 'activity' then exists(select 1 from activities where id = si.ref_id and deleted_at is null)
               when 'interview' then exists(select 1 from interviews where id = si.ref_id and deleted_at is null)
               when 'template' then exists(select 1 from templates where id = si.ref_id and deleted_at is null)
               when 'note' then exists(select 1 from notes where id = si.ref_id and deleted_at is null)
             end
           order by case si.kind when 'company' then 0 when 'opportunity' then 1 when 'contact' then 2 else 3 end, rank
           limit 30`,
        )
        .all({ q }) as (Omit<SearchHit, "href"> & { link: string | number | null })[];

      return rows.map(({ link, ...r }): SearchHit => {
        let href = "/";
        if (r.kind === "company") href = `/companies/${r.id}`;
        else if (r.kind === "contact") href = `/contacts/${r.id}`;
        else if (r.kind === "opportunity") href = `/opportunities/${r.id}`;
        else if (r.kind === "interview") href = `/opportunities/${link}`;
        else if (r.kind === "template") href = `/templates`;
        else if (r.kind === "note") href = `/notes/${r.id}`;
        else if (r.kind === "activity") {
          const [opp, company] = String(link).split(":").map(Number);
          href = opp > 0 ? `/opportunities/${opp}` : company > 0 ? `/companies/${company}` : "/activities";
        }
        return { ...r, href };
      });
    },
    { revalidate: false },
  );
}
