// PSE&G (Public Service Electric & Gas) Provider
// Extraction logic for PSE&G utility bills

export const psegProvider = {
  id: 'pseg',
  name: 'PSE&G',
  detectPatterns: [/\bPSEG\b/i, /Public\s*Service\s*Electric/i],

  extractData: (fullText, pages, addLog, normalizeAddress) => {
    let serviceAddress = null;
    let accountNumber = null; // Keep for ACE compatibility
    let electricPodId = null; // PE PoD for PSEG
    let gasPodId = null; // PG PoD for PSEG
    let gasSupplyCharges = null;
    let electricSupplyCharges = null;
    let totalUsageKwh = null;

    // Extract service address from first page
    if (pages.length > 0) {
      const page1Text = pages[0].text;

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

    // PoD (Point of Delivery) numbers - search full text (PoD is on page 3 or 4)
    // Format: "Your PoD ID is: PE000012054105751628" or "PG000012054105751628"
    // Extract only the 18 digits (not the PE/PG prefix)

    // Electric PoD (PE)
    const electricPodMatch = fullText.match(/Your\s+PoD\s+ID\s+is:\s+PE(\d{18})/i);
    if (electricPodMatch) {
      electricPodId = electricPodMatch[1];
    }

    // Gas PoD (PG)
    const gasPodMatch = fullText.match(/Your\s+PoD\s+ID\s+is:\s+PG(\d{18})/i);
    if (gasPodMatch) {
      gasPodId = gasPodMatch[1];
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

    // Extract total kWh usage - try multiple patterns
    const kwhPatterns = [
      /Total\s+(?:electric\s+)?(?:you\s+)?used\s+(?:in\s+\d+\s+days\s+)?([\d,]+)\s+kWh/i,  // "Total electric you used in 29 days 2,972 kWh"
      /Total\s+kWh\s+([\d,]+)/i,  // "Total kWh 79,516"
      /Total\s+(?:energy\s+)?used[:\s]+([\d,]+)\s+kWh/i,  // "Total energy used 2,520 kWh"
      /Total\s+kWh[:\s]+([\d,]+)/i  // Generic "Total kWh: 79516"
    ];

    for (const pattern of kwhPatterns) {
      const match = fullText.match(pattern);
      if (match) {
        totalUsageKwh = match[1].replace(/,/g, '');
        break;
      }
    }

    addLog(`  PE PoD: ${electricPodId || 'N/A'}, PG PoD: ${gasPodId || 'N/A'}`);
    addLog(`  Address: ${serviceAddress || 'N/A'}`);
    addLog(`  Electric: $${electricSupplyCharges || 'N/A'}, Gas: $${gasSupplyCharges || 'N/A'}`);
    addLog(`  Total Usage: ${totalUsageKwh || 'N/A'} kWh`);

    return { serviceAddress, accountNumber, electricPodId, gasPodId, gasSupplyCharges, electricSupplyCharges, totalUsageKwh };
  }
};
