import { and, eq, inArray, sql } from "drizzle-orm";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import type { DB } from "./client";
import * as s from "./schema";
import {
  ACTIVE_STATUSES,
  DEFAULT_FOLLOW_UP_RULES,
  type ActivityType,
  type Channel,
  type ContactType,
  type OpportunitySource,
  type OpportunityStatus,
  type InterviewStage,
} from "@/lib/domain";

/* ───────────── deterministic randomness so every seed looks the same ───────────── */

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = ReturnType<typeof mulberry32>;
const pick = <T,>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
const int = (r: Rng, min: number, max: number) => min + Math.floor(r() * (max - min + 1));
const chance = (r: Rng, p: number) => r() < p;

/* ───────────────────────────── source data ───────────────────────────── */

type SeedCompany = {
  name: string;
  domain: string;
  industry: string;
  size: s.Company["size"];
  hq: string;
  country: string;
  tz: string;
  remote: s.Company["remotePolicy"];
  stack: string[];
  tier: s.Company["tier"];
  tags: string[];
};

const COMPANIES: SeedCompany[] = [
  { name: "Grafana Labs", domain: "grafana.com", industry: "Observability", size: "1000+", hq: "New York", country: "United States", tz: "America/New_York", remote: "remote", stack: ["Go", "TypeScript", "Kubernetes"], tier: "dream", tags: ["open-source", "remote-first"] },
  { name: "Isovalent", domain: "isovalent.com", industry: "Cloud Networking", size: "201-1000", hq: "Zurich", country: "Switzerland", tz: "Europe/Zurich", remote: "remote", stack: ["Go", "eBPF", "Kubernetes"], tier: "dream", tags: ["open-source", "cncf"] },
  { name: "Tailscale", domain: "tailscale.com", industry: "Networking", size: "201-1000", hq: "Toronto", country: "Canada", tz: "America/Toronto", remote: "remote", stack: ["Go", "WireGuard"], tier: "dream", tags: ["remote-first"] },
  { name: "Fly.io", domain: "fly.io", industry: "Cloud Platform", size: "51-200", hq: "Chicago", country: "United States", tz: "America/Chicago", remote: "remote", stack: ["Rust", "Go", "Elixir"], tier: "dream", tags: ["remote-first"] },
  { name: "HashiCorp", domain: "hashicorp.com", industry: "Infrastructure", size: "1000+", hq: "San Francisco", country: "United States", tz: "America/Los_Angeles", remote: "remote", stack: ["Go", "Terraform"], tier: "dream", tags: ["open-source"] },
  { name: "Kong", domain: "konghq.com", industry: "API Gateway", size: "201-1000", hq: "San Francisco", country: "United States", tz: "America/Los_Angeles", remote: "hybrid", stack: ["Lua", "Go", "Kubernetes"], tier: "target", tags: ["open-source"] },
  { name: "Traefik Labs", domain: "traefik.io", industry: "Cloud Networking", size: "51-200", hq: "Lyon", country: "France", tz: "Europe/Paris", remote: "remote", stack: ["Go", "Kubernetes"], tier: "target", tags: ["open-source", "europe"] },
  { name: "Scaleway", domain: "scaleway.com", industry: "Cloud Provider", size: "201-1000", hq: "Paris", country: "France", tz: "Europe/Paris", remote: "hybrid", stack: ["Go", "Python", "Kubernetes"], tier: "target", tags: ["europe"] },
  { name: "OVHcloud", domain: "ovhcloud.com", industry: "Cloud Provider", size: "1000+", hq: "Roubaix", country: "France", tz: "Europe/Paris", remote: "hybrid", stack: ["Go", "Python", "OpenStack"], tier: "target", tags: ["europe"] },
  { name: "Clever Cloud", domain: "clever-cloud.com", industry: "Cloud Platform", size: "51-200", hq: "Nantes", country: "France", tz: "Europe/Paris", remote: "remote", stack: ["Rust", "Scala"], tier: "target", tags: ["europe"] },
  { name: "Aiven", domain: "aiven.io", industry: "Data Infrastructure", size: "201-1000", hq: "Helsinki", country: "Finland", tz: "Europe/Helsinki", remote: "hybrid", stack: ["Python", "Go", "Kafka"], tier: "target", tags: ["europe"] },
  { name: "Upbound", domain: "upbound.io", industry: "Infrastructure", size: "51-200", hq: "Seattle", country: "United States", tz: "America/Los_Angeles", remote: "remote", stack: ["Go", "Kubernetes", "Crossplane"], tier: "dream", tags: ["cncf", "open-source"] },
  { name: "Kubermatic", domain: "kubermatic.com", industry: "Kubernetes Platform", size: "51-200", hq: "Hamburg", country: "Germany", tz: "Europe/Berlin", remote: "remote", stack: ["Go", "Kubernetes"], tier: "target", tags: ["cncf", "europe"] },
  { name: "Giant Swarm", domain: "giantswarm.io", industry: "Kubernetes Platform", size: "51-200", hq: "Cologne", country: "Germany", tz: "Europe/Berlin", remote: "remote", stack: ["Go", "Kubernetes", "Helm"], tier: "dream", tags: ["remote-first", "europe"] },
  { name: "Kinvolk", domain: "kinvolk.io", industry: "Linux & Containers", size: "11-50", hq: "Berlin", country: "Germany", tz: "Europe/Berlin", remote: "remote", stack: ["Go", "Linux"], tier: "target", tags: ["open-source", "europe"] },
  { name: "Northflank", domain: "northflank.com", industry: "Cloud Platform", size: "11-50", hq: "London", country: "United Kingdom", tz: "Europe/London", remote: "remote", stack: ["TypeScript", "Kubernetes"], tier: "target", tags: ["europe"] },
  { name: "Koyeb", domain: "koyeb.com", industry: "Cloud Platform", size: "11-50", hq: "Paris", country: "France", tz: "Europe/Paris", remote: "remote", stack: ["Go", "Firecracker"], tier: "dream", tags: ["europe", "yc"] },
  { name: "Qovery", domain: "qovery.com", industry: "DevOps Platform", size: "11-50", hq: "Paris", country: "France", tz: "Europe/Paris", remote: "remote", stack: ["Rust", "Kubernetes", "Terraform"], tier: "target", tags: ["europe", "yc"] },
  { name: "Spacelift", domain: "spacelift.io", industry: "Infrastructure", size: "51-200", hq: "Warsaw", country: "Poland", tz: "Europe/Warsaw", remote: "remote", stack: ["Go", "Terraform"], tier: "target", tags: ["europe"] },
  { name: "env0", domain: "env0.com", industry: "Infrastructure", size: "51-200", hq: "Tel Aviv", country: "Israel", tz: "Asia/Jerusalem", remote: "hybrid", stack: ["TypeScript", "Terraform"], tier: "backup", tags: [] },
  { name: "Pulumi", domain: "pulumi.com", industry: "Infrastructure", size: "51-200", hq: "Seattle", country: "United States", tz: "America/Los_Angeles", remote: "remote", stack: ["Go", "TypeScript"], tier: "target", tags: ["open-source"] },
  { name: "Doppler", domain: "doppler.com", industry: "Security", size: "51-200", hq: "San Francisco", country: "United States", tz: "America/Los_Angeles", remote: "remote", stack: ["Go", "TypeScript"], tier: "backup", tags: ["yc"] },
  { name: "Railway", domain: "railway.com", industry: "Cloud Platform", size: "51-200", hq: "San Francisco", country: "United States", tz: "America/Los_Angeles", remote: "remote", stack: ["Rust", "Go", "TypeScript"], tier: "dream", tags: ["remote-first"] },
  { name: "PlanetScale", domain: "planetscale.com", industry: "Databases", size: "51-200", hq: "San Francisco", country: "United States", tz: "America/Los_Angeles", remote: "remote", stack: ["Go", "Vitess", "MySQL"], tier: "target", tags: ["remote-first"] },
  { name: "Neon", domain: "neon.tech", industry: "Databases", size: "51-200", hq: "San Francisco", country: "United States", tz: "America/Los_Angeles", remote: "remote", stack: ["Rust", "Postgres"], tier: "target", tags: ["open-source", "remote-first"] },
  { name: "Timescale", domain: "timescale.com", industry: "Databases", size: "51-200", hq: "New York", country: "United States", tz: "America/New_York", remote: "remote", stack: ["C", "Go", "Postgres"], tier: "backup", tags: ["open-source"] },
  { name: "Chainguard", domain: "chainguard.dev", industry: "Supply Chain Security", size: "201-1000", hq: "Kirkland", country: "United States", tz: "America/Los_Angeles", remote: "remote", stack: ["Go", "Kubernetes", "Sigstore"], tier: "dream", tags: ["cncf", "remote-first"] },
  { name: "Sysdig", domain: "sysdig.com", industry: "Security", size: "201-1000", hq: "San Francisco", country: "United States", tz: "America/Los_Angeles", remote: "hybrid", stack: ["Go", "C++", "Falco"], tier: "target", tags: ["cncf"] },
  { name: "Solo.io", domain: "solo.io", industry: "Service Mesh", size: "201-1000", hq: "Boston", country: "United States", tz: "America/New_York", remote: "remote", stack: ["Go", "Envoy", "Istio"], tier: "target", tags: ["cncf"] },
  { name: "Buoyant", domain: "buoyant.io", industry: "Service Mesh", size: "11-50", hq: "San Francisco", country: "United States", tz: "America/Los_Angeles", remote: "remote", stack: ["Rust", "Go", "Linkerd"], tier: "dream", tags: ["cncf", "open-source"] },
  { name: "Akuity", domain: "akuity.io", industry: "GitOps", size: "11-50", hq: "San Jose", country: "United States", tz: "America/Los_Angeles", remote: "remote", stack: ["Go", "Argo CD"], tier: "dream", tags: ["cncf"] },
  { name: "Weaveworks", domain: "weave.works", industry: "GitOps", size: "51-200", hq: "London", country: "United Kingdom", tz: "Europe/London", remote: "remote", stack: ["Go", "Flux"], tier: "backup", tags: ["cncf", "europe"] },
  { name: "Mirantis", domain: "mirantis.com", industry: "Kubernetes Platform", size: "1000+", hq: "Campbell", country: "United States", tz: "America/Los_Angeles", remote: "hybrid", stack: ["Go", "Kubernetes", "OpenStack"], tier: "backup", tags: [] },
  { name: "Vonage", domain: "vonage.com", industry: "Communications", size: "1000+", hq: "Holmdel", country: "United States", tz: "America/New_York", remote: "hybrid", stack: ["Java", "Kubernetes"], tier: "backup", tags: [] },
  { name: "InstaDeep", domain: "instadeep.com", industry: "AI", size: "201-1000", hq: "Tunis", country: "Tunisia", tz: "Africa/Tunis", remote: "hybrid", stack: ["Python", "JAX", "Kubernetes"], tier: "dream", tags: ["tunisia"] },
  { name: "Expensya", domain: "expensya.com", industry: "Fintech SaaS", size: "51-200", hq: "Tunis", country: "Tunisia", tz: "Africa/Tunis", remote: "hybrid", stack: [".NET", "Azure"], tier: "target", tags: ["tunisia"] },
  { name: "Vermeg", domain: "vermeg.com", industry: "Fintech", size: "1000+", hq: "Tunis", country: "Tunisia", tz: "Africa/Tunis", remote: "onsite", stack: ["Java", "Angular"], tier: "backup", tags: ["tunisia"] },
  { name: "Sofrecom", domain: "sofrecom.com", industry: "Telecom Consulting", size: "1000+", hq: "Tunis", country: "Tunisia", tz: "Africa/Tunis", remote: "onsite", stack: ["Java", "DevOps"], tier: "backup", tags: ["tunisia"] },
  { name: "Datadog", domain: "datadoghq.com", industry: "Observability", size: "1000+", hq: "New York", country: "United States", tz: "America/New_York", remote: "hybrid", stack: ["Go", "Python", "Kubernetes"], tier: "dream", tags: [] },
  { name: "GitLab", domain: "gitlab.com", industry: "DevOps Platform", size: "1000+", hq: "San Francisco", country: "United States", tz: "America/Los_Angeles", remote: "remote", stack: ["Ruby", "Go", "Kubernetes"], tier: "dream", tags: ["remote-first", "open-source"] },
  { name: "Mitacs Globalink", domain: "mitacs.ca", industry: "Research Program", size: "201-1000", hq: "Vancouver", country: "Canada", tz: "America/Vancouver", remote: "onsite", stack: [], tier: "target", tags: [] },
];

