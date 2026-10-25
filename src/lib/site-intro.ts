/**
 * Logika murni untuk layar pembuka halaman home.
 * Tanpa DOM supaya bisa diuji langsung.
 */

/** Jeda minimum supaya pembuka tidak berkedip. */
export const INTRO_MIN_MS = 600;

/** Batas maksimum supaya persentase tidak pernah menggantung di jaringan lambat. */
export const INTRO_MAX_MS = 2500;

/** Kalau tidak ada gambar baru yang selesai selama jeda ini, pemuatan dianggap berhenti.
    Gambar lazy di bawah layar memang tidak pernah memicu load, jadi tanpa ini pembuka
    selalu menunggu sampai batas maksimum. */
export const INTRO_STALL_MS = 700;

/** Lama satu huruf bergerak naik, baik keluar ke atas maupun masuk dari bawah. */
export const INTRO_LETTER_MS = 1000;

/** Stagger overlaps the one-second ribbon motion of adjacent letters. */
export const INTRO_LETTER_DELAY_MS = 120;

/** Berapa putaran gelombang sebelum semua huruf naik bersama. Satu putaran saja. */
export const INTRO_CYCLES = 1;

/** Lama tirai layar pembuka tersingkap ke atas. */
export const INTRO_CURTAIN_MS = 900;

/** Sinyal bahwa layar pembuka benar-benar tayang dan sudah selesai.
    Dipakai animasi gulir pembuka supaya hanya jalan setelah pembuka tampil. */
export const INTRO_DONE_EVENT = "elhaq:intro-complete";

/** Titik waktu tiap tahap layar pembuka, dalam milidetik dari gelombang mulai. */
export type IntroTimeline = {
  /** Gelombang huruf mulai berjalan. */
  wave: number;
  /** Semua huruf naik bersama. */
  leave: number;
  /** Tirai mulai tersingkap ke atas. */
  curtain: number;
  /** Overlay dilepas. */
  done: number;
};

/** One pass ends when the last replacement letter reaches its resting position. */
export function introWavePeriod(letterCount: number): number {
  const count = Math.max(0, Math.floor(letterCount));
  return count ? (count - 1) * INTRO_LETTER_DELAY_MS + INTRO_LETTER_MS : 0;
}

/** Urutan tahap layar pembuka: gelombang huruf, semua naik, tirai. */
export function introTimeline(letterCount: number): IntroTimeline {
  const wave = 0;
  const leave = INTRO_CYCLES * introWavePeriod(letterCount);
  const curtain = leave;
  return {wave, leave, curtain, done: curtain + INTRO_CURTAIN_MS};
}

/** Persentase progres pemuatan gambar, dikunci di rentang 0-100. */
export function introPercent(resolved: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 100;
  if (!Number.isFinite(resolved)) return 0;
  const percent = Math.round((resolved / total) * 100);
  return Math.min(100, Math.max(0, percent));
}

/**
 * Pecah nama brand menjadi kata-kata yang masing-masing berisi huruf.
 * Kata dipertahankan utuh supaya baris bisa pindah baris antar kata,
 * sementara tiap huruf tetap bisa dianimasikan sendiri.
 */
export function splitBrandWords(brand: string): string[][] {
  return brand
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map((word) => [...word]);
}
