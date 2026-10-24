/** Absolute origin of the production site, for sitemap, robots and canonical URLs. Next needs these absolute. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://hayplan.vercel.app");