const FIRST_NAMES = ["Sarah", "Lukas", "Amira", "Tom", "Yasmine", "Julien", "Priya", "Marco", "Nadia", "Chris", "Elena", "Omar", "Hannah", "Mehdi", "Sofia", "Daniel", "Ines", "Kenji", "Leila", "Ben", "Clara", "Youssef", "Anna", "Rami", "Mia", "Karim", "Emma", "Pierre", "Salma", "Jonas"];
const LAST_NAMES = ["Schmidt", "Martin", "Ben Ali", "Nguyen", "Dubois", "Kowalski", "Haddad", "Fischer", "Rossi", "Trabelsi", "Andersen", "Mansour", "Laurent", "Chen", "Weber", "Jaziri", "Novak", "Bouazizi", "Keller", "Moreau"];

const ROLES_BY_TYPE: Record<ContactType, string[]> = {
  recruiter: ["Technical Recruiter", "Talent Acquisition Partner", "University Recruiter"],
  engineer: ["Senior Platform Engineer", "Staff SRE", "Backend Engineer", "Software Engineer, Infra"],
  hiring_manager: ["Engineering Manager, Platform", "Head of Infrastructure", "EM, Developer Experience"],
  founder: ["Co-founder & CTO", "Founder & CEO"],
  alumni: ["Software Engineer (INSAT '22)", "DevOps Engineer (ESPRIT alum)"],
  referral: ["Senior Engineer", "Tech Lead"],
};

