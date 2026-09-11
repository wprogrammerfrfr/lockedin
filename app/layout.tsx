import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { getServerLocale } from "@/lib/i18n/get-locale";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { getServerTheme } from "@/lib/theme/get-theme";
import { ThemeSyncFromProfile } from "@/components/theme/ThemeSyncFromProfile";
import { Toaster } from "@/components/ui/sonner";
import { SwRegister } from "@/app/sw-register";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

/** Empty zeros for flip-clock digits (JetBrains Mono uses a dotted zero). */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://lockedin.vercel.app",
  ),
  title: "LockedIn — Focus Tracking for Students",
  description:
    "Focus tracking for students — lock in, rooms, and deep work streaks.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: "LockedIn",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#84cc16",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getServerLocale();
  const theme = await getServerTheme();
  // Resolve on the server from the cookie so we don't need an inline <script>
  // (React 19 rejects script tags rendered from components).
  const htmlClass =
    theme === "dark"
      ? `${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} ${geistMono.variable} dark h-full antialiased`
      : `${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} ${geistMono.variable} h-full antialiased`;

  return (
    <html lang={locale} suppressHydrationWarning className={htmlClass}>
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <AuthProvider>
          <ThemeProvider initialTheme={theme}>
            <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
            <ThemeSyncFromProfile />
            <Toaster position="top-center" richColors closeButton />
          </ThemeProvider>
          <SwRegister />
        </AuthProvider>
      </body>
    </html>
  );
}
