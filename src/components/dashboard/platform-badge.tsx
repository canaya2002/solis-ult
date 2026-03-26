"use client";

import { cn } from "@/lib/utils";

type PlatformKey = "facebook" | "instagram" | "tiktok" | "youtube" | "blog" | "FACEBOOK" | "INSTAGRAM" | "TIKTOK" | "YOUTUBE" | "BLOG";

const PLATFORM_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; icon: string }
> = {
  FACEBOOK: { label: "Facebook", bg: "bg-[#1877f2]/20", text: "text-[#1877f2]", icon: "f" },
  INSTAGRAM: { label: "Instagram", bg: "bg-[#e4405f]/20", text: "text-[#e4405f]", icon: "◎" },
  TIKTOK: { label: "TikTok", bg: "bg-[#00f2ea]/20", text: "text-[#00f2ea]", icon: "♪" },
  YOUTUBE: { label: "YouTube", bg: "bg-[#ff0000]/20", text: "text-[#ff0000]", icon: "▶" },
  BLOG: { label: "Blog", bg: "bg-[#4ade80]/20", text: "text-[#4ade80]", icon: "✎" },
};

interface PlatformBadgeProps {
  platform: PlatformKey;
  size?: "sm" | "md";
}

export function PlatformBadge({
  platform,
  size = "sm",
}: PlatformBadgeProps) {
  const key = platform.toUpperCase();
  const config = PLATFORM_CONFIG[key] || PLATFORM_CONFIG.BLOG;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border font-medium",
        config.bg,
        config.text,
        `border-current/20`,
        size === "sm" ? "px-1.5 py-0 text-[10px]" : "px-2.5 py-0.5 text-xs"
      )}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}
