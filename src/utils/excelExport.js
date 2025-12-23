// Excel export utilities
import * as XLSX from 'xlsx';

/**
 * Replace null/undefined values with "Not Found"
 * @param {Array} results - Array of data objects
 * @returns {Array} - Array with null values replaced
 */
const replaceNullWithNotFound = (results) => {
  return results.map(row => {
    const cleanedRow = {};
    for (const [key, value] of Object.entries(row)) {
      cleanedRow[key] = (value === null || value === undefined || value === '') ? 'Not Found' : value;
    }
    return cleanedRow;
  });
};

/**
 * Export utility bill data with one tab per provider
 * @param {Array} results - Array of extracted bill data objects
 * @param {Object} options - Export options
 */
export const exportToExcel = (results, options = {}) => {
  if (!results || results.length === 0) {
    alert('No data to export');
    return;
  }

  const {
    fileName = 'utility_bill_data.xlsx'
  } = options;

  // Group results by provider
  const resultsByProvider = {};
  results.forEach(row => {
    const provider = row['Provider'] || 'Unknown';
    if (!resultsByProvider[provider]) {
      resultsByProvider[provider] = [];
    }
    resultsByProvider[provider].push(row);
  });

  // Create workbook
  const workbook = XLSX.utils.book_new();

  // Create a worksheet for each provider
  Object.keys(resultsByProvider).forEach(provider => {
    const providerData = resultsByProvider[provider];

    // Format data based on provider
    let formattedData;
    if (provider === 'ACE') {
      // ACE: Include ID Number
      formattedData = providerData.map(row => ({
        'File Name': row['File Name'],
        'ID Number': row['ID Number'],
        'Service Address': row['Service Address'],
        'Total Usage (kWh)': row['Total Usage (kWh)'],
        'Total Gas Supply Charges': row['Total Gas Supply Charges'],
        'Total Electric Supply Charges': row['Total Electric Supply Charges']
      }));
    } else if (provider === 'PSE&G') {
      // PSEG: Include PE and PG columns
      formattedData = providerData.map(row => ({
        'File Name': row['File Name'],
        'PE': row['PE'],
        'PG': row['PG'],
        'Service Address': row['Service Address'],
        'Total Usage (kWh)': row['Total Usage (kWh)'],
        'Total Gas Supply Charges': row['Total Gas Supply Charges'],
        'Total Electric Supply Charges': row['Total Electric Supply Charges']
      }));
    } else {
      // Unknown provider: Include all data as-is
      formattedData = providerData;
    }

    // Replace null values with "Not Found"
    const cleanedData = replaceNullWithNotFound(formattedData);

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(cleanedData);

    // Add worksheet to workbook with provider name as tab name
    XLSX.utils.book_append_sheet(workbook, worksheet, provider);
  });

  // Write file
  XLSX.writeFile(workbook, fileName);
};

/**
 * Export only gas-related data with one tab per provider
 * @param {Array} results - Array of extracted bill data objects
 * @param {Object} options - Export options
 */
export const exportGasOnly = (results, options = {}) => {
  if (!results || results.length === 0) {
    alert('No data to export');
    return;
  }

  const {
    fileName = 'utility_bill_gas_data.xlsx'
  } = options;

  // Group results by provider
  const resultsByProvider = {};
  results.forEach(row => {
    const provider = row['Provider'] || 'Unknown';
    if (!resultsByProvider[provider]) {
      resultsByProvider[provider] = [];
    }
    resultsByProvider[provider].push(row);
  });

  // Create workbook
  const workbook = XLSX.utils.book_new();

  // Create a worksheet for each provider
  Object.keys(resultsByProvider).forEach(provider => {
    const providerData = resultsByProvider[provider];

    // Format data based on provider (exclude electric charges)
    let formattedData;
    if (provider === 'ACE') {
      formattedData = providerData.map(row => ({
        'File Name': row['File Name'],
        'ID Number': row['ID Number'],
        'Service Address': row['Service Address'],
        'Total Usage (kWh)': row['Total Usage (kWh)'],
        'Total Gas Supply Charges': row['Total Gas Supply Charges']
      }));
    } else if (provider === 'PSE&G') {
      formattedData = providerData.map(row => ({
        'File Name': row['File Name'],
        'PE': row['PE'],
        'PG': row['PG'],
        'Service Address': row['Service Address'],
        'Total Usage (kWh)': row['Total Usage (kWh)'],
        'Total Gas Supply Charges': row['Total Gas Supply Charges']
      }));
    } else {
      formattedData = providerData;
    }

    // Replace null values with "Not Found"
    const cleanedData = replaceNullWithNotFound(formattedData);

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(cleanedData);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, provider);
  });

  // Write file
  XLSX.writeFile(workbook, fileName);
};

/**
 * Export only electric-related data with one tab per provider
 * @param {Array} results - Array of extracted bill data objects
 * @param {Object} options - Export options
 */
export const exportElectricOnly = (results, options = {}) => {
  if (!results || results.length === 0) {
    alert('No data to export');
    return;
  }

  const {
    fileName = 'utility_bill_electric_data.xlsx'
  } = options;

  // Group results by provider
  const resultsByProvider = {};
  results.forEach(row => {
    const provider = row['Provider'] || 'Unknown';
    if (!resultsByProvider[provider]) {
      resultsByProvider[provider] = [];
    }
    resultsByProvider[provider].push(row);
  });

  // Create workbook
  const workbook = XLSX.utils.book_new();

  // Create a worksheet for each provider
  Object.keys(resultsByProvider).forEach(provider => {
    const providerData = resultsByProvider[provider];

    // Format data based on provider (exclude gas charges)
    let formattedData;
    if (provider === 'ACE') {
      formattedData = providerData.map(row => ({
        'File Name': row['File Name'],
        'ID Number': row['ID Number'],
        'Service Address': row['Service Address'],
        'Total Usage (kWh)': row['Total Usage (kWh)'],
        'Total Electric Supply Charges': row['Total Electric Supply Charges']
      }));
    } else if (provider === 'PSE&G') {
      formattedData = providerData.map(row => ({
        'File Name': row['File Name'],
        'PE': row['PE'],
        'PG': row['PG'],
        'Service Address': row['Service Address'],
        'Total Usage (kWh)': row['Total Usage (kWh)'],
        'Total Electric Supply Charges': row['Total Electric Supply Charges']
      }));
    } else {
      formattedData = providerData;
    }

    // Replace null values with "Not Found"
    const cleanedData = replaceNullWithNotFound(formattedData);

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(cleanedData);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, provider);
  });

  // Write file
  XLSX.writeFile(workbook, fileName);
};
