import type {AdminSession} from "@/lib/authz";
import {getDb, type SqlExecutor} from "@/lib/db";
import type {AdminSearchResults, AlbumCategory} from "@/lib/domain";

type AdminSearchDependencies = {db?: SqlExecutor};

type AlbumSearchRow = {
  id: string;
  slug: string;
  title_en: string;
  title_id: string;
};

type MessageSearchRow = {
  id: string;
  name: string;
  email: string | null;
  event_type: AlbumCategory;
};

function likePattern(query: string): string {
  return `%${query.replace(/[!%_]/g, "!$&")}%`;
}

export async function searchAdminContent(
  actor: AdminSession,
  query: string,
  overrides: AdminSearchDependencies = {},
): Promise<AdminSearchResults> {
  void actor;
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) return {albums: [], messages: []};

  const db = overrides.db ?? getDb();
  const pattern = likePattern(normalizedQuery);
  // ponytail: substring ILIKE scans these tables; add pg_trgm indexes if search volume grows.
  const [albums, messages] = await Promise.all([
    db.query<AlbumSearchRow>(
      `SELECT id, slug, title_en, title_id
       FROM albums
       WHERE title_en ILIKE $1 ESCAPE '!'
          OR title_id ILIKE $1 ESCAPE '!'
          OR slug ILIKE $1 ESCAPE '!'
       ORDER BY sort_order, created_at DESC, id
       LIMIT 5`,
      [pattern],
    ),
    db.query<MessageSearchRow>(
      `SELECT id, name, email, event_type
       FROM contact_messages
       WHERE name ILIKE $1 ESCAPE '!'
          OR COALESCE(email, '') ILIKE $1 ESCAPE '!'
          OR message ILIKE $1 ESCAPE '!'
       ORDER BY created_at DESC, id
       LIMIT 5`,
      [pattern],
    ),
  ]);

  return {
    albums: albums.rows.map((row) => ({id: row.id, slug: row.slug, title: row.title_en || row.title_id})),
    messages: messages.rows.map((row) => ({id: row.id, name: row.name, email: row.email, eventType: row.event_type})),
  };
}
