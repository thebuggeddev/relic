import type { Metadata } from "next";
import {
  Playfair_Display,
  Cormorant_Garamond,
  Plus_Jakarta_Sans,
} from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-editorial",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Relic Reborn — Interactive Digital Archaeology & 3D Restoration Exhibit",
  description:
    "Explore museum-documented archaeological reconstructions in interactive 3D or upload a damaged artifact photograph for historically grounded AI restoration and Tripo 3D modeling.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${cormorant.variable} ${jakarta.variable}`}
    >
      <head>
        <link
          rel="preload"
          href="/showcase/greek-amphora/hyp-1.glb"
          as="fetch"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/showcase/pedestal-top.jpg"
          as="image"
        />
        <link
          rel="preload"
          href="/showcase/pedestal-side.jpg"
          as="image"
        />
      </head>
      <body className="museum-atmosphere min-h-dvh text-[#f3ede2] selection:bg-[#dcb879]/30 selection:text-[#f3ede2]">
        {children}
      </body>
    </html>
  );
}
