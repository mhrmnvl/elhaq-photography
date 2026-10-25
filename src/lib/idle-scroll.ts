/**
 * Logika murni untuk gulir otomatis saat halaman home tidak mendapat aksi.
 * Tanpa DOM supaya bisa diuji langsung.
 */

/** Lama tanpa aksi sebelum halaman mulai menggulir sendiri. */
export const IDLE_DELAY_MS = 4000;

/** Kecepatan gulir otomatis. Sengaja pelan supaya terasa mengalir, bukan melompat. */
export const IDLE_SPEED_PX_PER_SECOND = 60;

/** Lama animasi gulir pembuka: cepat, tetapi cukup beberapa detik untuk terasa mengalir. */
export const INTRO_GALLERY_MS = 4000;

/** Posisi gulir berikutnya, tidak pernah melewati batas bawah dokumen. */
export function nextScrollTop(current: number, maxTop: number, speed: number, deltaMs: number): number {
  if (!(deltaMs > 0) || !(speed > 0)) return current;
  const limit = Math.max(0, maxTop);
  if (current >= limit) return limit;
  return Math.min(limit, current + (speed * deltaMs) / 1000);
}

/** Sudah sampai dasar dokumen? Toleransi 1px untuk pembulatan browser. */
export function atBottom(scrollTop: number, viewportHeight: number, scrollHeight: number): boolean {
  return scrollTop + viewportHeight >= scrollHeight - 1;
}

/**
 * Posisi gulir animasi pembuka: satu putaran penuh galeri, jadi ujungnya persis
 * kembali ke titik awal. Melambat di awal dan di akhir supaya perpindahannya mulus.
 */
export function introGalleryTop(start: number, distance: number, elapsedMs: number, durationMs: number): number {
  if (!(durationMs > 0)) return start + distance;
  if (!(elapsedMs > 0)) return start;
  const progress = Math.min(1, elapsedMs / durationMs);
  const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
  return start + distance * eased;
}
