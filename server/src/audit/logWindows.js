import { LOG_RETENTION_DAYS } from '../config/env.js';

const DAY = 24 * 60 * 60 * 1000;
export const LOG_WINDOWS = {
  '1h': DAY / 24, '6h': DAY / 4, '24h': DAY, '7d': 7 * DAY,
  ...(LOG_RETENTION_DAYS >= 31 ? { '31d': 31 * DAY } : {}),
  ...(LOG_RETENTION_DAYS >= 186 ? { '186d': 186 * DAY } : {}),
  ...(LOG_RETENTION_DAYS >= 365 ? { '365d': 365 * DAY } : {}),
};
