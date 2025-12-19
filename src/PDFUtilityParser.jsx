import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';

// Use static path to bundled worker file from public directory
pdfjsLib.GlobalWorkerOptions.workerSrc = '/PDF-utility-parser/pdf.worker.min.mjs';

const PDFUtilityParser = () => {
  const APP_VERSION = 'v1.4.6';

  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);
  const [errors, setErrors] = useState([]);
  const [currentFile, setCurrentFile] = useState('');
  const [debugLogs, setDebugLogs] = useState([]);
  const [utilityMode, setUtilityMode] = useState('auto'); // 'auto', 'ace', 'pseg'
  const [dragActive, setDragActive] = useState(false);
  const [showDebugLogs, setShowDebugLogs] = useState(false);

  // Add debug log helper
  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(message);
  };

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
    addLog(`Starting PDF extraction for: ${file.name}`);
    try {
      // Step 1: Read file
      addLog(`Step 1: Reading file into ArrayBuffer...`);
      const arrayBuffer = await file.arrayBuffer();
      addLog(`✓ File loaded - Size: ${arrayBuffer.byteLength} bytes`);

      // Step 2: Load PDF document
      addLog(`Step 2: Loading PDF document...`);
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      addLog(`✓ PDF loaded! ${pdf.numPages} pages found`);

      let fullText = '';
      const pages = [];

      // Step 3: Extract text from each page
      addLog(`Step 3: Extracting text from ${pdf.numPages} pages...`);
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        pages.push({ text: pageText, items: textContent.items });
        fullText += pageText + '\n';

        if (i === 1 || i === pdf.numPages) {
          addLog(`✓ Page ${i}/${pdf.numPages} done (${textContent.items.length} items, ${pageText.length} chars)`);
        }
      }

      addLog(`✓✓✓ SUCCESS! Extracted ${fullText.length} characters total`);
      return { fullText, pages, numPages: pdf.numPages };
    } catch (error) {
      addLog(`❌ CRITICAL ERROR: ${error.name || 'Unknown'}`);
      addLog(`❌ Error message: ${error.message}`);
      addLog(`❌ Error stack: ${error.stack?.substring(0, 200) || 'No stack trace'}`);
      throw new Error(`PDF extraction failed: ${error.message}`);
    }
  };

  // Extract data from ACE utility bill
  const extractACEData = (fullText, pages) => {
    let serviceAddress = null;
    let accountNumber = null;
    let totalUse = null;
    let electricSupplyCharges = null;

    addLog('Trying ACE extraction patterns...');

    // ---------- PAGE 1 (Address & Account) ----------
    if (pages.length > 0) {
      const page1Text = pages[0].text;
      addLog(`Page 1 text preview (first 500 chars): ${page1Text.substring(0, 500)}...`);

      // Extract service address
      const addressMatch = page1Text.match(/Yourserviceaddress\s*:\s*(\S+)/i);
      if (addressMatch) {
        serviceAddress = normalizeAddress(addressMatch[1]);
        addLog(`Found ACE service address: ${serviceAddress}`);
      }

      // Extract account number
      const accountMatch = page1Text.match(/Accountnumber\s*:\s*(\d+)/i);
      if (accountMatch) {
        accountNumber = accountMatch[1];
        addLog(`Found ACE account number: ${accountNumber}`);
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
          const closest = candidates.reduce((prev, curr) => {
            if (!prev.transform || !curr.transform) return prev;
            return curr.transform[5] > prev.transform[5] ? curr : prev;
          });
          totalUse = closest.str.replace(/,/g, '');
          addLog(`Found ACE total use: ${totalUse}`);
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
        addLog(`Found ACE electric charges: $${electricSupplyCharges}`);
      }
    }

    return { serviceAddress, accountNumber, totalUse, electricSupplyCharges };
  };

  // Extract data from PSEG utility bill
  const extractPSEGData = (fullText, pages) => {
    let serviceAddress = null;
    let accountNumber = null;
    let totalUse = null;
    let electricSupplyCharges = null;

    addLog('Trying PSEG extraction patterns...');

    if (pages.length > 0) {
      const page1Text = pages[0].text;
      addLog(`Page 1 text preview (first 500 chars): ${page1Text.substring(0, 500)}...`);

      // PSEG account number - look for patterns like "Account number 7300086802"
      const accountMatch = page1Text.match(/Account\s*number\s*[:\s]*(\d+)/i);
      if (accountMatch) {
        accountNumber = accountMatch[1];
        addLog(`Found PSEG account number: ${accountNumber}`);
      }

      // PSEG service address - various patterns
      const addressMatch = page1Text.match(/Service\s*(?:address|location)\s*[:\s]*(.+?)(?:\n|Account|$)/i);
      if (addressMatch) {
        serviceAddress = normalizeAddress(addressMatch[1].trim());
        addLog(`Found PSEG service address: ${serviceAddress}`);
      }
    }

    // PSEG usage patterns - look for kWh
    const usageMatch = fullText.match(/(\d+)\s*kWh/i) || fullText.match(/Total\s*(?:usage|use)\s*[:\s]*(\d+)/i);
    if (usageMatch) {
      totalUse = usageMatch[1].replace(/,/g, '');
      addLog(`Found PSEG total use: ${totalUse} kWh`);
    }

    // PSEG charges - look for various charge patterns
    const chargesMatch = fullText.match(/(?:Total\s*(?:amount|charges|due)|Amount\s*due)\s*[:\$\s]*([\d,]+\.\d{2})/i);
    if (chargesMatch) {
      electricSupplyCharges = chargesMatch[1].replace(/,/g, '');
      addLog(`Found PSEG charges: $${electricSupplyCharges}`);
    }

    return { serviceAddress, accountNumber, totalUse, electricSupplyCharges };
  };

  // Extract data from a single PDF
  const extractFromPDF = async (file) => {
    const { fullText, pages, numPages } = await extractTextFromPDF(file);

    // Debug: show sample of extracted text
    addLog(`Full text preview (first 800 chars): ${fullText.substring(0, 800).replace(/\s+/g, ' ')}...`);

    let result = {
      serviceAddress: null,
      accountNumber: null,
      totalUse: null,
      electricSupplyCharges: null
    };

    // Determine which extraction method to use
    let detectedMode = utilityMode;

    if (utilityMode === 'auto') {
      // Auto-detect based on content
      const aceMatch = fullText.match(/ACE|Atlantic\s*City\s*Electric/i);
      const psegMatch = fullText.match(/PSEG|Public\s*Service\s*Electric/i);

      if (aceMatch) {
        detectedMode = 'ace';
        addLog(`Auto-detected: ACE utility bill (found: "${aceMatch[0]}")`);
      } else if (psegMatch) {
        detectedMode = 'pseg';
        addLog(`Auto-detected: PSEG utility bill (found: "${psegMatch[0]}")`);
      } else {
        addLog('Could not auto-detect utility type, trying both...');
        detectedMode = 'both';
      }
    }

    // Try ACE extraction
    if (detectedMode === 'ace' || detectedMode === 'both') {
      const aceData = extractACEData(fullText, pages);
      if (aceData.accountNumber || aceData.serviceAddress) {
        result = aceData;
        addLog('✓ ACE extraction successful');
      } else {
        addLog('✗ ACE extraction found no data');
      }
    }

    // Try PSEG extraction if ACE didn't work or if PSEG mode
    if ((detectedMode === 'pseg' || detectedMode === 'both') && !result.accountNumber) {
      const psegData = extractPSEGData(fullText, pages);
      if (psegData.accountNumber || psegData.serviceAddress) {
        result = psegData;
        addLog('✓ PSEG extraction successful');
      } else {
        addLog('✗ PSEG extraction found no data');
      }
    }

    return {
      'Service Address': result.serviceAddress,
      'Account Number': result.accountNumber,
      'Total Use': result.totalUse,
      'Total Electric Supply Charges': result.electricSupplyCharges,
      'File Name': file.name
    };
  };

  // Handle file selection
  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    addFiles(selectedFiles);
  };

  // Add files to the list (used by both file input and drag & drop)
  const addFiles = (newFiles) => {
    const pdfFiles = newFiles.filter(file => file.type === 'application/pdf');
    setFiles(prev => [...prev, ...pdfFiles]);
    setResults([]);
    setErrors([]);
    setProgress(0);
  };

  // Remove a file from the list
  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      addFiles(droppedFiles);
    }
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
    setDebugLogs([]);

    addLog(`=== Starting batch processing of ${files.length} file(s) ===`);

    const extractedData = [];
    const errorList = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        setCurrentFile(file.name);
        addLog(`\n--- Processing file ${i + 1}/${files.length}: ${file.name} ---`);
        const data = await extractFromPDF(file);
        extractedData.push(data);
        addLog(`✓ Successfully processed ${file.name}`);
        setProgress(Math.round(((i + 1) / files.length) * 100));
      } catch (error) {
        addLog(`✗ ERROR processing ${file.name}: ${error.message}`);
        errorList.push({ fileName: file.name, error: error.message });
      }
    }

    setResults(extractedData);
    setErrors(errorList);
    setProcessing(false);
    setCurrentFile('');
    addLog(`\n=== Processing complete! Extracted ${extractedData.length} files successfully ===`);
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
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold text-gray-800 mb-2">
                  Utility Bill PDF Parser
                </h1>
                <p className="text-gray-600">
                  Extract account data from ACE and PSEG utility bills and export to Excel
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500">
                  {APP_VERSION}
                </div>
              </div>
            </div>
          </div>

          {/* Utility Mode Selector */}
          <div className="mb-8">
            <label className="block mb-2 text-sm font-medium text-gray-700">
              Utility Company
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="auto"
                  checked={utilityMode === 'auto'}
                  onChange={(e) => setUtilityMode(e.target.value)}
                  className="mr-2"
                />
                <span className="text-sm">Auto-detect</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="ace"
                  checked={utilityMode === 'ace'}
                  onChange={(e) => setUtilityMode(e.target.value)}
                  className="mr-2"
                />
                <span className="text-sm">ACE</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="pseg"
                  checked={utilityMode === 'pseg'}
                  onChange={(e) => setUtilityMode(e.target.value)}
                  className="mr-2"
                />
                <span className="text-sm">PSEG</span>
              </label>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Auto-detect will identify the utility type automatically
            </p>
          </div>

          {/* Upload Area with Drag & Drop */}
          <div className="mb-8">
            <label className="block mb-2 text-sm font-medium text-gray-700">
              Select PDF Files
            </label>
            <div
              className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 bg-gray-50 hover:border-gray-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept=".pdf"
                multiple
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="pointer-events-none">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="mt-2 text-sm text-gray-600">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500">PDF files only</p>
              </div>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-gray-700">
                  Selected files ({files.length}):
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3 hover:bg-gray-50"
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <svg
                          className="h-8 w-8 text-red-500 flex-shrink-0"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        className="ml-4 text-red-600 hover:text-red-800 flex-shrink-0"
                        title="Remove file"
                      >
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
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
              {currentFile && (
                <p className="text-center mt-1 text-xs text-gray-500">
                  Processing: {currentFile}
                </p>
              )}
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

          {/* Debug Logs - Collapsible */}
          {debugLogs.length > 0 && (
            <div className="mb-8 bg-gray-50 border border-gray-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowDebugLogs(!showDebugLogs)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-100 transition-colors"
              >
                <h3 className="text-gray-800 font-semibold">
                  Processing Log ({debugLogs.length} entries)
                </h3>
                <svg
                  className={`h-5 w-5 text-gray-600 transition-transform ${
                    showDebugLogs ? 'transform rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {showDebugLogs && (
                <div className="px-4 pb-4">
                  <div className="bg-black text-green-400 p-3 rounded font-mono text-xs max-h-96 overflow-y-auto">
                    {debugLogs.map((log, idx) => (
                      <div key={idx} className="whitespace-pre-wrap">{log}</div>
                    ))}
                  </div>
                </div>
              )}
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
