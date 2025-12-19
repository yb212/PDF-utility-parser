# Utility Functions

This directory contains reusable utility functions used across the application.

## Files

### addressUtils.js
Address normalization and formatting utilities.

**Functions:**
- `normalizeAddress(address)` - Cleans and standardizes address formatting
  - Fixes state codes (e.g., "N J" → "NJ")
  - Fixes zip codes (e.g., "07302- 6475" → "07302-6475")
  - Converts to title case
  - Uppercases state abbreviations (NJ, NY, PA, CT, MA)
  - Uppercases direction abbreviations (N, S, E, W, NE, NW, SE, SW)

### excelExport.js
Excel file generation and export utilities.

**Functions:**
- `exportToExcel(results, options)` - Basic Excel export with all data
  - Parameters:
    - `results` - Array of data objects to export
    - `options.sheetName` - Name of the worksheet (default: 'Utility Data')
    - `options.fileName` - Output filename (default: 'utility_bill_data.xlsx')
  - Empty/null values are replaced with "Not Found"

- `exportGasOnly(results, options)` - Export only gas-related data
  - Exports: File Name, Provider, Account Number, Service Address, Total Gas Supply Charges
  - Default filename: 'utility_bill_gas.xlsx'
  - Empty/null values are replaced with "Not Found"

- `exportElectricOnly(results, options)` - Export only electric-related data
  - Exports: File Name, Provider, Account Number, Service Address, Total Electric Supply Charges
  - Default filename: 'utility_bill_electric.xlsx'
  - Empty/null values are replaced with "Not Found"

- `exportToExcelWithFormatting(results, options)` - Excel export with auto-sized columns
  - Same parameters as `exportToExcel`
  - Automatically adjusts column widths based on content
  - Caps column width at 50 characters for readability

## Adding New Utilities

When adding new utility functions:
1. Create a new file or add to an existing one based on functionality
2. Export functions using ES6 export syntax
3. Document the function with JSDoc comments
4. Update this README with the new function
