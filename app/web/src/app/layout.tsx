import type { Metadata } from "next";
import { Figtree, Geist_Mono } from "next/font/google";
import { GlobalProvider } from "@/component/global-provider";
import "./global.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-sans" });

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Use Open Prompt - Prompt Registry",
  description:
    "An open source prompt registry that enforce prompt sharing across the globe",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${figtree.variable} ${geistMono.variable} antialiased`}
    >
      <body>
        <GlobalProvider>{children}</GlobalProvider>
      </body>
    </html>
  );
}
