import { execSync } from 'child_process';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');

export default async function globalSetup() {
  // Create test database if it doesn't exist
  try {
    execSync(
      'docker compose exec -T db psql -U postgres -c "CREATE DATABASE flowboard_test" postgres',
      { cwd: ROOT, stdio: 'pipe' },
    );
  } catch {
    // Database already exists — ok
  }

  // Run migrations against the test database
  execSync('npx prisma migrate deploy', {
    cwd: path.resolve(ROOT, 'api'),
    env: {
      ...process.env,
      DATABASE_URL: 'postgresql://postgres:password@localhost:5433/flowboard_test',
    },
    stdio: 'inherit',
  });
}
