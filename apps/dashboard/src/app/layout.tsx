import type { Metadata } from "next";
import { ThemeProvider } from "@novachat/ui";
import { AuthProvider } from "@/components/auth/auth-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "NovaChat AI",
  description: "Enterprise AI messaging platform for WhatsApp-first businesses.",
  icons: {
    icon: "/icon.svg"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
