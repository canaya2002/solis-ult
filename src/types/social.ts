// SOLIS AI — Social platform types

export type PlatformType =
  | "FACEBOOK"
  | "INSTAGRAM"
  | "TIKTOK"
  | "YOUTUBE"
  | "BLOG";

export type SocialPost = {
  id: string;
  platform: PlatformType;
  externalId?: string;
  text: string;
  mediaUrl?: string;
  hashtags: string[];
  scheduledAt?: Date;
  publishedAt?: Date;
  metrics?: SocialMetrics;
};

export type SocialMetrics = {
  impressions: number;
  reach: number;
  engagement: number;
  clicks: number;
  shares: number;
  saves: number;
  comments: number;
  engagementRate: number;
};

export type SocialComment = {
  id: string;
  platform: PlatformType;
  externalId: string;
  postExternalId: string;
  text: string;
  author: string;
  createdAt: Date;
};

export type PublishRequest = {
  platform: PlatformType;
  text: string;
  mediaUrl?: string;
  scheduledAt?: string;
};

export type PublishResponse = {
  externalId: string;
  url?: string;
};

// ─── Meta (Facebook + Instagram) ──────────────────────────────────────────────

export type MetaPost = {
  id: string;
  message: string;
  createdTime: string;
  shares: number;
  likes: number;
  comments: number;
};

export type MetaComment = {
  id: string;
  message: string;
  from: { id: string; name: string };
  createdTime: string;
};

export type MetaInsight = {
  name: string;
  period: string;
  values: Array<{ value: number; endTime: string }>;
};

// ─── TikTok ───────────────────────────────────────────────────────────────────

export type TikTokUser = {
  openId: string;
  displayName: string;
  avatarUrl: string;
  followerCount: number;
  followingCount: number;
  likesCount: number;
  videoCount: number;
};

export type TikTokVideo = {
  id: string;
  title: string;
  createTime: number;
  coverImageUrl: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
};

export type TikTokVideoInsights = {
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  avgWatchTime: number;
};

// ─── YouTube ──────────────────────────────────────────────────────────────────

export type YouTubeChannelStats = {
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
  channelTitle: string;
};

export type YouTubeVideo = {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
};

export type YouTubeVideoStats = {
  viewCount: number;
  likeCount: number;
  commentCount: number;
  favoriteCount: number;
};

export type YouTubeSearchResult = {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
};

// ─── Google Business Profile ──────────────────────────────────────────────────

export type GoogleReview = {
  reviewId: string;
  reviewer: { displayName: string };
  starRating: number;
  comment: string;
  createTime: string;
  reviewReply?: { comment: string; updateTime: string };
};

export type LocationMetrics = {
  totalReviews: number;
  averageRating: number;
  reviewsThisPeriod: number;
};
