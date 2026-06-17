import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Outing Planner",
  description:
    "Plan an afternoon out: rated venues per stop, pick from cards, get the most efficient route."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
