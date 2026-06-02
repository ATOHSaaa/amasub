/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly PUBLIC_SITE_NAME: string;
  readonly PUBLIC_GA4_MEASUREMENT_ID: string;
  readonly PUBLIC_CLARITY_PROJECT_ID: string;
  readonly PUBLIC_AMAZON_ASSOCIATE_TAG: string;
  readonly AMAZON_CREATORS_API_ACCESS_KEY: string;
  readonly AMAZON_CREATORS_API_SECRET_KEY: string;
  readonly AMAZON_CREATORS_API_PARTNER_TAG: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
