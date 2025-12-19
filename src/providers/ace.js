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

    // Log results
    addLog(`  Account: ${accountNumber || 'N/A'}, Address: ${serviceAddress || 'N/A'}`);
    addLog(`  Electric: $${electricSupplyCharges || 'N/A'}, Gas: ${gasSupplyCharges}`);

    return { serviceAddress, accountNumber, gasSupplyCharges, electricSupplyCharges };
  }
};
