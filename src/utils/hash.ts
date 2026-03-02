import { createHash } from 'crypto';

const SALT = 'pmf-insights-ip-salt:';

export const hashIp = (ip: string): string =>
  createHash('sha256').update(`${SALT}${ip}`).digest('hex');
