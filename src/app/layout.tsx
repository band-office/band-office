import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Band Office",
    template: "%s | Band Office",
  },
  description: "Open-source operations for school music programs.",
  icons: {
    icon: "/brand/bandos-mark.png",
    apple: "/brand/bandos-mark.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
