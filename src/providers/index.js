// Provider Registry
// Import all utility providers and export as a single registry

import { aceProvider } from './ace';
import { psegProvider } from './pseg';

// ========================================================================
// PROVIDER REGISTRY
// ========================================================================
// To add a new utility provider:
// 1. Create a new file in src/providers/ (e.g., myutility.js)
// 2. Export a provider object with: id, name, detectPatterns, extractData
// 3. Import it here and add to the PROVIDERS object below
// ========================================================================

export const PROVIDERS = {
  [aceProvider.id]: aceProvider,
  [psegProvider.id]: psegProvider
};

// Auto-detect provider from PDF text
export const detectProvider = (fullText, addLog) => {
  for (const [providerId, provider] of Object.entries(PROVIDERS)) {
    for (const pattern of provider.detectPatterns) {
      if (pattern.test(fullText)) {
        addLog(`  Detected: ${provider.name}`);
        return providerId;
      }
    }
  }
  addLog('  Could not detect utility type, trying all providers...');
  return null;
};
