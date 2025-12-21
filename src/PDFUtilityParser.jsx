import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PROVIDERS, detectProvider } from './providers';
import { normalizeAddress } from './utils/addressUtils';
import { exportToExcel, exportGasOnly, exportElectricOnly } from './utils/excelExport';

// Use static path to bundled worker file from public directory
pdfjsLib.GlobalWorkerOptions.workerSrc = '/PDF-utility-parser/pdf.worker.min.mjs';

const PDFUtilityParser = () => {
  const APP_VERSION = 'v1.9.0';
  const exportMenuRef = useRef(null);

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
  const [showFileList, setShowFileList] = useState(true);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [darkMode, setDarkMode] = useState(() => {
    // Check localStorage or system preference
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) return JSON.parse(saved);
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(prev => {
      const newMode = !prev;
      localStorage.setItem('darkMode', JSON.stringify(newMode));
      return newMode;
    });
  };

  // Show toast notification
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  // Add debug log helper
  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(message);
  };

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showExportMenu]);

  // Extract text from PDF using PDF.js
  const extractTextFromPDF = async (file) => {
    addLog(`Processing: ${file.name}`);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      addLog(`  Loaded ${pdf.numPages} pages`);

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
    } catch (error) {
      addLog(`  ❌ ERROR: ${error.message}`);
      throw new Error(`PDF extraction failed: ${error.message}`);
    }
  };

  // Extract data from a single PDF
  const extractFromPDF = async (file) => {
    const { fullText, pages, numPages } = await extractTextFromPDF(file);

    let result = {
      serviceAddress: null,
      accountNumber: null,
      gasSupplyCharges: null,
      electricSupplyCharges: null
    };
    let providerName = null;

    // Determine which provider to use
    let targetProviderId = null;

    if (utilityMode === 'auto') {
      // Auto-detect provider
      targetProviderId = detectProvider(fullText, addLog);
    } else {
      // Use explicitly selected provider
      targetProviderId = utilityMode;
    }

    // Try extraction with the target provider first (if detected/selected)
    if (targetProviderId && PROVIDERS[targetProviderId]) {
      const provider = PROVIDERS[targetProviderId];
      const extractedData = provider.extractData(fullText, pages, addLog, normalizeAddress);

      if (extractedData.accountNumber || extractedData.serviceAddress) {
        result = extractedData;
        providerName = provider.name;
      }
    }

    // If no data extracted yet, try all other providers as fallback
    if (!result.accountNumber && !result.serviceAddress) {
      for (const [providerId, provider] of Object.entries(PROVIDERS)) {
        // Skip the one we already tried
        if (providerId === targetProviderId) continue;

        const extractedData = provider.extractData(fullText, pages, addLog, normalizeAddress);
        if (extractedData.accountNumber || extractedData.serviceAddress) {
          result = extractedData;
          providerName = provider.name;
          break;
        }
      }
    }

    return {
      'File Name': file.name,
      'Provider': providerName,
      'Account Number': result.accountNumber,
      'Service Address': result.serviceAddress,
      'Total Usage (kWh)': result.totalUsageKwh,
      'Total Gas Supply Charges': result.gasSupplyCharges,
      'Total Electric Supply Charges': result.electricSupplyCharges
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

  // Clear all files from the list
  const clearAllFiles = () => {
    setFiles([]);
    setResults([]);
    setErrors([]);
    setProgress(0);
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
      showToast('Please select PDF files first', 'error');
      return;
    }

    setProcessing(true);
    setProgress(0);
    setResults([]);
    setErrors([]);
    setDebugLogs([]);

    addLog(`Starting batch processing - ${files.length} file(s)`);

    const extractedData = [];
    const errorList = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        setCurrentFile(file.name);
        addLog(`\n[${i + 1}/${files.length}] ${file.name}`);
        const data = await extractFromPDF(file);
        extractedData.push(data);
        setProgress(Math.round(((i + 1) / files.length) * 100));
      } catch (error) {
        addLog(`  ❌ ERROR: ${error.message}`);
        errorList.push({ fileName: file.name, error: error.message });
      }
    }

    setResults(extractedData);
    setErrors(errorList);
    setProcessing(false);
    setCurrentFile('');
    addLog(`\nComplete! Successfully processed ${extractedData.length}/${files.length} files`);
    showToast(`Successfully processed ${extractedData.length} of ${files.length} files`);
  };

  // Clear all results and start over
  const clearResults = () => {
    setResults([]);
    setErrors([]);
    setDebugLogs([]);
    setFiles([]);
    setProgress(0);
    showToast('Results cleared');
  };

  // Remove individual result
  const removeResult = (index) => {
    setResults(prev => prev.filter((_, i) => i !== index));
    showToast('Result removed');
  };

  // Export handlers
  const handleExportCombined = () => {
    exportToExcel(results, {
      sheetName: 'Combined Data',
      fileName: 'utility_bill_combined.xlsx'
    });
    setShowExportMenu(false);
    showToast('Exported combined data to Excel');
  };

  const handleExportGas = () => {
    exportGasOnly(results, {
      sheetName: 'Gas Data',
      fileName: 'utility_bill_gas.xlsx'
    });
    setShowExportMenu(false);
    showToast('Exported gas data to Excel');
  };

  const handleExportElectric = () => {
    exportElectricOnly(results, {
      sheetName: 'Electric Data',
      fileName: 'utility_bill_electric.xlsx'
    });
    setShowExportMenu(false);
    showToast('Exported electric data to Excel');
  };

  // Copy results to clipboard as JSON
  const copyResultsToClipboard = async () => {
    try {
      const jsonString = JSON.stringify(results, null, 2);
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      addLog('Results copied to clipboard as JSON');
      showToast('Copied results as JSON');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      addLog(`Failed to copy to clipboard: ${error.message}`);
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  return (
    <div className={`min-h-screen p-8 transition-colors duration-200 ${
      darkMode
        ? 'bg-gradient-to-br from-gray-900 to-gray-800'
        : 'bg-gradient-to-br from-blue-50 to-indigo-100'
    }`}>
      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
          <div className={`px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 ${
            toast.type === 'success'
              ? darkMode
                ? 'bg-green-700 text-green-100'
                : 'bg-green-100 text-green-800 border border-green-200'
              : darkMode
                ? 'bg-red-700 text-red-100'
                : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            {toast.type === 'success' ? (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <div className={`rounded-lg shadow-xl p-8 transition-colors duration-200 ${
          darkMode ? 'bg-gray-800' : 'bg-white'
        }`}>
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className={`text-4xl font-bold mb-2 ${
                  darkMode ? 'text-white' : 'text-gray-800'
                }`}>
                  Utility Bill PDF Parser
                </h1>
                <p className={darkMode ? 'text-gray-300' : 'text-gray-600'}>
                  Parse utility bills and export to Excel
                </p>
              </div>
              <div className="text-right flex items-center gap-4">
                <button
                  onClick={toggleDarkMode}
                  className={`p-2 rounded-lg transition-colors ${
                    darkMode
                      ? 'bg-gray-700 hover:bg-gray-600 text-yellow-300'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                  }`}
                  title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {darkMode ? '☀️' : '🌙'}
                </button>
                <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {APP_VERSION}
                </div>
              </div>
            </div>
          </div>

          {/* Utility Mode Selector */}
          <div className="mb-8">
            <label className={`block mb-2 text-sm font-medium ${
              darkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
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
                <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-900'}`}>Auto-detect</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="ace"
                  checked={utilityMode === 'ace'}
                  onChange={(e) => setUtilityMode(e.target.value)}
                  className="mr-2"
                />
                <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-900'}`}>ACE</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="pseg"
                  checked={utilityMode === 'pseg'}
                  onChange={(e) => setUtilityMode(e.target.value)}
                  className="mr-2"
                />
                <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-900'}`}>PSEG</span>
              </label>
            </div>
          </div>

          {/* Upload Area with Drag & Drop */}
          <div className="mb-8">
            <label className={`block mb-2 text-sm font-medium ${
              darkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Select PDF Files
            </label>
            <div
              className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : darkMode
                    ? 'border-gray-600 bg-gray-700 hover:border-gray-500'
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
                  className={`mx-auto h-12 w-12 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}
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
                <p className={`mt-2 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>PDF files only</p>
              </div>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setShowFileList(!showFileList)}
                    className="flex items-center gap-2 text-sm font-medium hover:opacity-80"
                  >
                    <svg
                      className={`h-4 w-4 transition-transform ${showFileList ? 'transform rotate-90' : ''} ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                      Selected files ({files.length})
                    </span>
                  </button>
                  <button
                    onClick={clearAllFiles}
                    className={`text-sm font-medium ${
                      darkMode
                        ? 'text-red-400 hover:text-red-300'
                        : 'text-red-600 hover:text-red-800'
                    }`}
                    title="Clear all files"
                  >
                    Clear All
                  </button>
                </div>
                {showFileList && (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between border rounded-lg p-3 transition-colors ${
                        darkMode
                          ? 'bg-gray-700 border-gray-600 hover:bg-gray-650'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
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
                          <p className={`text-sm font-medium truncate ${
                            darkMode ? 'text-gray-100' : 'text-gray-900'
                          }`}>
                            {file.name}
                          </p>
                          <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        className={`ml-4 flex-shrink-0 ${
                          darkMode
                            ? 'text-red-400 hover:text-red-300'
                            : 'text-red-600 hover:text-red-800'
                        }`}
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
                )}
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
              <div className={`w-full rounded-full h-4 ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                <div
                  className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className={`text-center mt-2 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {progress}% Complete
              </p>
              {currentFile && (
                <p className={`text-center mt-1 text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Processing: {currentFile}
                </p>
              )}
            </div>
          )}

          {/* Error Messages */}
          {errors.length > 0 && (
            <div className={`mb-8 border rounded-lg p-4 ${
              darkMode
                ? 'bg-red-900/20 border-red-800'
                : 'bg-red-50 border-red-200'
            }`}>
              <h3 className={`font-semibold mb-2 ${
                darkMode ? 'text-red-400' : 'text-red-800'
              }`}>
                Errors ({errors.length})
              </h3>
              {errors.map((err, idx) => (
                <div key={idx} className={`text-sm ${
                  darkMode ? 'text-red-300' : 'text-red-700'
                }`}>
                  ❌ {err.fileName}: {err.error}
                </div>
              ))}
            </div>
          )}

          {/* Results Table */}
          {results.length > 0 && (
            <div className="mb-8">
              {/* Summary Stats */}
              <div className={`grid grid-cols-3 gap-4 mb-6 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                <div className={`p-4 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="text-sm font-medium opacity-70">Total Files</div>
                  <div className="text-2xl font-bold mt-1">{results.length}</div>
                </div>
                <div className={`p-4 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="text-sm font-medium opacity-70">ACE Bills</div>
                  <div className="text-2xl font-bold mt-1">{results.filter(r => r.Provider === 'ACE').length}</div>
                </div>
                <div className={`p-4 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="text-sm font-medium opacity-70">PSE&G Bills</div>
                  <div className="text-2xl font-bold mt-1">{results.filter(r => r.Provider === 'PSE&G').length}</div>
                </div>
              </div>

              <div className="flex justify-between items-center mb-4 gap-4">
                <h2 className={`text-2xl font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                  Extracted Data
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={clearResults}
                    className={`px-4 py-2 rounded-lg transition-colors font-medium ${
                      darkMode
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                        : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                    }`}
                  >
                    Clear Results
                  </button>
                  <div className="relative" ref={exportMenuRef}>
                    <button
                      onClick={() => setShowExportMenu(!showExportMenu)}
                      className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200 flex items-center gap-2"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export
                      <svg className={`h-4 w-4 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {showExportMenu && (
                      <div className={`absolute right-0 mt-2 w-48 rounded-lg shadow-xl z-10 ${
                        darkMode ? 'bg-gray-700 border border-gray-600' : 'bg-white border border-gray-200'
                      }`}>
                        <button
                          onClick={handleExportCombined}
                          className={`w-full text-left px-4 py-3 hover:bg-opacity-10 hover:bg-gray-500 flex items-center gap-2 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                          </svg>
                          Combined Data
                        </button>
                        <button
                          onClick={handleExportGas}
                          className={`w-full text-left px-4 py-3 hover:bg-opacity-10 hover:bg-gray-500 flex items-center gap-2 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                          </svg>
                          Gas Only
                        </button>
                        <button
                          onClick={handleExportElectric}
                          className={`w-full text-left px-4 py-3 hover:bg-opacity-10 hover:bg-gray-500 flex items-center gap-2 rounded-b-lg ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          Electric Only
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className={`min-w-full border rounded-lg ${
                  darkMode
                    ? 'bg-gray-700 border-gray-600'
                    : 'bg-white border-gray-300'
                }`}>
                  <thead className={darkMode ? 'bg-gray-600' : 'bg-gray-100'}>
                    <tr>
                      <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-b ${
                        darkMode
                          ? 'text-gray-200 border-gray-500'
                          : 'text-gray-700 border-gray-300'
                      }`}>
                        File Name
                      </th>
                      <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-b ${
                        darkMode
                          ? 'text-gray-200 border-gray-500'
                          : 'text-gray-700 border-gray-300'
                      }`}>
                        Provider
                      </th>
                      <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-b ${
                        darkMode
                          ? 'text-gray-200 border-gray-500'
                          : 'text-gray-700 border-gray-300'
                      }`}>
                        Account Number
                      </th>
                      <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-b ${
                        darkMode
                          ? 'text-gray-200 border-gray-500'
                          : 'text-gray-700 border-gray-300'
                      }`}>
                        Service Address
                      </th>
                      <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-b ${
                        darkMode
                          ? 'text-gray-200 border-gray-500'
                          : 'text-gray-700 border-gray-300'
                      }`}>
                        Total Usage (kWh)
                      </th>
                      <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-b ${
                        darkMode
                          ? 'text-gray-200 border-gray-500'
                          : 'text-gray-700 border-gray-300'
                      }`}>
                        Total Gas Supply Charges
                      </th>
                      <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider border-b ${
                        darkMode
                          ? 'text-gray-200 border-gray-500'
                          : 'text-gray-700 border-gray-300'
                      }`}>
                        Total Electric Supply Charges
                      </th>
                      <th className={`px-4 py-3 text-center text-xs font-medium uppercase tracking-wider border-b ${
                        darkMode
                          ? 'text-gray-200 border-gray-500'
                          : 'text-gray-700 border-gray-300'
                      }`}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${darkMode ? 'divide-gray-600' : 'divide-gray-200'}`}>
                    {results.map((row, idx) => (
                      <tr key={idx} className={darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-50'}>
                        <td className={`px-4 py-3 text-sm ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                          <div className="max-w-xs truncate" title={row['File Name']}>
                            {row['File Name']}
                          </div>
                        </td>
                        <td className={`px-4 py-3 text-sm`}>
                          {row['Provider'] ? (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              row['Provider'] === 'ACE'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                : row['Provider'] === 'PSE&G'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : darkMode
                                    ? 'bg-gray-600 text-gray-200'
                                    : 'bg-gray-200 text-gray-800'
                            }`}>
                              {row['Provider']}
                            </span>
                          ) : (
                            <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>—</span>
                          )}
                        </td>
                        <td className={`px-4 py-3 text-sm ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                          {row['Account Number'] || <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>—</span>}
                        </td>
                        <td className={`px-4 py-3 text-sm ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                          <div className="max-w-sm truncate" title={row['Service Address']}>
                            {row['Service Address'] || <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>—</span>}
                          </div>
                        </td>
                        <td className={`px-4 py-3 text-sm ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                          {row['Total Usage (kWh)']
                            ? `${row['Total Usage (kWh)']} kWh`
                            : <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>—</span>}
                        </td>
                        <td className={`px-4 py-3 text-sm ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                          {row['Total Gas Supply Charges']
                            ? (isNaN(row['Total Gas Supply Charges'])
                                ? row['Total Gas Supply Charges']
                                : `$${row['Total Gas Supply Charges']}`)
                            : <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>—</span>}
                        </td>
                        <td className={`px-4 py-3 text-sm ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                          {row['Total Electric Supply Charges']
                            ? (isNaN(row['Total Electric Supply Charges'])
                                ? row['Total Electric Supply Charges']
                                : `$${row['Total Electric Supply Charges']}`)
                            : <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => removeResult(idx)}
                            className={`p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors ${
                              darkMode ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-700'
                            }`}
                            title="Remove this result"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Processing Log - Collapsible */}
          {debugLogs.length > 0 && (
            <div className={`mb-8 border rounded-lg overflow-hidden ${
              darkMode
                ? 'bg-gray-700 border-gray-600'
                : 'bg-gray-50 border-gray-300'
            }`}>
              <div
                className={`w-full px-4 py-3 flex items-center justify-between transition-colors ${
                  darkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-100'
                }`}
              >
                <button
                  onClick={() => setShowDebugLogs(!showDebugLogs)}
                  className="flex items-center gap-3 flex-1 text-left"
                >
                  <h3 className={`font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-800'}`}>
                    Processing Log
                  </h3>
                  <svg
                    className={`h-5 w-5 transition-transform ${
                      showDebugLogs ? 'transform rotate-180' : ''
                    } ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}
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
                {results.length > 0 && showDebugLogs && (
                  <button
                    onClick={copyResultsToClipboard}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${
                      copied
                        ? darkMode
                          ? 'bg-green-700 text-green-100'
                          : 'bg-green-100 text-green-800'
                        : darkMode
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }`}
                    title="Copy results to clipboard as JSON"
                  >
                    {copied ? (
                      <>
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-xs font-medium">Copied!</span>
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs font-medium">Copy JSON</span>
                      </>
                    )}
                  </button>
                )}
              </div>
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
        </div>
      </div>
    </div>
  );
};

export default PDFUtilityParser;
