import type { Metadata, Viewport } from "next";
import Script from "next/script";

import { IntroDialog } from "@/features/intro/intro-dialog";
import { SavedLibraryProvider } from "@/features/library/saved-library-provider";
import { AppNav } from "@/features/navigation/app-nav";
import { ServiceWorkerRegister } from "@/features/pwa/service-worker-register";
import { THEME_BOOTSTRAP_SCRIPT, THEME_CANVAS } from "@/lib/domain/theme";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "InstaMusic Finder",
    template: "%s · InstaMusic Finder",
  },
  description: "Find a recording's code and copy the exact Instagram Music search string.",
  appleWebApp: {
    capable: true,
    title: "InstaMusic Finder",
    statusBarStyle: "black-translucent",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: THEME_CANVAS.dark,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script id="theme-bootstrap" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
        <div className="app-shell">
          <AppNav />
          <SavedLibraryProvider>
            <main className="app-main" id="main-content">
              {children}
            </main>
          </SavedLibraryProvider>
        </div>
        <ServiceWorkerRegister />
        <IntroDialog />
      </body>
    </html>
  );
}
