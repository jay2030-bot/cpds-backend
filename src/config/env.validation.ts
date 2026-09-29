export function validateEnv(config: Record<string, unknown>) {
  const required = ['DATABASE_URL', 'JWT_SECRET', 'FRONTEND_URL'];
  const missing = required.filter((k) => !config[k]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  if (String(config.JWT_SECRET).length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
  return config;
}
