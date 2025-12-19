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
 * Export utility bill data to Excel file
 * @param {Array} results - Array of extracted bill data objects
 * @param {Object} options - Export options
 * @param {string} options.sheetName - Name of the worksheet (default: 'Utility Data')
 * @param {string} options.fileName - Output filename (default: 'utility_bill_data.xlsx')
 */
export const exportToExcel = (results, options = {}) => {
  if (!results || results.length === 0) {
    alert('No data to export');
    return;
  }

  const {
    sheetName = 'Utility Data',
    fileName = 'utility_bill_data.xlsx'
  } = options;

  // Replace null values with "Not Found"
  const cleanedResults = replaceNullWithNotFound(results);

  // Create worksheet from JSON data
  const worksheet = XLSX.utils.json_to_sheet(cleanedResults);

  // Create workbook and add worksheet
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Write file
  XLSX.writeFile(workbook, fileName);
};

/**
 * Export utility bill data with custom formatting
 * @param {Array} results - Array of extracted bill data objects
 * @param {Object} options - Export options
 */
export const exportToExcelWithFormatting = (results, options = {}) => {
  if (!results || results.length === 0) {
    alert('No data to export');
    return;
  }

  const {
    sheetName = 'Utility Data',
    fileName = 'utility_bill_data.xlsx'
  } = options;

  // Create worksheet from JSON data
  const worksheet = XLSX.utils.json_to_sheet(results);

  // Auto-size columns based on content
  const columnWidths = [];
  const headers = Object.keys(results[0]);

  headers.forEach((header, i) => {
    const maxLength = Math.max(
      header.length,
      ...results.map(row => (row[header] ? String(row[header]).length : 0))
    );
    columnWidths[i] = { wch: Math.min(maxLength + 2, 50) }; // Cap at 50 chars
  });

  worksheet['!cols'] = columnWidths;

  // Create workbook and add worksheet
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Write file
  XLSX.writeFile(workbook, fileName);
};

/**
 * Export only gas-related data
 * @param {Array} results - Array of extracted bill data objects
 * @param {Object} options - Export options
 */
export const exportGasOnly = (results, options = {}) => {
  if (!results || results.length === 0) {
    alert('No data to export');
    return;
  }

  const {
    sheetName = 'Gas Data',
    fileName = 'utility_bill_gas_data.xlsx'
  } = options;

  // Filter out electric column
  const gasData = results.map(row => ({
    'File Name': row['File Name'],
    'Provider': row['Provider'],
    'Account Number': row['Account Number'],
    'Service Address': row['Service Address'],
    'Total Gas Supply Charges': row['Total Gas Supply Charges']
  }));

  // Replace null values with "Not Found"
  const cleanedData = replaceNullWithNotFound(gasData);

  const worksheet = XLSX.utils.json_to_sheet(cleanedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, fileName);
};

/**
 * Export only electric-related data
 * @param {Array} results - Array of extracted bill data objects
 * @param {Object} options - Export options
 */
export const exportElectricOnly = (results, options = {}) => {
  if (!results || results.length === 0) {
    alert('No data to export');
    return;
  }

  const {
    sheetName = 'Electric Data',
    fileName = 'utility_bill_electric_data.xlsx'
  } = options;

  // Filter out gas column
  const electricData = results.map(row => ({
    'File Name': row['File Name'],
    'Provider': row['Provider'],
    'Account Number': row['Account Number'],
    'Service Address': row['Service Address'],
    'Total Electric Supply Charges': row['Total Electric Supply Charges']
  }));

  // Replace null values with "Not Found"
  const cleanedData = replaceNullWithNotFound(electricData);

  const worksheet = XLSX.utils.json_to_sheet(cleanedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, fileName);
};
