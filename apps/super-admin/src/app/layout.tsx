import type { Metadata } from "next";
import { ThemeProvider } from "@novachat/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "NovaChat AI Super Admin",
  description: "Platform operations console for NovaChat AI."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
