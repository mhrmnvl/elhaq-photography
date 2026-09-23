CREATE TYPE album_category AS ENUM ('wedding', 'events', 'other');
CREATE TYPE album_status AS ENUM ('draft', 'published');
CREATE TYPE upload_intent_state AS ENUM ('open', 'consumed', 'compensation_pending');
CREATE TYPE cleanup_operation AS ENUM ('upload_compensation', 'remote_delete');
CREATE TYPE cleanup_status AS ENUM ('pending', 'resolved');
CREATE TYPE notification_status AS ENUM ('disabled', 'pending', 'sent', 'failed');

CREATE TABLE upload_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id text NOT NULL,
  expected_public_id text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  state upload_intent_state NOT NULL DEFAULT 'open',
  used_at timestamptz,
  media_id uuid
);

CREATE TABLE media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cloud_name text NOT NULL,
  public_id text NOT NULL UNIQUE,
  secure_url text NOT NULL,
  width integer NOT NULL CHECK (width > 0),
  height integer NOT NULL CHECK (height > 0),
  format text NOT NULL,
  bytes integer NOT NULL CHECK (bytes > 0),
  upload_intent_id uuid UNIQUE,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE upload_intents
  ADD CONSTRAINT upload_intents_media_fk FOREIGN KEY (media_id) REFERENCES media_assets(id) ON DELETE SET NULL;
ALTER TABLE media_assets
  ADD CONSTRAINT media_assets_upload_intent_fk FOREIGN KEY (upload_intent_id) REFERENCES upload_intents(id) ON DELETE SET NULL;

CREATE TABLE albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  creation_key text UNIQUE,
  category album_category NOT NULL,
  title_en text NOT NULL,
  title_id text NOT NULL,
  story_en text NOT NULL,
  story_id text NOT NULL,
  status album_status NOT NULL DEFAULT 'draft',
  cover_media_id uuid REFERENCES media_assets(id) ON DELETE RESTRICT,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE album_photos (
  album_id uuid NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  media_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
  position integer NOT NULL CHECK (position >= 0),
  alt_en text NOT NULL,
  alt_id text NOT NULL,
  PRIMARY KEY (album_id, media_id),
  CONSTRAINT album_photos_album_position_key UNIQUE (album_id, position) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE site_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  brand_name text NOT NULL,
  logo_media_id uuid REFERENCES media_assets(id) ON DELETE RESTRICT,
  logo_alt_en text NOT NULL,
  logo_alt_id text NOT NULL,
  hero_media_id uuid REFERENCES media_assets(id) ON DELETE RESTRICT,
  hero_alt_en text NOT NULL,
  hero_alt_id text NOT NULL,
  personal_introduction_en text NOT NULL,
  personal_introduction_id text NOT NULL,
  about_media_id uuid REFERENCES media_assets(id) ON DELETE RESTRICT,
  about_alt_en text NOT NULL,
  about_alt_id text NOT NULL,
  about_story_en text NOT NULL,
  about_story_id text NOT NULL,
  home_headline_en text NOT NULL,
  home_headline_id text NOT NULL,
  home_description_en text NOT NULL,
  home_description_id text NOT NULL,
  service_wedding_title_en text NOT NULL,
  service_wedding_title_id text NOT NULL,
  service_wedding_description_en text NOT NULL,
  service_wedding_description_id text NOT NULL,
  service_events_title_en text NOT NULL,
  service_events_title_id text NOT NULL,
  service_events_description_en text NOT NULL,
  service_events_description_id text NOT NULL,
  service_other_title_en text NOT NULL,
  service_other_title_id text NOT NULL,
  service_other_description_en text NOT NULL,
  service_other_description_id text NOT NULL,
  location_en text NOT NULL,
  location_id text NOT NULL,
  service_area_en text NOT NULL,
  service_area_id text NOT NULL,
  instagram_url text,
  whatsapp_number text,
  featured_album_ids uuid[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE media_cleanup_journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation cleanup_operation NOT NULL,
  status cleanup_status NOT NULL DEFAULT 'pending',
  media_id uuid REFERENCES media_assets(id) ON DELETE SET NULL,
  cloud_name text NOT NULL,
  public_id text NOT NULL,
  reason text NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  claim_token text,
  claim_expires_at timestamptz
);

CREATE TABLE contact_rate_limits (
  fingerprint text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count >= 0)
);

CREATE TABLE contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_key text NOT NULL UNIQUE,
  payload_digest text NOT NULL,
  request_fingerprint text NOT NULL,
  name text NOT NULL,
  email text,
  whatsapp text,
  event_type text NOT NULL CHECK (event_type IN ('wedding', 'events', 'other')),
  event_date date,
  event_location text,
  message text NOT NULL,
  notification_status notification_status NOT NULL DEFAULT 'disabled',
  notification_provider_id text,
  notification_error text,
  notification_attempted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (nullif(btrim(email), '') IS NOT NULL OR nullif(btrim(whatsapp), '') IS NOT NULL)
);

CREATE TABLE private_client_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_name text NOT NULL,
  drive_url text NOT NULL CHECK (drive_url LIKE 'https://%'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX albums_public_order_idx ON albums (status, category, sort_order, created_at);
CREATE INDEX album_photos_order_idx ON album_photos (album_id, position);
CREATE INDEX contact_messages_created_idx ON contact_messages (created_at DESC);
CREATE INDEX cleanup_journal_pending_idx ON media_cleanup_journal (status, created_at);
