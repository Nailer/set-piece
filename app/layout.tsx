import type { Metadata, Viewport } from "next";
import { Fraunces, Work_Sans } from "next/font/google";
import { Nav } from "@/components/Nav";
import "./globals.css";

const display = Fraunces({ variable: "--font-display", subsets: ["latin"], style: ["normal", "italic"], weight: ["400", "500", "600"] });
const body = Work_Sans({ variable: "--font-body", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Set Piece",
  description:
    "Describe any theme and Aholo Lux3D forges a full chess set in 3D. Play it against the computer or a friend, then 3D-print it. Lost a piece? Photograph one that survived and get the missing one.",
};

export const viewport: Viewport = { themeColor: "#1a1512", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}
