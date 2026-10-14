"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Superseded by Content → Website.
 *
 * This edited HomepageContent (hero copy, section subtitles, announcement),
 * which the storefront never rendered. Homepage content is now part of the
 * versioned website publication; bookmarks land on its editor.
 */
export default function HomepageRedirect() {
  const router = useRouter();
  useEffect(() => router.replace("/content/website"), [router]);
  return null;
}
