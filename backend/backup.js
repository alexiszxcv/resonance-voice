#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const SESSION_DATA_PATH = path.join(__dirname, 'session_data.json');
const BACKUP_DIR = path.join(__dirname, 'backups');

// Create backups directory if it doesn't exist
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR);
}

// Generate backup filename with timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFilename = `session_data_backup_${timestamp}.json`;
const backupPath = path.join(BACKUP_DIR, backupFilename);

try {
  // Check if session data exists
  if (fs.existsSync(SESSION_DATA_PATH)) {
    // Copy session data to backup
    fs.copyFileSync(SESSION_DATA_PATH, backupPath);
    console.log(`Backup created: ${backupFilename}`);

    // Clean up old backups (keep last 10)
    const backups = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('session_data_backup_'))
      .sort()
      .reverse();

    if (backups.length > 10) {
      const toDelete = backups.slice(10);
      toDelete.forEach(file => {
        fs.unlinkSync(path.join(BACKUP_DIR, file));
        console.log(`Deleted old backup: ${file}`);
      });
    }
  } else {
    console.log('No session data file found to backup');
  }
} catch (error) {
  console.error('Backup failed:', error);
  process.exit(1);
}