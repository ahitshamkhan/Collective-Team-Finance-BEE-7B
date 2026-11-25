import { Suspense } from "react";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Collective Finance Portal",
  description: "Private collective fund bookkeeping portal",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body
        className="min-h-full flex flex-col bg-background text-foreground"
        suppressHydrationWarning
      >
        <Suspense fallback={<p className="p-8">Loading…</p>}>
          {children}
        </Suspense>
      </body>
    </html>
  );
}
