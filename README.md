# ACE Utility PDF Parser

A web-based application that extracts data from ACE utility PDF bills and exports the results to Excel. Built with React, Vite, PDF.js, and Tailwind CSS.

## Features

- **Batch PDF Processing**: Upload and process multiple PDF files at once
- **Automatic Data Extraction**: Extracts key information from ACE utility bills:
  - Account Number
  - Service Address
  - Total Use (kWh)
  - Total Electric Supply Charges
- **Address Normalization**: Automatically fixes spacing issues in extracted addresses
- **Progress Tracking**: Real-time progress bar showing processing status
- **Error Handling**: Continues processing even if individual files fail, with detailed error reporting
- **Excel Export**: Export all extracted data to a formatted Excel spreadsheet
- **Modern UI**: Clean, responsive interface built with Tailwind CSS

## Demo

Visit the live demo: [https://yb212.github.io/PDF-utility-parser/](https://yb212.github.io/PDF-utility-parser/)

## Technology Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **PDF.js** - PDF parsing and text extraction
- **XLSX** - Excel file generation
- **Tailwind CSS** - Styling
- **GitHub Actions** - Automated deployment to GitHub Pages

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yb212/PDF-utility-parser.git
cd PDF-utility-parser
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to `http://localhost:5173`

## Usage

1. **Select PDFs**: Click "Select PDF Files" and choose one or more ACE utility bill PDFs
2. **Process**: Click "Process PDFs" to extract data from all selected files
3. **Review**: View the extracted data in the results table
4. **Export**: Click "Export to Excel" to download the data as an Excel file

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Deployment

### GitHub Pages

This project is configured for automatic deployment to GitHub Pages:

1. Push to the `main` branch
2. GitHub Actions will automatically build and deploy the site
3. Enable GitHub Pages in repository settings (Settings > Pages > Source: GitHub Actions)

### Manual Deployment

```bash
npm run deploy
```

## Project Structure

```
PDF-utility-parser/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions workflow
├── src/
│   ├── App.jsx                 # Root component
│   ├── main.jsx                # React entry point
│   ├── index.css               # Tailwind imports
│   └── PDFUtilityParser.jsx    # Main parser component
├── index.html                  # HTML entry point
├── vite.config.js              # Vite configuration
├── tailwind.config.js          # Tailwind configuration
├── postcss.config.js           # PostCSS configuration
├── package.json                # Dependencies
└── README.md                   # Documentation
```

## How It Works

### Data Extraction Process

1. **PDF Loading**: Uses PDF.js to load and parse PDF files
2. **Text Extraction**: Extracts text content from each page
3. **Pattern Matching**: Uses regex patterns to find:
   - `Yourserviceaddress : [address]` - Service address
   - `Accountnumber : [digits]` - Account number
   - Word "use" followed by numbers - Total usage
   - "Total Electric Supply Charges" followed by price - Charges
4. **Address Normalization**: Fixes spacing issues in addresses
5. **Excel Generation**: Converts extracted data to Excel using XLSX library

### Extraction Patterns

The parser looks for these specific patterns in ACE utility PDFs:

- **Service Address**: `Yourserviceaddress : <address>`
- **Account Number**: `Accountnumber : <digits>`
- **Total Use**: Finds "use" text and extracts numbers positioned below it
- **Electric Supply Charges**: Finds "Total Electric Supply Charges" and extracts the following dollar amount

## Customization

### Modifying Extraction Patterns

To adjust extraction patterns for different PDF formats, edit the regex patterns in `src/PDFUtilityParser.jsx`:

```javascript
// Service address pattern
const addressMatch = page1Text.match(/Yourserviceaddress\s*:\s*(\S+)/i);

// Account number pattern
const accountMatch = page1Text.match(/Accountnumber\s*:\s*(\d+)/i);

// Charges pattern
const labelRegex = /Total\s*Electric\s*Supply\s*Charges/i;
```

### Styling

The app uses Tailwind CSS. Modify classes in `src/PDFUtilityParser.jsx` or extend the theme in `tailwind.config.js`.

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Full support

## Known Limitations

- Requires PDFs to follow ACE utility bill format
- Coordinate-based extraction for "Total Use" may need adjustment for different PDF layouts
- Large batch processing (100+ files) may be slow in browser

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the MIT License.

## Acknowledgments

- [PDF.js](https://mozilla.github.io/pdf.js/) - Mozilla's PDF parsing library
- [SheetJS](https://sheetjs.com/) - Excel file generation
- [Vite](https://vitejs.dev/) - Next generation frontend tooling
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
