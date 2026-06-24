import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DIYA Life OS",
  description: "Behavioral Intelligence Active",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans bg-[#F9F7F2] text-[#2D2D2D] min-h-screen">
        {children}
      </body>
    </html>
  );
}
