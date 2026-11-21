'use strict';
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'audit.log');

let folderReady = null;

/**
 * Makes sure the logs folder exists. Runs once, then remembers the answer.
 *
 * Rules:
 *  1. recursive: true means "do nothing if it already exists"
 *  2. If it fails, forget the result so the next call tries again
 */
function ensureFolder() {
  if (!folderReady) {
    folderReady = fs.promises.mkdir(LOG_DIR, { recursive: true }).catch((err) => {
      folderReady = null;
      throw err;
    });
  }
  return folderReady;
}

/**
 * Adds one line to logs/audit.log, e.g. {"timestamp":"...","event":"appointment.booked",...}
 *
 * This function never throws. If writing fails, it prints a warning
 * and the user's request carries on as normal.
 */
async function audit(event, data = {}) {
  try {
    await ensureFolder();
    const line = JSON.stringify({ timestamp: new Date().toISOString(), event, ...data }) + '\n';
    await fs.promises.appendFile(LOG_FILE, line, 'utf8');
  } catch (err) {
    console.error('Could not write to the audit log:', err.message);
  }
}

module.exports = { audit };