const TITLES = [
  "Backend Engineering Intern",
  "Platform Engineering Intern",
  "Site Reliability Engineering Intern",
  "DevOps Intern",
  "Cloud Infrastructure Intern",
  "Software Engineer Intern, Kubernetes",
  "Part-time Backend Engineer (Go)",
  "Junior DevOps Engineer (Part-time)",
];

const REJECTION_REASONS = [
  "Position filled internally",
  "Looking for someone further along in studies",
  "Visa / location constraints",
  "Didn't pass technical round",
  "Role put on hold",
];

/* ───────────────────────────── helpers ───────────────────────────── */

const DAY = 86_400_000;

/** A timestamp `daysAgo` days before `now`, at a plausible working hour in Tunis. */
function at(now: Date, daysAgo: number, r: Rng, tz = "Africa/Tunis"): Date {
  const local = toZonedTime(new Date(now.getTime() - daysAgo * DAY), tz);
  local.setHours(int(r, 8, 21), int(r, 0, 59), int(r, 0, 59), 0);
  const utc = fromZonedTime(local, tz);
  return utc > now ? new Date(now.getTime() - int(r, 5, 90) * 60_000) : utc;
}

function channelFor(type: ActivityType): Channel {
  switch (type) {
    case "cold_email":
    case "referral_request":
      return "email";
    case "linkedin_connection":
    case "linkedin_dm":
      return "linkedin";
    case "application":
      return "company_site";
    case "call":
    case "interview":
      return "phone";
    default:
      return "other";
  }
}

