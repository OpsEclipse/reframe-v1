import type { Metadata } from "next";
import { Inter, Manrope, Pangolin, Roboto_Mono } from "next/font/google";
import type { ReactNode } from "react";
import "../styles/index.css";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const manrope = Manrope({ subsets: ["latin"], display: "swap", variable: "--font-manrope" });
const robotoMono = Roboto_Mono({ subsets: ["latin"], display: "swap", variable: "--font-roboto-mono" });
const pangolin = Pangolin({ subsets: ["latin"], weight: "400", display: "swap", variable: "--font-pangolin" });

export const metadata: Metadata = {
  title: "VEAP",
  description: "VEAP journaling flow",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className={`${inter.variable} ${manrope.variable} ${robotoMono.variable} ${pangolin.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
