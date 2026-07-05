export interface AppConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  redisUrl: string;
  opensearchNode: string;
  authSecret: string;
  smtp: { host: string; port: number; from: string };
  stripe: { secretKey: string; webhookSecret: string };
  enrichmentProvider: 'MOCK' | 'CLEARBIT_STYLE' | 'HUNTER_STYLE';
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.API_PORT ?? 3001),
  databaseUrl: process.env.DATABASE_URL ?? '',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  opensearchNode: process.env.OPENSEARCH_NODE ?? 'http://localhost:9200',
  authSecret: process.env.AUTH_SECRET ?? 'dev-only-change-me-please-32-chars-min',
  smtp: {
    host: process.env.SMTP_HOST ?? 'localhost',
    port: Number(process.env.SMTP_PORT ?? 1025),
    from: process.env.SMTP_FROM ?? 'Prospect <no-reply@prospect-demo.com>',
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  },
  enrichmentProvider:
    (process.env.ENRICHMENT_PROVIDER as AppConfig['enrichmentProvider']) ?? 'MOCK',
});
