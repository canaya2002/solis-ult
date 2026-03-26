// SOLIS AI — Analytics types

// ─── Google Analytics 4 ───────────────────────────────────────────────────────

export type TrafficOverview = {
  totalSessions: number;
  totalUsers: number;
  pageviews: number;
  bounceRate: number;
  avgDuration: number;
  dailyData: Array<{ date: string; sessions: number; users: number }>;
};

export type TrafficBySource = {
  source: string;
  medium: string;
  sessions: number;
  users: number;
  bounceRate: number;
};

export type TopPage = {
  path: string;
  pageviews: number;
  sessions: number;
  bounceRate: number;
};

export type ConversionData = {
  eventName: string;
  count: number;
  value: number;
};

// ─── Google Search Console ────────────────────────────────────────────────────

export type SearchPerformanceRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type OptimizationOpportunity = {
  page: string;
  query: string;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  suggestion: string;
};

// ─── Google Trends ────────────────────────────────────────────────────────────

export type TrendData = {
  keyword: string;
  timelineData: Array<{ date: string; value: number }>;
  averageInterest: number;
};

export type RelatedQuery = {
  query: string;
  value: number;
  type: "rising" | "top";
};

export type TrendReport = {
  trendingKeywords: string[];
  risingQueries: RelatedQuery[];
  topQueries: RelatedQuery[];
  timestamp: Date;
};

// ─── Semrush ──────────────────────────────────────────────────────────────────

export type DomainOverview = {
  domain: string;
  rank: number;
  organicKeywords: number;
  organicTraffic: number;
  organicCost: number;
  adKeywords: number;
  adTraffic: number;
  adCost: number;
};

export type OrganicKeyword = {
  keyword: string;
  position: number;
  previousPosition: number;
  volume: number;
  cpc: number;
  url: string;
  traffic: number;
  trafficPercent: number;
};

export type KeywordDifficulty = {
  keyword: string;
  difficulty: number;
  volume: number;
  cpc: number;
  results: number;
};

export type CompetitorDomain = {
  domain: string;
  commonKeywords: number;
  organicKeywords: number;
  organicTraffic: number;
};

export type KeywordGapResult = {
  keyword: string;
  volume: number;
  difficulty: number;
  competitorPositions: Record<string, number>;
};
