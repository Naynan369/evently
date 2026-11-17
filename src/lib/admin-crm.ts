import { randomUUID } from "node:crypto";
import { all, one } from "./db.ts";
import { AppError, textField } from "./security.ts";
import { assertOperator } from "./operations.ts";
import type { User } from "./types.ts";

export type CrmStatus = "none" | "open" | "waiting" | "resolved";
export type CrmSegment = "all" | "attendees" | "organizers" | "due";

export type CrmContact = {
  id: string;
  name: string;
  email: string;
  createdAt: number;
  emailVerified: boolean;
  isOrganizer: boolean;
  ticketsBooked: number;
  eventsPublished: number;
  status: CrmStatus;
  followUpOn: string | null;
  updatedAt: number | null;
};

export type CrmNote = {
  id: string;
  body: string;
  authorName: string | null;
  createdAt: number;
};

export type CrmDetail = {
  contact: CrmContact;
  notes: CrmNote[];
  bookings: Array<{
    id: string;
    eventTitle: string;
    status: string;
    createdAt: number;
  }>;
  events: Array<{
    id: string;
    title: string;
    slug: string;
    visibility: string;
  }>;
};

const contactSelect = `
  SELECT u.id,u.name,u.email,u.created_at AS "createdAt",
    (u.email_verified_at>0) AS "emailVerified",
    EXISTS(SELECT 1 FROM business_profiles p WHERE p.owner_id=u.id AND p.kind='organizer') AS "isOrganizer",
    (SELECT COALESCE(SUM(b.quantity),0)::integer FROM bookings b WHERE b.user_id=u.id AND b.status='confirmed') AS "ticketsBooked",
    (SELECT COUNT(*)::integer FROM events e WHERE e.owner_id=u.id AND e.data::jsonb->>'visibility'='published') AS "eventsPublished",
    COALESCE(c.status,'none') AS status,c.follow_up_on AS "followUpOn",c.updated_at AS "updatedAt"
  FROM users u LEFT JOIN crm_contacts c ON c.user_id=u.id`;

function searchPattern(value: string) {
  return "%" + value.toLowerCase().replace(/[!%_]/g, "!$&") + "%";
}

function todayInMessina() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
}

export async function listCrmContacts(
  actor: User,
  input: { query?: string; segment?: string; page?: string },
) {
  assertOperator(actor);
  const query = (input.query ?? "").trim();
  if (query.length > 120) throw new AppError("Search is too long.");
  const segment = input.segment || "all";
  if (!["all", "attendees", "organizers", "due"].includes(segment))
    throw new AppError("Invalid contact filter.");
  const page = Number(input.page || 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000)
    throw new AppError("Invalid page number.");

  const filters = ["u.role='USER'"];
  const values: Array<string | number> = [];
  const today = todayInMessina();
  if (segment === "due") {
    filters.push(
      "EXISTS(SELECT 1 FROM crm_contacts f WHERE f.user_id=u.id AND f.follow_up_on<=? AND f.status IN ('open','waiting'))",
    );
    values.push(today);
  } else if (segment !== "all") {
    filters.push(
      `${segment === "organizers" ? "" : "NOT "}EXISTS(SELECT 1 FROM business_profiles p WHERE p.owner_id=u.id AND p.kind='organizer')`,
    );
  }
  if (query) {
    filters.push(
      "(LOWER(u.name) LIKE ? ESCAPE '!' OR LOWER(u.email) LIKE ? ESCAPE '!')",
    );
    values.push(searchPattern(query), searchPattern(query));
  }
  const where = filters.join(" AND ");
  const [contacts, filtered, counts] = await Promise.all([
    all<CrmContact>(
      `${contactSelect} WHERE ${where}
       ORDER BY CASE WHEN c.follow_up_on<=? AND c.status IN ('open','waiting') THEN 0 ELSE 1 END,
                COALESCE(c.updated_at,u.created_at) DESC,u.id
       LIMIT 30 OFFSET ?`,
      ...values,
      today,
      (page - 1) * 30,
    ),
    one<{ total: number }>(
      `SELECT COUNT(*)::integer AS total FROM users u WHERE ${where}`,
      ...values,
    ),
    one<{ total: number; attendees: number; organizers: number; due: number }>(
      `SELECT COUNT(*)::integer AS total,
        COUNT(*) FILTER (WHERE NOT EXISTS(SELECT 1 FROM business_profiles p WHERE p.owner_id=u.id AND p.kind='organizer'))::integer AS attendees,
        COUNT(*) FILTER (WHERE EXISTS(SELECT 1 FROM business_profiles p WHERE p.owner_id=u.id AND p.kind='organizer'))::integer AS organizers,
        COUNT(*) FILTER (WHERE c.follow_up_on<=? AND c.status IN ('open','waiting'))::integer AS due
       FROM users u LEFT JOIN crm_contacts c ON c.user_id=u.id WHERE u.role='USER'`,
      today,
    ),
  ]);
  return {
    contacts,
    page,
    pageSize: 30,
    filteredTotal: filtered?.total ?? 0,
    counts: counts ?? { total: 0, attendees: 0, organizers: 0, due: 0 },
  };
}

