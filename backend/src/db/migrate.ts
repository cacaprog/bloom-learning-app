import fs from 'fs';
import path from 'path';
import { db } from '../services/db.service.js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    console.log('Skipping migrations: DATABASE_URL not set.');
    process.exit(0);
  }
  try {
    console.log('Running database migrations...');
    let migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      const srcMigrations = path.join(__dirname, '..', '..', 'src', 'db', 'migrations');
      if (fs.existsSync(srcMigrations)) {
        migrationsDir = srcMigrations;
      } else {
        throw new Error(`Migrations directory not found: tried ${migrationsDir} and ${srcMigrations}`);
      }
    }
    const files = fs.readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    for (const file of files) {
      console.log(`Executing migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await db.query(sql);
    }
    console.log('Migrations completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