/* ───────────────────────────── seed ───────────────────────────── */

export const SEEDABLE_TABLES = [
  s.activities,
  s.interviews,
  s.statusHistory,
  s.opportunities,
  s.contacts,
  s.templates,
  s.resumeVersions,
  s.weeklyReviews,
  s.notes,
  s.companies,
  s.tags,
] as const;

/** Count rows the user created themselves (anything not flagged is_seed). */
export function countRealRows(db: DB): number {
  return SEEDABLE_TABLES.reduce((sum, table) => {
    const [row] = db
      .select({ n: sql<number>`count(*)` })
      .from(table)
      .where(eq(table.isSeed, false))
      .all();
    return sum + row.n;
  }, 0);
}

/** Remove every seeded row. Real rows are never touched. */
export function clearSeed(db: DB) {
  db.transaction((tx) => {
    for (const table of SEEDABLE_TABLES) {
      tx.delete(table).where(eq(table.isSeed, true)).run();
    }
  });
}

export function seed(db: DB, opts: { now?: Date; random?: number } = {}) {
  const now = opts.now ?? new Date();
  const r = mulberry32(opts.random ?? 20260917);
  const counts = { companies: 0, contacts: 0, opportunities: 0, activities: 0, interviews: 0 };

  db.transaction((tx) => {
    for (const table of SEEDABLE_TABLES) tx.delete(table).where(eq(table.isSeed, true)).run();

    /* tags */
    const tagNames = [...new Set(COMPANIES.flatMap((c) => c.tags))];
    const existingTags = tx.select().from(s.tags).where(inArray(s.tags.name, tagNames)).all();
    const tagId = new Map(existingTags.map((t) => [t.name, t.id]));
    for (const name of tagNames) {
      if (tagId.has(name)) continue;
      const [row] = tx.insert(s.tags).values({ name, isSeed: true }).returning().all();
      tagId.set(name, row.id);
    }

    /* resumes + templates */
    const resumes = tx
      .insert(s.resumeVersions)
      .values([
        { name: "Backend · Go v3", description: "Go + Postgres projects up front, K8s operator side project.", fileUrl: "https://example.com/cv-backend-v3.pdf", isSeed: true },
        { name: "Platform / DevOps v2", description: "Leads with homelab cluster, Terraform, CI/CD work.", fileUrl: "https://example.com/cv-platform-v2.pdf", isSeed: true },
        { name: "General SWE v1", description: "Original one-pager. Broad, less targeted.", fileUrl: "https://example.com/cv-general-v1.pdf", isSeed: true },
      ])
      .returning()
      .all();

    const tpls = tx
      .insert(s.templates)
      .values([
        {
          name: "Cold email — platform team",
          type: "cold_email",
          subject: "Platform internship at {{company}}?",
          body: "Hi {{first_name}},\n\nI'm a software engineering student in Tunisia building on Kubernetes in my spare time (I run a 3-node homelab with Argo CD and Cilium). I've been following {{company}}'s work and would love to contribute as a {{role}}.\n\nWould you be open to a 15-minute chat, or pointing me to the right person?\n\nThanks!",
          isSeed: true,
        },
        {
          name: "LinkedIn DM — engineer",
          type: "linkedin_dm",
          body: "Hi {{first_name}} — I saw your talk/post on {{company}}'s infra and it's exactly the kind of work I want to do. I'm applying for the {{role}} role; any advice on what the team looks for?",
          isSeed: true,
        },
        {
          name: "Connection note — short",
          type: "connection_note",
          body: "Hi {{first_name}}, SWE student into Kubernetes & Go. Would love to follow your work at {{company}}.",
          isSeed: true,
        },
        {
          name: "Follow-up — gentle bump",
          type: "follow_up",
          subject: "Re: {{role}} at {{company}}",
          body: "Hi {{first_name}}, just bumping this in case it got buried. Happy to share more about my projects if useful!",
          isSeed: true,
        },
      ])
      .returning()
      .all();

    const outreachTemplate: Partial<Record<ActivityType, number>> = {
      cold_email: tpls[0].id,
      linkedin_dm: tpls[1].id,
      linkedin_connection: tpls[2].id,
      follow_up: tpls[3].id,
    };

    /* activity writer that also maintains thread + follow-up fields */
    const log = (a: typeof s.activities.$inferInsert) => {
      const [row] = tx
        .insert(s.activities)
        .values({ channel: channelFor(a.type), isSeed: true, ...a })
        .returning()
        .all();
      counts.activities++;
      return row;
    };

    /**
     * Log an outbound outreach, then maybe a follow-up and a reply.
     * Response probabilities depend on channel and tier so analytics have signal.
     */
    const outreach = (
      type: ActivityType,
      daysAgo: number,
      ctx: { companyId: number; contactId?: number; opportunityId?: number; tier: s.Company["tier"]; replyBias?: number },
    ) => {
      const occurredAt = at(now, daysAgo, r);
      const baseRate =
        { cold_email: 0.22, linkedin_dm: 0.3, linkedin_connection: 0.45, application: 0.18, referral_request: 0.55 }[
          type as string
        ] ?? 0.2;
      const tierBoost = ctx.tier === "backup" ? 0.1 : ctx.tier === "dream" ? -0.06 : 0;
      // Mornings (Tunis time) convert better — gives the day/hour heatmap a pattern.
      const hour = toZonedTime(occurredAt, "Africa/Tunis").getHours();
      const hourBoost = hour >= 8 && hour <= 11 ? 0.12 : hour >= 19 ? -0.08 : 0;
      const replies = chance(r, baseRate + tierBoost + hourBoost + (ctx.replyBias ?? 0));
      const replyDelayDays = int(r, 0, 9) + r();
      const replyAt = new Date(occurredAt.getTime() + replyDelayDays * DAY);
      const replied = replies && replyAt < now;
      const ruleDays = DEFAULT_FOLLOW_UP_RULES[type];
      const ageDays = (now.getTime() - occurredAt.getTime()) / DAY;

      const parent = log({
        type,
        direction: "outbound",
        companyId: ctx.companyId,
        contactId: ctx.contactId,
        opportunityId: ctx.opportunityId,
        templateId: outreachTemplate[type],
        subject: type === "cold_email" ? "Platform internship?" : undefined,
        occurredAt,
        outcome: replied ? (chance(r, 0.6) ? "positive" : "replied") : ageDays > 21 ? "no_response" : "pending",
        repliedAt: replied ? replyAt : null,
        followUpDueAt: !replied && ruleDays && ageDays <= 21 ? new Date(occurredAt.getTime() + ruleDays * DAY) : null,
      });

      // A follow-up for some un-replied threads older than their rule.
      if (ruleDays && ageDays > ruleDays + 1 && (!replied || replyDelayDays > ruleDays) && chance(r, 0.55)) {
        const fuAt = new Date(occurredAt.getTime() + (ruleDays + int(r, 0, 2)) * DAY);
        if (fuAt < now && (!replied || fuAt < replyAt)) {
          log({
            type: "follow_up",
            channel: parent.channel,
            direction: "outbound",
            companyId: ctx.companyId,
            contactId: ctx.contactId,
            opportunityId: ctx.opportunityId,
            parentActivityId: parent.id,
            templateId: outreachTemplate.follow_up,
            occurredAt: fuAt,
            outcome: replied ? "replied" : "pending",
          });
        }
      }

      if (replied) {
        log({
          type: type === "application" ? "note" : type,
          channel: parent.channel,
          direction: "inbound",
          companyId: ctx.companyId,
          contactId: ctx.contactId,
          opportunityId: ctx.opportunityId,
          parentActivityId: parent.id,
          summary: pick(r, [
            "Thanks for reaching out — let's set up a call.",
            "Forwarded your profile to the hiring team.",
            "We're not hiring interns right now, but keep in touch.",
            "Happy to chat! Here's my calendar link.",
            "Accepted your invitation.",
          ]),
          occurredAt: replyAt,
          outcome: "replied",
        });
        if (ctx.contactId) {
          tx.update(s.contacts).set({ lastContactedAt: replyAt }).where(eq(s.contacts.id, ctx.contactId)).run();
        }
      } else if (ctx.contactId) {
        tx.update(s.contacts)
          .set({ lastContactedAt: occurredAt })
          .where(and(eq(s.contacts.id, ctx.contactId)))
          .run();
      }
      return parent;
    };

    /* companies, contacts, opportunities */
    for (const c of COMPANIES) {
      const [company] = tx
        .insert(s.companies)
        .values({
          name: c.name,
          website: `https://${c.domain}`,
          linkedinUrl: `https://www.linkedin.com/company/${c.domain.split(".")[0]}`,
          industry: c.industry,
          size: c.size,
          hqLocation: c.hq,
          country: c.country,
          timezone: c.tz,
          remotePolicy: c.remote,
          techStack: c.stack,
          tier: c.tier,
          notes: chance(r, 0.4) ? `Strong ${c.stack[0] ?? "infra"} culture. Check their engineering blog before reaching out.` : null,
          isSeed: true,
          createdAt: at(now, int(r, 70, 95), r),
        })
        .returning()
        .all();
      counts.companies++;
      for (const t of c.tags) {
        tx.insert(s.companyTags).values({ companyId: company.id, tagId: tagId.get(t)! }).run();
      }

      const people = Array.from({ length: int(r, 1, 3) }, (_, i) => {
        const contactType: ContactType =
          i === 0 ? pick(r, ["recruiter", "engineer", "hiring_manager"] as const) : pick(r, ["engineer", "founder", "alumni", "referral"] as const);
        const first = pick(r, FIRST_NAMES);
        const last = pick(r, LAST_NAMES);
        const [contact] = tx
          .insert(s.contacts)
          .values({
            companyId: company.id,
            name: `${first} ${last}`,
            role: pick(r, ROLES_BY_TYPE[contactType]),
            contactType,
            linkedinUrl: `https://www.linkedin.com/in/${first}-${last}`.toLowerCase().replace(/\s+/g, "-"),
            email: chance(r, 0.6) ? `${first}.${last.split(" ").pop()}@${c.domain}`.toLowerCase() : null,
            isSeed: true,
          })
          .returning()
          .all();
        counts.contacts++;
        return contact;
      });

      // Pre-opportunity networking: connection requests & DMs
      for (let k = 0; k < int(r, 0, 3); k++) {
        const person = pick(r, people);
        outreach(pick(r, ["linkedin_connection", "linkedin_connection", "linkedin_dm", "cold_email"] as const), int(r, 0, 88), {
          companyId: company.id,
          contactId: person.id,
          tier: c.tier,
        });
      }

      const nOpps = c.tier === "dream" ? int(r, 1, 2) : int(r, 0, 2);
      for (let k = 0; k < nOpps; k++) {
        const status: OpportunityStatus = pick(r, [
          "wishlist", "wishlist", "wishlist",
          "applied", "applied", "applied", "applied", "applied", "applied",
          "screening", "screening", "screening",
          "interviewing", "interviewing", "interviewing",
          "offer",
          "rejected", "rejected", "rejected", "rejected", "rejected",
          "ghosted", "ghosted", "ghosted", "ghosted",
          "withdrawn",
        ] as const);
        const source: OpportunitySource =
          c.name === "Mitacs Globalink" ? "program" : pick(r, ["company_website", "linkedin_jobs", "linkedin_jobs", "job_board", "referral", "cold_outreach"] as const);
        // Live Applied/Screening roles stay inside the 21-day ghosting window so the
        // follow-up engine doesn't immediately ghost them on first dashboard load.
        const appliedDaysAgo =
          status === "applied" || status === "screening" ? int(r, 2, 16) : int(r, status === "wishlist" ? 0 : 6, 85);
        const referrer = source === "referral" ? pick(r, people) : undefined;

        // Walk the pipeline to the target status, spacing transitions a few days apart.
        const path: OpportunityStatus[] = ["wishlist"];
        if (status !== "wishlist") {
          const terminalFrom = ACTIVE_STATUSES.slice(1, int(r, 2, 4)) as OpportunityStatus[];
          if (status === "rejected" || status === "ghosted" || status === "withdrawn") {
            path.push(...terminalFrom, status);
          } else {
            path.push(...(ACTIVE_STATUSES.slice(1, ACTIVE_STATUSES.indexOf(status) + 1) as OpportunityStatus[]));
          }
        }
        const created = at(now, appliedDaysAgo + int(r, 1, 6), r);
        const stamps: Date[] = [created];
        let cursor = created.getTime();
        const step = Math.max(1, Math.floor(appliedDaysAgo / Math.max(1, path.length)));
        for (let i = 1; i < path.length; i++) {
          cursor = Math.min(now.getTime() - 3_600_000, cursor + (i === 1 ? int(r, 1, 5) : int(r, 2, step + 2)) * DAY);
          stamps.push(new Date(cursor));
        }

        const title = pick(r, TITLES);
        const [opp] = tx
          .insert(s.opportunities)
          .values({
            companyId: company.id,
            title,
            employmentType: title.startsWith("Part-time") || title.includes("Part-time") ? "part_time" : "internship",
            workMode: c.remote,
            country: c.country,
            jobUrl: `https://${c.domain}/careers/${title.toLowerCase().replace(/[^a-z]+/g, "-")}`,
            source,
            status,
            compensation: pick(r, ["€1,200/mo", "$25/h", "Unpaid → paid after 1 month", "1,500 TND/mo", null]),
            deadline: chance(r, 0.35) ? new Date(now.getTime() + int(r, -10, 20) * DAY) : null,
            appliedAt: path.includes("applied") ? stamps[path.indexOf("applied")] : null,
            resumeVersionId: status === "wishlist" ? null : pick(r, resumes).id,
            coverLetterUsed: chance(r, 0.4),
            priority: c.tier === "dream" ? 1 : c.tier === "target" ? 2 : 3,
            excitement: c.tier === "dream" ? int(r, 4, 5) : int(r, 2, 4),
            jobDescription: `## About the role\nYou'll help build and operate ${c.name}'s ${c.industry.toLowerCase()} platform.\n\n- Work with ${c.stack.join(", ") || "modern tooling"}\n- Ship to production in your first weeks\n- Pair with senior engineers on on-call rotations`,
            rejectionReason: status === "rejected" ? pick(r, REJECTION_REASONS) : null,
            rejectedAtStage: status === "rejected" ? path[path.length - 2] : null,
            referredByContactId: referrer?.id,
            position: k,
            isSeed: true,
            createdAt: created,
          })
          .returning()
          .all();
        counts.opportunities++;

        for (let i = 0; i < path.length; i++) {
          tx.insert(s.statusHistory)
            .values({ opportunityId: opp.id, fromStatus: i === 0 ? null : path[i - 1], toStatus: path[i], changedAt: stamps[i], isSeed: true })
            .run();
        }
        const involved = [...new Set([referrer, pick(r, people)].filter(Boolean))] as s.Contact[];
        for (const p of involved) tx.insert(s.opportunityContacts).values({ opportunityId: opp.id, contactId: p.id }).run();

        if (path.includes("applied")) {
          const appliedAt = stamps[path.indexOf("applied")];
          const appliedAgo = (now.getTime() - appliedAt.getTime()) / DAY;
          const progressed = path.indexOf("applied") < path.length - 1 && !["ghosted", "withdrawn"].includes(path[path.indexOf("applied") + 1]);
          const app = log({
            type: "application",
            channel: source === "linkedin_jobs" ? "linkedin" : "company_site",
            direction: "outbound",
            companyId: company.id,
            opportunityId: opp.id,
            subject: title,
            occurredAt: appliedAt,
            outcome: progressed ? "positive" : status === "ghosted" || appliedAgo > 21 ? "no_response" : "pending",
            repliedAt: progressed ? stamps[path.indexOf("applied") + 1] : null,
            followUpDueAt: !progressed && appliedAgo <= 21 ? new Date(appliedAt.getTime() + 10 * DAY) : null,
          });
          if (progressed) {
            log({
              type: "note",
              channel: "email",
              direction: "inbound",
              companyId: company.id,
              opportunityId: opp.id,
              parentActivityId: app.id,
              summary: "Recruiter replied to schedule an intro call.",
              occurredAt: stamps[path.indexOf("applied") + 1],
              outcome: "replied",
            });
          }
          // Warm up the application with a DM or referral request.
          if (chance(r, 0.5)) {
            outreach(referrer ? "referral_request" : pick(r, ["linkedin_dm", "cold_email"] as const), Math.max(0, appliedAgo - int(r, 0, 3)), {
              companyId: company.id,
              contactId: (referrer ?? pick(r, people)).id,
              opportunityId: opp.id,
              tier: c.tier,
              replyBias: progressed ? 0.25 : 0,
            });
          }
        }

        if (path.includes("interviewing")) {
          const start = stamps[path.indexOf("interviewing")];
          const stages: InterviewStage[] = ["hr_screen", "technical", pick(r, ["system_design", "take_home", "behavioral"] as const), "final"];
          const nInterviews = status === "interviewing" ? int(r, 1, 3) : int(r, 2, 4);
          for (let i = 0; i < nInterviews; i++) {
            let when = new Date(start.getTime() + i * int(r, 3, 7) * DAY);
            const isLastUpcoming = status === "interviewing" && i === nInterviews - 1;
            if (isLastUpcoming) when = new Date(now.getTime() + int(r, 1, 6) * DAY);
            // Interviews land on the hour or half hour, 09:00–17:30 Tunis time.
            const local = toZonedTime(when, "Africa/Tunis");
            local.setHours(int(r, 9, 17), pick(r, [0, 30]), 0, 0);
            when = fromZonedTime(local, "Africa/Tunis");
            const past = when < now;
            const failedHere = status === "rejected" && i === nInterviews - 1;
            const [iv] = tx
              .insert(s.interviews)
              .values({
                opportunityId: opp.id,
                stage: stages[Math.min(i, stages.length - 1)],
                scheduledAt: when,
                durationMinutes: pick(r, [30, 45, 60, 90]),
                prepNotes: "Review the job description, prepare the homelab story, brush up on Kubernetes networking.",
                questionsAsked: past ? pick(r, ["How does a Service route to Pods?", "Design a rate limiter.", "Tell me about a production incident you debugged."]) : null,
                selfRating: past ? int(r, 2, 5) : null,
                outcome: past ? (failedHere ? "failed" : "passed") : "scheduled",
                feedback: past && failedHere ? "Solid fundamentals, needs more depth on distributed systems." : null,
                isSeed: true,
              })
              .returning()
              .all();
            counts.interviews++;
            tx.insert(s.interviewContacts).values({ interviewId: iv.id, contactId: pick(r, people).id }).onConflictDoNothing().run();
            if (past) {
              log({ type: "interview", direction: "outbound", companyId: company.id, opportunityId: opp.id, summary: `${stages[Math.min(i, stages.length - 1)].replace("_", " ")} round`, occurredAt: when, outcome: "replied" });
            }
          }
        }
      }
    }

    /* Background rhythm: extra LinkedIn connections and emails on most days, with some gaps. */
    const companyRows = tx.select().from(s.companies).where(eq(s.companies.isSeed, true)).all();
    const contactRows = tx.select().from(s.contacts).where(eq(s.contacts.isSeed, true)).all();
    for (let d = 90; d >= 0; d--) {
      const weekday = toZonedTime(new Date(now.getTime() - d * DAY), "Africa/Tunis").getDay();
      const restDay = weekday === 0 || (weekday === 6 && chance(r, 0.5)) || chance(r, 0.12);
      if (restDay) continue;
      const n = int(r, 0, 3);
      for (let k = 0; k < n; k++) {
        const contact = pick(r, contactRows);
        const company = companyRows.find((c) => c.id === contact.companyId)!;
        outreach(pick(r, ["linkedin_connection", "linkedin_connection", "cold_email", "linkedin_dm"] as const), d, {
          companyId: company.id,
          contactId: contact.id,
          tier: company.tier,
        });
      }
    }

    /* A couple of weekly reflections */
    tx.insert(s.weeklyReviews)
      .values([
        { weekStart: weekStartKey(now, 7), notes: "Mornings convert way better than late-night sends. Keep DMs short.", isSeed: true },
        { weekStart: weekStartKey(now, 14), notes: "Too many applications without a warm intro. Pair every dream-tier application with a DM.", isSeed: true },
      ])
      .run();
  });

  return counts;
}

function weekStartKey(now: Date, daysAgo: number) {
  const d = toZonedTime(new Date(now.getTime() - daysAgo * DAY), "Africa/Tunis");
  const diff = (d.getDay() + 6) % 7; // Monday start
  d.setDate(d.getDate() - diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
