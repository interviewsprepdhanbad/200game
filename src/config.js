const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = Object.freeze({
  port: toNumber(process.env.PORT, 3000),
  host: process.env.HOST || '0.0.0.0',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  staticDir: process.env.STATIC_DIR || 'public',
  sharedDir: process.env.SHARED_DIR || 'shared',
});
