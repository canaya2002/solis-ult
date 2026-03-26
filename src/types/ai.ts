// SOLIS AI — AI service types

export type ContentIdea = {
  topic: string;
  angle: string;
  hook: string;
  hashtags: string[];
  platform: string;
  trendSource: string;
};

export type SEOBriefData = {
  opportunities: Array<{
    keyword: string;
    volume: number;
    position: number;
    action: string;
  }>;
  quickWins: Array<{
    page: string;
    currentTitle: string;
    suggestedTitle: string;
    reason: string;
  }>;
  contentSuggestions: Array<{
    topic: string;
    keyword: string;
    estimatedVolume: number;
    difficulty: string;
  }>;
  technicalIssues: Array<{
    issue: string;
    severity: "low" | "medium" | "high" | "critical";
    fix: string;
  }>;
};

export type WeeklyReportData = {
  summary: string;
  wins: string[];
  problems: string[];
  actions: string[];
  metrics: Record<string, number | string>;
};

export type CopyVariant = {
  variant: number;
  caption: string;
  hashtags: string[];
  platform: string;
  cta: string;
};

export type CommentClassification = {
  category:
    | "LEGAL_QUESTION"
    | "POSITIVE"
    | "COMPLAINT"
    | "SPAM"
    | "PRICE_INQUIRY"
    | "OTHER";
  confidence: number;
  suggestedResponse: string;
};

export type LeadQualification = {
  caseType: string;
  city: string;
  urgency: number;
  language: string;
  summary: string;
};

export type TranscriptionResult = {
  text: string;
  segments: Array<{ start: number; end: number; text: string }>;
  language: string;
  duration: number;
};

export type BlogArticle = {
  title: string;
  slug: string;
  content: string;
  metaDescription: string;
  keywords: string[];
};
