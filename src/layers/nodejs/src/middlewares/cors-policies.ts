export type CorsPolicy = {
  origin: string;
  credentials?: boolean;
  headers?: string;
  methods?: string;
};

// Map static path prefixes to their CORS settings
export const corsPolicies: Record<string, CorsPolicy> = {
  // Applies to GET/POST /messages
  '/messages': {
    origin: '*',
    credentials: true,
    headers: 'Content-Type,Authorization',
    methods: 'GET,POST,OPTIONS',
  },
};
