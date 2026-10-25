import {DM_Sans, Fraunces} from "next/font/google";

export const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

// Serif display untuk heading publik (gaya editorial, seperti referensi).
// Admin tetap memakai DM Sans karena .admin-theme menimpa --font-serif.
export const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});
