import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { Providers } from "./providers";
import "./globals.css";

const display = localFont({
  src: "../fonts/bebas-neue-latin.woff2",
  weight: "400",
  style: "normal",
  display: "swap",
  variable: "--font-display",
  adjustFontFallback: "Arial",
});

/* Design System TU Typography (Figma 1:5287) — Inter */
const body = Inter({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
  variable: "--font-body",
  adjustFontFallback: true,
});

const themeScript = `try{var t=localStorage.getItem("tu-rental-theme");document.documentElement.setAttribute("data-theme",t==="dark"?"dark":"light");}catch(e){}`;

export const metadata: Metadata = {
  title: {
    default: "ARMOR",
    template: "ARMOR - %s",
  },
  description: "Input data handover unit, jam downtime, dan HM",
};

export const viewport: Viewport = {
  themeColor: "#fdba12",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" data-theme="light" suppressHydrationWarning>
      <body className={`${body.className} ${display.variable} ${body.variable}`}>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
