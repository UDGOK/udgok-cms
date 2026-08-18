const { execSync } = require('child_process');
process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_1QUlscp0eSLo@ep-fancy-violet-awgw1e4g-pooler.c-12.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require';
try {
  const result = execSync('/workspace/node_modules/.bin/prisma db push --skip-generate --schema /workspace/prisma/schema.prisma', {
    cwd: '/workspace',
    stdio: 'inherit',
    timeout: 120000
  });
  console.log('Prisma db push completed');
} catch (err) {
  console.error('Prisma db push failed:', err.message);
  process.exit(1);
}
