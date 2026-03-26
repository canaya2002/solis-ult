"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [expandedSections, setExpandedSections] = useState<string[]>(
    NAV_ITEMS.filter(
      (item) => item.items && pathname.startsWith(item.href)
    ).map((item) => item.label)
  );

  const toggleSection = (label: string) => {
    setExpandedSections((prev) =>
      prev.includes(label)
        ? prev.filter((l) => l !== label)
        : [...prev, label]
    );
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href;
  };

  const isSectionActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-border bg-[hsl(var(--sidebar-background))] transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-[hsl(var(--sidebar-border))] px-4">
        <button onClick={onToggle} className="flex items-center gap-2">
          <Zap className="h-8 w-8 shrink-0 text-gold" />
          {!collapsed && (
            <span className="text-lg font-bold tracking-tight text-gold">
              SOLIS AI
            </span>
          )}
        </button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {NAV_ITEMS.map((section) => (
            <div key={section.label}>
              {section.items ? (
                <>
                  <button
                    onClick={() => toggleSection(section.label)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      "hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]",
                      isSectionActive(section.href)
                        ? "text-gold"
                        : "text-[hsl(var(--sidebar-foreground))]/70"
                    )}
                  >
                    <section.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">
                          {section.label}
                        </span>
                        {expandedSections.includes(section.label) ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                      </>
                    )}
                  </button>
                  {!collapsed && expandedSections.includes(section.label) && (
                    <div className="ml-4 mt-1 space-y-1 border-l border-[hsl(var(--sidebar-border))] pl-3">
                      {section.items.map((item) => (
                        <Link
                          key={item.href + item.label}
                          href={item.href}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors",
                            "hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]",
                            isActive(item.href)
                              ? "bg-gold/10 font-medium text-gold"
                              : "text-[hsl(var(--sidebar-foreground))]/60"
                          )}
                        >
                          <item.icon className="h-3.5 w-3.5 shrink-0" />
                          <span>{item.label}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Link
                  href={section.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    "hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-accent-foreground))]",
                    isActive(section.href)
                      ? "bg-gold/10 font-medium text-gold"
                      : "text-[hsl(var(--sidebar-foreground))]/70"
                  )}
                >
                  <section.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{section.label}</span>}
                </Link>
              )}
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-[hsl(var(--sidebar-border))] p-4">
        {!collapsed && (
          <p className="text-[10px] text-[hsl(var(--sidebar-foreground))]/40">
            Manuel Solís Law Office
          </p>
        )}
      </div>
    </aside>
  );
}
