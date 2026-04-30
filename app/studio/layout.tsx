import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TITAN STUDIO — Phase 3a scaffold",
  description:
    "Next.js shell for the upcoming React DJ studio. Diagnostics now, full UI later.",
  robots: { index: false, follow: false },
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
