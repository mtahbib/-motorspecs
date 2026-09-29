import { Barlow, Barlow_Condensed, IBM_Plex_Sans_Arabic, Noto_Sans_JP } from "next/font/google";

export const bodyFont = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const displayFont = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display-latin",
  display: "swap",
});

export const japaneseFont = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-ja",
  display: "swap",
  preload: false,
});

export const arabicFont = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ar",
  display: "swap",
  preload: false,
});
