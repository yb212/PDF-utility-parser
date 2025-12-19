// PSE&G (Public Service Electric & Gas) Provider
// Extraction logic for PSE&G utility bills

export const psegProvider = {
  id: 'pseg',
  name: 'PSE&G',
  detectPatterns: [/\bPSEG\b/i, /Public\s*Service\s*Electric/i],

  extractData: (fullText, pages, addLog, normalizeAddress) => {
    let serviceAddress = null;
    let accountNumber = null;
    let gasSupplyCharges = null;
    let electricSupplyCharges = null;

    // Extract service address and account number from first page
    if (pages.length > 0) {
      const page1Text = pages[0].text;

      // Account number - capture all digits including spaces, then remove spaces
      const accountMatch = page1Text.match(/Account\s*number\s*[:\s]*([\d\s]+)/i);
      if (accountMatch) {
        accountNumber = accountMatch[1].replace(/\s+/g, '');
      }

      // Service address - extract full address including city, state, zip
      // Look for address pattern: street, city, state (2 letters), zip (5 or 5-4 digits)
      const addressMatch = page1Text.match(/Service\s*address[:\s]*(.+?)\s*(?:\d{5}(?:\s*-\s*\d{4})?)/is);
      if (addressMatch) {
        let rawAddress = addressMatch[0].replace(/Service\s*address[:\s]*/i, '').trim();
        // Clean up the address - remove extra spaces and normalize
        rawAddress = rawAddress.replace(/\s+/g, ' ').trim();
        serviceAddress = normalizeAddress(rawAddress);
      }
    }

    // Gas supply charges
    const gasChargesMatch = fullText.match(/Total\s+gas\s+supply\s+charges\s+\$?([\d,]+\.\d{2})/i);
    if (gasChargesMatch) {
      gasSupplyCharges = gasChargesMatch[1].replace(/,/g, '');
    }

    // Electric supply charges - try multiple patterns to handle third-party suppliers
    const electricPatterns = [
      /Total\s+electric\s+supply\s+charges\s+\$?([\d,]+\.\d{2})/i,  // Standard PSE&G
      /Electric\s+supply\s+charges\s+-\s+[^$\n]+\$?([\d,]+\.\d{2})/i,  // Third-party supplier (e.g., "Electric supply charges - AEP Energy, Inc. $6,882.85")
      /Total\s+[A-Z][^\n]+(?:Energy|Power)[^\n]+Charges\s+\$?([\d,]+\.\d{2})/i  // "Total AEP Energy, Inc. Charges $6,882.85"
    ];

    for (const pattern of electricPatterns) {
      const match = fullText.match(pattern);
      if (match) {
        electricSupplyCharges = match[1].replace(/,/g, '');
        break;
      }
    }

    addLog(`  Account: ${accountNumber || 'N/A'}, Address: ${serviceAddress || 'N/A'}`);
    addLog(`  Electric: $${electricSupplyCharges || 'N/A'}, Gas: $${gasSupplyCharges || 'N/A'}`);

    return { serviceAddress, accountNumber, gasSupplyCharges, electricSupplyCharges };
  }
};
