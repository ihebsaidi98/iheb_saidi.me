import type { Metadata } from "next";
import { Inter, Calistoga } from "next/font/google";
import "./globals.css";
import { twMerge } from "tailwind-merge";
import { MotionProvider } from "@/components/MotionProvider";
import { profile } from "@/data/profile";
import { SmoothScroll } from "@/components/SmoothScroll";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const calistoga = Calistoga({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://yourdomain.dev"), // ← change me
  title: {
    default: "Iheb Saidi — Full Stack Software Engineer",
    template: "%s — Iheb Saidi",
  },
  description:
    "Full-stack software engineer building scalable Spring Boot backends and reactive Angular frontends.",
  openGraph: {
    type: "website",
    locale: "en",
    title: "Iheb Saidi — Full Stack Software Engineer",
    description:
      "Full-stack software engineer building scalable Spring Boot backends and reactive Angular frontends.",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: profile.name,
  jobTitle: "Full Stack Software Engineer",
  email: `mailto:${profile.email}`,
  url: "https://yourdomain.dev", // ← change me
  sameAs: [profile.linkedin, profile.github],
  knowsAbout: ["Java", "Spring Boot", "Angular", "TypeScript", "Microservices"],
  address: { "@type": "PostalAddress", addressLocality: "Tunis", addressCountry: "TN" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={twMerge(
          inter.variable,
          calistoga.variable,
          "bg-[#070a0d] text-white antialiased font-sans"
        )}
      >
        {/* Skip link: first tab stop, visible only when focused */}
        <a
          href="#projects"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-emerald-300 focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:text-[#05070a]"
        >
          Skip to content
        </a>

        <MotionProvider>
          <SmoothScroll>{children}</SmoothScroll>
        </MotionProvider>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}