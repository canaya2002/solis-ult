"use client";

import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number;
  size?: "sm" | "md" | "lg";
  showNumber?: boolean;
}

export function StarRating({ rating, size = "md", showNumber = false }: StarRatingProps) {
  const sizeClass = size === "sm" ? "text-xs" : size === "lg" ? "text-xl" : "text-base";
  const ratingColor =
    rating >= 4.5 ? "text-emerald-400" :
    rating >= 3.5 ? "text-amber-400" :
    rating >= 2.5 ? "text-orange-400" :
    "text-red-400";

  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(rating)) {
      stars.push("★");
    } else if (i - 0.5 <= rating) {
      stars.push("★"); // half star shown as full for simplicity
    } else {
      stars.push("☆");
    }
  }

  return (
    <span className={cn("inline-flex items-center gap-1", sizeClass, ratingColor)}>
      <span>{stars.join("")}</span>
      {showNumber && (
        <span className="text-foreground font-semibold ml-1">{rating.toFixed(1)}</span>
      )}
    </span>
  );
}
