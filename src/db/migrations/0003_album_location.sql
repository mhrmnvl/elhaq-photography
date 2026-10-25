-- Lokasi pelaksanaan per album (opsional). Dipakai sebagai baris kedua caption galeri.
ALTER TABLE albums ADD COLUMN location_en text NOT NULL DEFAULT '';
ALTER TABLE albums ADD COLUMN location_id text NOT NULL DEFAULT '';
