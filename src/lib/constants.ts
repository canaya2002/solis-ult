import {
  LayoutDashboard,
  PenTool,
  Lightbulb,
  Wand2,
  Calendar,
  Mic,
  BarChart3,
  PieChart,
  Target,
  Users,
  Search,
  FileText,
  Hash,
  Eye,
  Star,
  MessageSquare,
  Reply,
  MessageCircle,
  Inbox,
  Copy,
  TrendingUp,
  Activity,
  ClipboardList,
  DollarSign,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const OFFICES = [
  { name: "Dallas", city: "Dallas", state: "TX", timezone: "America/Chicago" },
  {
    name: "Chicago",
    city: "Chicago",
    state: "IL",
    timezone: "America/Chicago",
  },
  {
    name: "Los Angeles",
    city: "Los Angeles",
    state: "CA",
    timezone: "America/Los_Angeles",
  },
  {
    name: "Memphis",
    city: "Memphis",
    state: "TN",
    timezone: "America/Chicago",
  },
] as const;

export const PLATFORMS = {
  FACEBOOK: { label: "Facebook", color: "#1877F2", shortLabel: "FB" },
  INSTAGRAM: { label: "Instagram", color: "#E4405F", shortLabel: "IG" },
  TIKTOK: { label: "TikTok", color: "#000000", shortLabel: "TT" },
  YOUTUBE: { label: "YouTube", color: "#FF0000", shortLabel: "YT" },
  BLOG: { label: "Blog", color: "#cda64e", shortLabel: "Blog" },
} as const;

export const CASE_TYPES = [
  { value: "asylum", label: "Asilo" },
  { value: "tps", label: "TPS" },
  { value: "greencard", label: "Residencia (Green Card)" },
  { value: "citizenship", label: "Ciudadanía" },
  { value: "work_visa", label: "Visa de Trabajo" },
  { value: "deportation_defense", label: "Defensa de Deportación" },
  { value: "other", label: "Otro" },
] as const;

export const LEAD_SOURCES = {
  META_AD: "Meta Ads",
  ORGANIC_WEB: "Web Orgánico",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  DM_FACEBOOK: "DM Facebook",
  DM_INSTAGRAM: "DM Instagram",
  WHATSAPP: "WhatsApp",
  REFERRAL: "Referido",
  PODCAST: "Podcast",
  OTHER: "Otro",
} as const;

export const CPL_THRESHOLD =
  Number(process.env.META_ADS_CPL_THRESHOLD) || 30;
export const REBALANCE_INTERVAL_HOURS =
  Number(process.env.META_ADS_REBALANCE_INTERVAL_HOURS) || 12;
export const REVIEW_REQUEST_DELAY_DAYS =
  Number(process.env.REVIEW_REQUEST_DELAY_DAYS) || 7;
export const MAX_REVIEW_REMINDERS =
  Number(process.env.MAX_REVIEW_REMINDERS) || 2;

type NavSubItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  section?: string;
  items?: NavSubItem[];
};

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Overview",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Contenido",
    href: "/content",
    icon: PenTool,
    section: "content",
    items: [
      { label: "Ideas", href: "/content", icon: Lightbulb },
      { label: "Crear", href: "/content/create", icon: Wand2 },
      { label: "Calendario", href: "/content/scheduler", icon: Calendar },
      { label: "Podcast", href: "/content/podcast", icon: Mic },
    ],
  },
  {
    label: "Ads",
    href: "/ads",
    icon: BarChart3,
    section: "ads",
    items: [
      { label: "Dashboard", href: "/ads", icon: PieChart },
      { label: "Campañas", href: "/ads/campaigns", icon: Target },
      { label: "Audiencias", href: "/ads/audiences", icon: Users },
    ],
  },
  {
    label: "SEO",
    href: "/seo",
    icon: Search,
    section: "seo",
    items: [
      { label: "Brief Semanal", href: "/seo", icon: FileText },
      { label: "Keywords", href: "/seo/keywords", icon: Hash },
      { label: "Competencia", href: "/seo/competitors", icon: Eye },
    ],
  },
  {
    label: "Reputación",
    href: "/reputation",
    icon: Star,
    section: "reputation",
    items: [
      { label: "Reseñas", href: "/reputation", icon: MessageSquare },
      { label: "Respuestas", href: "/reputation/responses", icon: Reply },
    ],
  },
  {
    label: "Engagement",
    href: "/engagement",
    icon: MessageCircle,
    section: "engagement",
    items: [
      { label: "Cola", href: "/engagement", icon: Inbox },
      { label: "Templates", href: "/engagement/templates", icon: Copy },
    ],
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: TrendingUp,
    section: "analytics",
    items: [
      { label: "Dashboard", href: "/analytics", icon: Activity },
      { label: "Reportes", href: "/analytics/reports", icon: ClipboardList },
      { label: "ROI", href: "/analytics/roi", icon: DollarSign },
    ],
  },
  {
    label: "Configuración",
    href: "/settings",
    icon: Settings,
  },
];
