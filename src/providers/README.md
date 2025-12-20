# Provider System

This directory contains utility bill provider implementations. Each provider extracts data from a specific utility company's PDF bills.

## Adding a New Provider

### 1. Create Provider File

Create a new file in this directory (e.g., `myutility.js`) with the following structure:

```javascript
// MyUtility Provider
// Extraction logic for MyUtility bills

export const myutilityProvider = {
  id: 'myutility',  // Lowercase unique identifier
  name: 'MyUtility',  // Display name shown to users

  // Regex patterns to auto-detect this provider from PDF content
  detectPatterns: [
    /\bMYUTILITY\b/i,
    /My\s*Utility\s*Company/i
  ],

  // Extraction function that parses PDF data
  // Parameters:
  //   - fullText: concatenated text from all PDF pages
  //   - pages: array of page objects with .text and .items properties
  //   - addLog: function to add debug log messages
  //   - normalizeAddress: function to clean/format addresses
  // Returns:
  //   { serviceAddress, accountNumber, gasSupplyCharges, electricSupplyCharges, totalUsageKwh }
  extractData: (fullText, pages, addLog, normalizeAddress) => {
    let serviceAddress = null;
    let accountNumber = null;
    let gasSupplyCharges = null;
    let electricSupplyCharges = null;
    let totalUsageKwh = null;

    // Extract data using regex patterns specific to this provider
    if (pages.length > 0) {
      const page1Text = pages[0].text;

      // Example: Extract account number
      const accountMatch = page1Text.match(/Account\s*#\s*(\d+)/i);
      if (accountMatch) {
        accountNumber = accountMatch[1];
      }

      // Example: Extract and normalize address
      const addressMatch = page1Text.match(/Service\s*Address:\s*(.+?)(?=\n|$)/i);
      if (addressMatch) {
        serviceAddress = normalizeAddress(addressMatch[1]);
      }
    }

    // Example: Extract charges from full text
    const gasMatch = fullText.match(/Total\s*Gas\s*Charges\s*\$?([\d,]+\.\d{2})/i);
    if (gasMatch) {
      gasSupplyCharges = gasMatch[1].replace(/,/g, '');
    }

    const electricMatch = fullText.match(/Total\s*Electric\s*Charges\s*\$?([\d,]+\.\d{2})/i);
    if (electricMatch) {
      electricSupplyCharges = electricMatch[1].replace(/,/g, '');
    }

    // Example: Extract kWh usage
    const kwhMatch = fullText.match(/Total\s*kWh\s*([\d,]+)/i);
    if (kwhMatch) {
      totalUsageKwh = kwhMatch[1].replace(/,/g, '');
    }

    // Log extraction results for debugging
    addLog(`  Account: ${accountNumber || 'N/A'}, Address: ${serviceAddress || 'N/A'}`);
    addLog(`  Electric: $${electricSupplyCharges || 'N/A'}, Gas: $${gasSupplyCharges || 'N/A'}`);
    addLog(`  Total Usage: ${totalUsageKwh || 'N/A'} kWh`);

    return { serviceAddress, accountNumber, gasSupplyCharges, electricSupplyCharges, totalUsageKwh };
  }
};
```

### 2. Register Provider

Add your provider to `index.js`:

```javascript
import { aceProvider } from './ace';
import { psegProvider } from './pseg';
import { myutilityProvider } from './myutility';  // Add this

export const PROVIDERS = {
  [aceProvider.id]: aceProvider,
  [psegProvider.id]: psegProvider,
  [myutilityProvider.id]: myutilityProvider  // Add this
};
```

### 3. Test

1. Add test PDFs to `test/test_pdfs/myutility/`
2. Run the app with `npm run dev`
3. Use Auto-detect mode to verify your provider is detected correctly
4. Check the debug logs to ensure data extraction works properly

## Existing Providers

- **ace.js** - Atlantic City Electric
  - Handles third-party electric suppliers (e.g., XOOM Energy)
  - Gas: Always returns "ACE Doesn't Supply Gas" (electric-only provider)
  - Extracts: Account number, service address, electric supply charges, total kWh usage

- **pseg.js** - Public Service Electric & Gas
  - Handles both PSE&G standard supply and third-party suppliers (e.g., AEP Energy via CHOICE program)
  - Supports both gas and electric services
  - Extracts: Account number, service address, gas supply charges, electric supply charges, total kWh usage

## Tips

- Use regex patterns carefully - PDF text extraction can have unexpected spacing
- Test with multiple bill samples to ensure patterns work across different formats
- Use `addLog()` liberally for debugging
- The `normalizeAddress()` utility handles common address formatting issues
- All charge amounts should be returned as strings without dollar signs or commas