export async function crmContactDetail(
  actor: User,
  userId: string,
): Promise<CrmDetail> {
  assertOperator(actor);
  const contact = await one<CrmContact>(
    `${contactSelect} WHERE u.id=? AND u.role='USER'`,
    userId,
  );
  if (!contact) throw new AppError("Contact not found.", 404);
  const [notes, bookings, events] = await Promise.all([
    all<CrmNote>(
      `SELECT n.id,n.body,a.name AS "authorName",n.created_at AS "createdAt"
       FROM crm_notes n LEFT JOIN users a ON a.id=n.author_id
       WHERE n.user_id=? ORDER BY n.created_at DESC,n.id DESC LIMIT 50`,
      userId,
    ),
    all<CrmDetail["bookings"][number]>(
      `SELECT b.id,e.data::jsonb->>'title' AS "eventTitle",b.status,b.created_at AS "createdAt"
       FROM bookings b JOIN events e ON e.id=b.event_id
       WHERE b.user_id=? ORDER BY b.created_at DESC LIMIT 6`,
      userId,
    ),
    all<CrmDetail["events"][number]>(
      `SELECT e.id,e.slug,e.data::jsonb->>'title' AS title,
              COALESCE(e.data::jsonb->>'visibility','published') AS visibility
       FROM events e WHERE e.owner_id=? ORDER BY e.id DESC LIMIT 6`,
      userId,
    ),
  ]);
  return { contact, notes, bookings, events };
}

export function normalizeCrmUpdate(input: {
  status: unknown;
  followUpOn: unknown;
}) {
  const status = input.status;
  if (
    status !== "none" &&
    status !== "open" &&
    status !== "waiting" &&
    status !== "resolved"
  )
    throw new AppError("Choose a valid follow-up status.");
  let followUpOn: string | null = null;
  if (
    input.followUpOn !== null &&
    input.followUpOn !== "" &&
    input.followUpOn !== undefined
  ) {
    if (
      typeof input.followUpOn !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(input.followUpOn) ||
      Number.isNaN(Date.parse(input.followUpOn)) ||
      new Date(input.followUpOn).toISOString().slice(0, 10) !== input.followUpOn
    )
      throw new AppError("Choose a valid follow-up date.");
    followUpOn = input.followUpOn;
  }
  return {
    status: status as CrmStatus,
    followUpOn: status === "none" || status === "resolved" ? null : followUpOn,
  };
}

export async function updateCrmContact(
  actor: User,
  userId: string,
  input: { status: unknown; followUpOn: unknown },
) {
  assertOperator(actor);
  const { status, followUpOn } = normalizeCrmUpdate(input);
  const updated = await one<{ userId: string }>(
    `INSERT INTO crm_contacts(user_id,status,follow_up_on,updated_at,updated_by)
     SELECT u.id,?,?,?,? FROM users u WHERE u.id=? AND u.role='USER'
     ON CONFLICT(user_id) DO UPDATE SET status=EXCLUDED.status,
       follow_up_on=EXCLUDED.follow_up_on,updated_at=EXCLUDED.updated_at,
       updated_by=EXCLUDED.updated_by RETURNING user_id AS "userId"`,
    status,
    followUpOn,
    Date.now(),
    actor.id,
    userId,
  );
  if (!updated) throw new AppError("Contact not found.", 404);
}

export async function addCrmNote(actor: User, userId: string, value: unknown) {
  assertOperator(actor);
  const note = textField(value, "Note", 2, 2000);
  const created = await one<{ id: string }>(
    `INSERT INTO crm_notes(id,user_id,author_id,body,created_at)
     SELECT ?,u.id,?,?,? FROM users u WHERE u.id=? AND u.role='USER' RETURNING id`,
    randomUUID(),
    actor.id,
    note,
    Date.now(),
    userId,
  );
  if (!created) throw new AppError("Contact not found.", 404);
  return created.id;
}
