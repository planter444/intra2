const { query } = require('../config/db');
const fs = require('fs');
const path = require('path');

async function runMigration(migrationFile) {
  try {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'database', migrationFile), 'utf8');
    console.log(`Running migration: ${migrationFile}`);
    await query(sql);
    console.log(`Migration ${migrationFile} completed successfully`);
  } catch (error) {
    console.error(`Migration ${migrationFile} failed:`, error);
    throw error;
  }
}

// Run the appraisal management label update
runMigration('update_appraisal_management_label.sql')
  .then(() => {
    console.log('All migrations completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
