"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

const pathLabels: Record<string, string> = {
  content: "Contenido",
  create: "Crear",
  scheduler: "Calendario",
  podcast: "Podcast",
  ads: "Ads",
  campaigns: "Campañas",
  audiences: "Audiencias",
  seo: "SEO",
  keywords: "Keywords",
  competitors: "Competencia",
  reputation: "Reputación",
  responses: "Respuestas",
  engagement: "Engagement",
  templates: "Templates",
  analytics: "Analytics",
  reports: "Reportes",
  roi: "ROI",
  settings: "Configuración",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Link href="/" className="transition-colors hover:text-foreground">
        <Home className="h-4 w-4" />
      </Link>
      {segments.map((segment, index) => {
        const href = "/" + segments.slice(0, index + 1).join("/");
        const label = pathLabels[segment] || segment;
        const isLast = index === segments.length - 1;

        return (
          <span key={href} className="flex items-center gap-1.5">
            <ChevronRight className="h-3 w-3" />
            {isLast ? (
              <span className="font-medium text-foreground">{label}</span>
            ) : (
              <Link
                href={href}
                className="transition-colors hover:text-foreground"
              >
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
