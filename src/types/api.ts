export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type PaginatedResponse<T> = {
  success: boolean;
  data?: {
    items: T[];
    nextCursor?: string;
    total?: number;
  };
  error?: string;
};

export type CronResponse = {
  success: boolean;
  processed?: number;
  error?: string;
};
