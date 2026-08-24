import { Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const sans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata = {
  title: {
    default: "Zewa Feeds — CMS",
    template: "%s · Zewa Feeds CMS",
  },
  description: "Internal admin panel for the Zewa Feeds e-commerce website.",
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
      { url: "/favicon.ico" },
      { url: "/logo.png" },
    ],
    apple: [{ url: "/favicon.png" }],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
