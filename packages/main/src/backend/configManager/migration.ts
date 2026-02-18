import { configFilePath } from '@/app-globals';
import logger from '/@/logging/logger';
import fs from 'fs';

export function migrateOldConfig() {
  try {
    // If current config exists, no migration needed
    if (fs.existsSync(configFilePath)) {
      return;
    }

    // Future MoneyMoney config schema migrations can be added here
    logger.log('No existing config found, skipping migration');
  } catch (error) {
    logger.error('Failed to migrate config', error);
  }
}
