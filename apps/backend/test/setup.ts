import 'reflect-metadata';
import 'dotenv/config';

process.env.NODE_ENV ??= 'test';
process.env.PORT ??= '3000';
process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5433/new_talents_test';
process.env.ALLOWED_ORIGINS ??= 'http://localhost:8081';
