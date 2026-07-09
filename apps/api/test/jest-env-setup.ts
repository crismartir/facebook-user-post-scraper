process.env.DATABASE_URL ??=
  'postgresql://opfy:opfy@localhost:5432/opfy_board_test?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_ACCESS_TTL ??= '15m';
process.env.REFRESH_TOKEN_HASH_SECRET ??= 'test-refresh-secret';
process.env.REFRESH_TOKEN_TTL_DAYS ??= '30';
process.env.COOKIE_SECURE ??= 'false';
process.env.WEB_ORIGIN ??= 'http://localhost:3000';
