export type ContentTypeValue =
  | "TIP_LEGAL"
  | "HISTORIA_EXITO"
  | "NOTICIA"
  | "FAQ"
  | "PODCAST_BLOG"
  | "ALERTA_USCIS"
  | "TESTIMONIO"
  | "INFOGRAFIA"
  | "OTHER";

export type ContentStatusValue =
  | "DRAFT"
  | "REVIEW"
  | "SCHEDULED"
  | "PUBLISHED"
  | "FAILED";

export type CopyGenerationRequest = {
  topic: string;
  platform: string;
  contentType: ContentTypeValue;
  tone?: "professional" | "empathetic" | "urgent" | "educational";
  language?: "es" | "en";
  includeHashtags?: boolean;
  includeCTA?: boolean;
};

export type CopyGenerationResponse = {
  title: string;
  body: string;
  hashtags: string[];
  cta?: string;
  alternativeHooks: string[];
};

export type TrendAnalysis = {
  topic: string;
  relevanceScore: number;
  suggestedAngle: string;
  suggestedPlatforms: string[];
  trendSource: string;
  keywords: string[];
};

export type TranscriptionRequest = {
  audioUrl: string;
  language?: string;
};

export type TranscriptionResponse = {
  text: string;
  segments: {
    start: number;
    end: number;
    text: string;
  }[];
  blogPost?: string;
};
