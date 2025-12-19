import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const PDFUtilityParser = () => {
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);
  const [errors, setErrors] = useState([]);

  // Normalize address - fixes spacing issues like the Python version
  const normalizeAddress = (address) => {
    if (!address) return null;

    // Add space between digit and letter
    address = address.replace(/(\d)([A-Za-z])/g, '$1 $2');
    // Add space between letter and digit
    address = address.replace(/([A-Za-z])(\d)/g, '$1 $2');
    // Add space after direction indicators
    address = address.replace(/\b([NSEW])([A-Z])/g, '$1 $2');
    // Add space before common street suffixes
    address = address.replace(
      /(AVE|ST|RD|DR|LN|BLVD|CT|CIR|PL|WAY|HWY)\b/gi,
      ' $1'
    );
    // Normalize whitespace
    address = address.replace(/\s+/g, ' ').trim();

    return address;
  };

  // Extract text from PDF using PDF.js
  const extractTextFromPDF = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let fullText = '';
    const pages = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      pages.push({ text: pageText, items: textContent.items });
      fullText += pageText + '\n';
    }

    return { fullText, pages, numPages: pdf.numPages };
  };

  // Extract data from a single PDF
  const extractFromPDF = async (file) => {
    const { fullText, pages, numPages } = await extractTextFromPDF(file);

    let serviceAddress = null;
    let accountNumber = null;
    let totalUse = null;
    let electricSupplyCharges = null;

    // ---------- PAGE 1 (Address & Account) ----------
    if (pages.length > 0) {
      const page1Text = pages[0].text;

      // Extract service address
      const addressMatch = page1Text.match(/Yourserviceaddress\s*:\s*(\S+)/i);
      if (addressMatch) {
        serviceAddress = normalizeAddress(addressMatch[1]);
      }

      // Extract account number
      const accountMatch = page1Text.match(/Accountnumber\s*:\s*(\d+)/i);
      if (accountMatch) {
        accountNumber = accountMatch[1];
      }
    }

    // ---------- PAGE 2 (Total Use) ----------
    if (pages.length > 1) {
      const page2Items = pages[1].items;

      // Find the word "use"
      const useItem = page2Items.find(item =>
        item.str.trim().toLowerCase() === 'use'
      );

      if (useItem) {
        // Find numbers below the "use" word
        const candidates = page2Items.filter(item => {
          const isNumber = /^[\d,]+$/.test(item.str);
          const isBelow = item.transform && useItem.transform &&
                         item.transform[5] < useItem.transform[5];
          const isAligned = item.transform && useItem.transform &&
                           Math.abs(item.transform[4] - useItem.transform[4]) < 10;
          return isNumber && isBelow && isAligned;
        });

        if (candidates.length > 0) {
          // Get the closest one below
          const closest = candidates.reduce((prev, curr) => {
            if (!prev.transform || !curr.transform) return prev;
            return curr.transform[5] > prev.transform[5] ? curr : prev;
          });
          totalUse = closest.str.replace(/,/g, '');
        }
      }
    }

    // ---------- TOTAL ELECTRIC SUPPLY CHARGES ----------
    const labelRegex = /Total\s*Electric\s*Supply\s*Charges/i;
    const labelMatch = fullText.match(labelRegex);

    if (labelMatch) {
      const afterLabel = fullText.substring(
        labelMatch.index + labelMatch[0].length,
        labelMatch.index + labelMatch[0].length + 60
      );
      const priceMatch = afterLabel.match(/[\$]?\s*([\d,]+\.\d{2})/);
      if (priceMatch) {
        electricSupplyCharges = priceMatch[1].replace(/,/g, '');
      }
    }

    return {
      'Service Address': serviceAddress,
      'Account Number': accountNumber,
      'Total Use': totalUse,
      'Total Electric Supply Charges': electricSupplyCharges,
      'File Name': file.name
    };
  };

  // Handle file selection
  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
    setResults([]);
    setErrors([]);
    setProgress(0);
  };

  // Process all PDFs
  const processPDFs = async () => {
    if (files.length === 0) {
      alert('Please select PDF files first');
      return;
    }

    setProcessing(true);
    setProgress(0);
    setResults([]);
    setErrors([]);

    const extractedData = [];
    const errorList = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        console.log(`Processing file: ${file.name}`);
        const data = await extractFromPDF(file);
        extractedData.push(data);
        setProgress(Math.round(((i + 1) / files.length) * 100));
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
        errorList.push({ fileName: file.name, error: error.message });
      }
    }

    setResults(extractedData);
    setErrors(errorList);
    setProcessing(false);
  };

  // Export to Excel
  const exportToExcel = () => {
    if (results.length === 0) {
      alert('No data to export');
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(results);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ACE Utility Data');
    XLSX.writeFile(workbook, 'ace_extracted_data.xlsx');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              ACE Utility PDF Parser
            </h1>
            <p className="text-gray-600">
              Extract account data from multiple ACE utility bills and export to Excel
            </p>
          </div>

          {/* Upload Area */}
          <div className="mb-8">
            <label className="block mb-2 text-sm font-medium text-gray-700">
              Select PDF Files
            </label>
            <input
              type="file"
              accept=".pdf"
              multiple
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none focus:border-blue-500 p-2.5"
            />
            {files.length > 0 && (
              <p className="mt-2 text-sm text-gray-600">
                {files.length} file{files.length > 1 ? 's' : ''} selected
              </p>
            )}
          </div>

          {/* Process Button */}
          <div className="mb-8">
            <button
              onClick={processPDFs}
              disabled={processing || files.length === 0}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 ease-in-out transform hover:scale-105 disabled:transform-none disabled:cursor-not-allowed"
            >
              {processing ? 'Processing...' : 'Process PDFs'}
            </button>
          </div>

          {/* Progress Bar */}
          {processing && (
            <div className="mb-8">
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className="text-center mt-2 text-sm text-gray-600">
                {progress}% Complete
              </p>
            </div>
          )}

          {/* Error Messages */}
          {errors.length > 0 && (
            <div className="mb-8 bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-red-800 font-semibold mb-2">
                Errors ({errors.length})
              </h3>
              {errors.map((err, idx) => (
                <div key={idx} className="text-sm text-red-700">
                  ❌ {err.fileName}: {err.error}
                </div>
              ))}
            </div>
          )}

          {/* Results Table */}
          {results.length > 0 && (
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold text-gray-800">
                  Extracted Data ({results.length} files)
                </h2>
                <button
                  onClick={exportToExcel}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                >
                  📥 Export to Excel
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-300 rounded-lg">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b">
                        File Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b">
                        Account Number
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b">
                        Service Address
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b">
                        Total Use
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider border-b">
                        Total Electric Supply Charges
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {results.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {row['File Name']}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {row['Account Number'] || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {row['Service Address'] || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {row['Total Use'] || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {row['Total Electric Supply Charges'] ? `$${row['Total Electric Supply Charges']}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PDFUtilityParser;
