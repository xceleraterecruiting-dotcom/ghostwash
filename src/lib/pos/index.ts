/**
 * POS Integration Module
 *
 * Entry point for all POS adapter functionality.
 */

// Export interface and types
export * from './adapter-interface';

// Import adapters to register them
import './washify-adapter';
import './csv-adapter';

// Export adapters
export { washifyAdapter } from './washify-adapter';
export { csvAdapter, parseCSV, processCSVImport } from './csv-adapter';

// Export sync pipeline
export {
  syncSite,
  syncAllSites,
  checkStaleSyncs,
  testPOSConnection,
  type SyncOptions,
  type SyncSiteResult,
} from './sync-pipeline';
