import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev_secret_please_change_in_production_min_32_chars',
  jwtExpiry: '24h',
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),
  analyticsUrl: 'http://localhost:8000',
  simulationDefaultTickMs: parseInt(process.env.SIMULATION_DEFAULT_TICK_MS || '10000', 10),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};
