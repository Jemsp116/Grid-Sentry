import { vi } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-jwt-access-secret-key-32-chars!';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-32-chars!';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/grid_sentry_test';
process.env.KMS_MASTER_KEY = 'test-kms-master-key-32-chars-long!';
