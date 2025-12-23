// ACE (Atlantic City Electric) Provider
// Extraction logic for ACE utility bills

export const aceProvider = {
  id: 'ace',
  name: 'ACE',
  detectPatterns: [/\bACE\b/i, /Atlantic\s*City\s*Electric/i],

  extractData: (fullText, pages, addLog, normalizeAddress) => {
    let serviceAddress = null;
    let accountNumber = null;
    let gasSupplyCharges = "ACE Doesn't Supply Gas";  // ACE is electric-only
    let electricSupplyCharges = null;
    let totalUsageKwh = null;

    // Extract service address and account number from first page
    if (pages.length > 0) {
      const page1Text = pages[0].text;

      // Account number - handle both "Accountnumber" and "Account number"
      const accountMatch = page1Text.match(/Account\s*number\s*:\s*([\d\s]+)/i);
      if (accountMatch) {
        accountNumber = accountMatch[1].replace(/\s+/g, '');
      }

      // Service address - capture full address line (not just first word)
      const addressMatch = page1Text.match(/Your\s*service\s*address\s*:\s*(.+?)(?=\s*Bill|$)/is);
      if (addressMatch) {
        serviceAddress = normalizeAddress(addressMatch[1].trim());
      }
    }

    // Extract electric supply charges - try multiple patterns for different suppliers
    const electricPatterns = [
      /Total\s+Electric\s+Supply\s+Charges\s+\$?([\d,]+\.\d{2})/i,
      /New\s+XOOM\s+Energy\s+NJ\s+supply\s+charges\s+\$?([\d,]+\.\d{2})/i,
      /XOOM\s+Energy\s+NJ\s+electric\s+charges\s+\$?([\d,]+\.\d{2})/i,
      /(?:New\s+)?electric\s+supply\s+charges\s+\$?([\d,]+\.\d{2})/i,
      /supply\s+charges\s+\$?([\d,]+\.\d{2})/i
    ];

    for (const pattern of electricPatterns) {
      const match = fullText.match(pattern);
      if (match) {
        electricSupplyCharges = match[1].replace(/,/g, '');
        break;
      }
    }

    // Extract total kWh usage - try multiple patterns
    // ACE bills have meter readings spread across multiple lines:
    // "Use (kWh)" → date → current reading (6 digits) → date → previous reading (6 digits) + difference + multiplier + total (all on one line)
    const kwhPatterns = [
      // Pattern 1: Multi-line pattern - "Use (kWh)" then anywhere find: 6-digit current, 6-digit previous, then diff + mult + total on same line
      // Captures: current reading, previous reading, difference, multiplier, total use
      /Use\s*\(kWh\)[\s\S]*?(\d{6})[\s\S]*?(\d{6})\s+(\d+)\s+(\d+)\s+(\d+)/i,

      // Pattern 2: More flexible - find the table structure after "Difference Multiplier Total Use" headers
      // Looks for the row with any multiplier value and captures the total
      /Difference\s+Multiplier\s+Total\s+Use[\s\S]{0,200}?(\d+)\s+(\d+)\s+(\d+)/i,

      // Pattern 3: Look for sequence of numbers with multiplier pattern (prev reading + 3 more numbers on same line)
      // This matches the line: "059363 695 80 55600" (previous, diff, mult, total)
      /(\d{6})\s+(\d+)\s+(\d+)\s+(\d+)/,

      // Pattern 4: Fallback - simple "Total Use" followed by a number
      /Total\s+Use\s+(\d+)/i
    ];

    for (const pattern of kwhPatterns) {
      const match = fullText.match(pattern);
      if (match) {
        // Use the last captured group (total use value)
        totalUsageKwh = match[match.length - 1];
        addLog(`  Matched kWh pattern, extracted: ${totalUsageKwh}`);
        break;
      }
    }

    // Log results
    addLog(`  Account: ${accountNumber || 'N/A'}, Address: ${serviceAddress || 'N/A'}`);
    addLog(`  Electric: $${electricSupplyCharges || 'N/A'}, Gas: ${gasSupplyCharges}`);
    addLog(`  Total Usage: ${totalUsageKwh || 'N/A'} kWh`);

    return { serviceAddress, accountNumber, gasSupplyCharges, electricSupplyCharges, totalUsageKwh };
  }
};
