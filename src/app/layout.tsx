import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Source_Sans_3 } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const display = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-body",
});

const themeScript = `try{var t=localStorage.getItem("tu-rental-theme");document.documentElement.setAttribute("data-theme",t==="dark"?"dark":"light");}catch(e){}`;

export const metadata: Metadata = {
  title: "ARMOR — Input downtime shift",
  description: "Input data handover unit, jam downtime, dan HM",
};

export const viewport: Viewport = {
  themeColor: "#ffb81c",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" data-theme="light" suppressHydrationWarning>
      <body className={`${display.variable} ${body.variable}`}>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
