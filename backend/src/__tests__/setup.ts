/**
 * Test environment. Provides the env vars that config/env.ts validates at
 * import time, so unit tests can import modules (like utils/tokens) without a
 * real .env. These are dummy values — no real secret ever lives here.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
process.env.JWT_ACCESS_SECRET = 'test_access_secret_0123456789abcdef';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_fedcba9876543210';
process.env.JWT_ACCESS_EXPIRY = '15m';
process.env.JWT_REFRESH_EXPIRY = '7d';
