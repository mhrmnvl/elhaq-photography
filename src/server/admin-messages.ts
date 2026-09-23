import type {AdminSession} from "@/lib/authz";
import {getDb, type SqlExecutor} from "@/lib/db";
import type {AdminContactMessage, AdminContactMessageSummary, AlbumCategory, NotificationStatus} from "@/lib/domain";

type AdminMessageDependencies = {db?: SqlExecutor};

type MessageSummaryRow = {
  id: string;
  name: string;
  email: string | null;
  whatsapp: string | null;
  event_type: AlbumCategory;
  notification_status: NotificationStatus;
  created_at: Date | string;
};

type MessageDetailRow = MessageSummaryRow & {
  event_date: Date | string | null;
  event_location: string | null;
  message: string;
};

function iso(value: Date | string): string {
  return new Date(value).toISOString();
}

function calendarDate(value: Date | string | null): string | null {
  return value === null ? null : value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

function mapSummary(row: MessageSummaryRow): AdminContactMessageSummary {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    whatsapp: row.whatsapp,
    eventType: row.event_type,
    notificationStatus: row.notification_status,
    createdAt: iso(row.created_at),
  };
}

function dbFor(overrides: AdminMessageDependencies): SqlExecutor {
  return overrides.db ?? getDb();
}

export async function listContactMessages(actor: AdminSession, overrides: AdminMessageDependencies = {}): Promise<readonly AdminContactMessageSummary[]> {
  void actor;
  const result = await dbFor(overrides).query<MessageSummaryRow>(
    "SELECT id, name, email, whatsapp, event_type, notification_status, created_at FROM contact_messages ORDER BY created_at DESC, id",
  );
  return result.rows.map(mapSummary);
}

export async function getContactMessage(actor: AdminSession, id: string, overrides: AdminMessageDependencies = {}): Promise<AdminContactMessage | null> {
  void actor;
  const result = await dbFor(overrides).query<MessageDetailRow>(
    "SELECT id, name, email, whatsapp, event_type, notification_status, created_at, event_date, event_location, message FROM contact_messages WHERE id = $1",
    [id],
  );
  const row = result.rows[0];
  return row ? {...mapSummary(row), eventDate: calendarDate(row.event_date), eventLocation: row.event_location, message: row.message} : null;
}
