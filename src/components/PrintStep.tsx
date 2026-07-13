import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Grid, RefreshCw, LayoutGrid, Check, Settings, ShieldAlert, ArrowLeft, Download } from 'lucide-react';
import { motion } from 'motion/react';

interface PrintStepProps {
  passportSrc: string;
  stampSrc: string;
  onBack: () => void;
  onReset: () => void;
}

export default function PrintStep({ passportSrc, stampSrc, onBack, onReset }: PrintStepProps) {
  // Print range settings
  const [passportCount, setPassportCount] = useState<number>(8);
  const [stampCount, setStampCount] = useState<number>(12);
  const [photoGap, setPhotoGap] = useState<number>(4); // in mm
  const [showCutLines, setShowCutLines] = useState<boolean>(true);
  const [sheetLayout, setSheetLayout] = useState<'START' | 'CENTER'>('START'); // Starting alignment vs Center

  // Download single image handler
  const handleDownloadSingle = (srcUrl: string, filename: string) => {
    try {
      const link = document.createElement('a');
      link.href = srcUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  // Combo templates
  const applyTemplate = (type: 'COMBO' | 'PASSPORT_MAX' | 'STAMP_MAX' | 'MINI') => {
    if (type === 'COMBO') {
      setPassportCount(8);
      setStampCount(12);
    } else if (type === 'PASSPORT_MAX') {
      setPassportCount(32);
      setStampCount(0);
    } else if (type === 'STAMP_MAX') {
      setPassportCount(0);
      setStampCount(48);
    } else if (type === 'MINI') {
      setPassportCount(4);
      setStampCount(4);
    }
  };

  // Calculations for 35x45mm photos (A4 size: 210x297mm)
  const marginMm = 10; // Page padding is 10mm each side
  const usableWidthMm = 210 - (2 * marginMm); // 190mm
  const usableHeightMm = 297 - (2 * marginMm); // 277mm

  const photoWidthMm = 35;
  const photoHeightMm = 45;

  // Formula: N * Width + (N - 1) * Gap <= UsableWidth
  // N * (Width + Gap) - Gap <= UsableWidth
  // N * (Width + Gap) <= UsableWidth + Gap
  // N = Math.floor((UsableWidth + Gap) / (Width + Gap))
  const maxPhotosPerRow = Math.floor((usableWidthMm + photoGap) / (photoWidthMm + photoGap));
  const maxRowsPerPage = Math.floor((usableHeightMm + photoGap) / (photoHeightMm + photoGap));
  const totalCapacity = maxPhotosPerRow * maxRowsPerPage;

  // Current statistics
  const currentRowsNeeded = Math.ceil(passportCount / maxPhotosPerRow);
  const isOverflowing = passportCount > totalCapacity;
  const [showIframeWarning, setShowIframeWarning] = useState<boolean>(false);

  // Perform browser print with robust media style rendering
  const triggerPrint = () => {
    const isIframe = typeof window !== 'undefined' && window.self !== window.top;
    if (isIframe) {
      setShowIframeWarning(true);
    }
    try {
      window.print();
    } catch (err) {
      console.error('Print failed:', err);
    }
  };

  // Create grid arrays
  const passportArray = Array.from({ length: passportCount });
  const stampArray = Array.from({ length: stampCount });

  return (
    <div className="flex flex-col flex-1 select-none overflow-hidden h-full">
      {/* Printable Area - Controlled via React Portal appended directly to document.body */}
      {typeof document !== 'undefined' && createPortal(
        <div className="print-page bg-white text-black p-[10mm]" style={{ width: '210mm', height: '297mm' }}>
          <style dangerouslySetInnerHTML={{ __html: `
            @media screen {
              .print-page {
                display: none !important;
              }
            }
            @media print {
              @page {
                size: A4;
                margin: 0;
              }
              /* Hide the entire React root app wrapper, leaving only the portal print page */
              body > :not(.print-page) {
                display: none !important;
              }
              .print-page {
                display: block !important;
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 210mm !important;
                height: 297mm !important;
                margin: 0 !important;
                padding: 10mm !important;
                box-sizing: border-box !important;
                background: white !important;
                color: black !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .print-page * {
                visibility: visible !important;
              }
            }
          ` }} />
          
          {/* Printable Grid Wrapper */}
          <div 
            className={`flex flex-wrap ${sheetLayout === 'START' ? 'justify-start items-start' : 'justify-center items-center'} content-start`}
            style={{ gap: `${photoGap}mm` }}
          >
            {/* Passport Size Photos: 35mm x 45mm */}
            {passportArray.map((_, idx) => (
              <div
                key={`print-pass-${idx}`}
                className="relative overflow-hidden bg-white"
                style={{
                  width: '35mm',
                  height: '45mm',
                  border: showCutLines ? '0.2mm solid #d1d5db' : 'none',
                }}
              >
                <img src={passportSrc} alt="Passport photo copy" className="w-full h-full object-cover" />
              </div>
            ))}

            {/* Stamp Size Photos: 20mm x 25mm */}
            {stampArray.map((_, idx) => (
              <div
                key={`print-stamp-${idx}`}
                className="relative overflow-hidden bg-white"
                style={{
                  width: '20mm',
                  height: '25mm',
                  border: showCutLines ? '0.2mm solid #d1d5db' : 'none',
                }}
              >
                <img src={stampSrc} alt="Stamp photo copy" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}

      {/* Screen Interface Layout */}
      <div className="no-print flex flex-col flex-1 overflow-hidden h-full">
        {/* Header */}
        <div className="bg-slate-900 border-b border-slate-800 p-4 shrink-0 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold tracking-widest text-indigo-400 uppercase">Step 4 of 4</span>
            <h2 className="text-base font-bold text-white tracking-tight">Print Layout & Range</h2>
          </div>
          <button
            onClick={onReset}
            className="text-[10px] bg-red-500/10 text-red-400 hover:bg-red-500/20 px-2.5 py-1 rounded-lg border border-red-500/20 transition-all font-bold cursor-pointer"
          >
            Reset App
          </button>
        </div>

        {/* virtual A4 Paper Viewport preview */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#090d16] flex flex-col items-center justify-start scrollbar-thin">
          <div className="text-center max-w-sm mb-3">
            <h3 className="text-xs text-slate-300 font-semibold">Virtual A4 Layout Preview</h3>
            <p className="text-[10px] text-slate-400">Scale matches exactly to standard printer A4 page dimensions</p>
          </div>

          {/* Simulated A4 Sheet container */}
          <div
            className="bg-white text-slate-950 shadow-2xl relative border border-slate-300 overflow-hidden shrink-0 flex flex-col justify-between"
            style={{
              width: '280px',
              height: '396px', // 280 * 1.414 = 396px (A4 aspect ratio)
              padding: `${10 * (280 / 210)}px`, // Exact 10mm padding scaled to px
            }}
          >
            {/* Grid Preview aligned based on sheetLayout */}
            <div 
              className={`flex flex-wrap ${
                sheetLayout === 'START' ? 'justify-start items-start' : 'justify-center items-center'
              } content-start h-full overflow-hidden`}
              style={{ gap: `${photoGap * (280 / 210)}px` }} // Scaled photo gap in pixels
            >
              {/* Simulated Passports */}
              {passportArray.map((_, idx) => (
                <div
                  key={`pass-prev-${idx}`}
                  className="bg-slate-200 overflow-hidden shrink-0 relative"
                  style={{
                    width: `${35 * (280 / 210)}px`, // Scaled 35mm down
                    height: `${45 * (280 / 210)}px`, // Scaled 45mm down
                    border: showCutLines ? '0.5px solid #cbd5e1' : 'none',
                  }}
                >
                  <img src={passportSrc} alt="Preview copy" className="w-full h-full object-cover" />
                </div>
              ))}

              {/* Simulated Stamps */}
              {stampArray.map((_, idx) => (
                <div
                  key={`stamp-prev-${idx}`}
                  className="bg-slate-200 overflow-hidden shrink-0 relative"
                  style={{
                    width: `${20 * (280 / 210)}px`, // Scaled 20mm down
                    height: `${25 * (280 / 210)}px`, // Scaled 25mm down
                    border: showCutLines ? '0.5px solid #cbd5e1' : 'none',
                  }}
                >
                  <img src={stampSrc} alt="Preview copy" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>

            {/* Simulated Watermark helper (Only on screen preview) */}
            <div className="absolute inset-0 border border-indigo-500/10 pointer-events-none flex items-center justify-center">
              <span className="text-[9px] text-indigo-500/20 font-bold font-mono tracking-[4px] uppercase rotate-12">
                A4 Document Sheet
              </span>
            </div>
          </div>
        </div>

        {/* Range Controls & Settings Drawer */}
        <div className="bg-slate-900 border-t border-slate-850 p-4 shrink-0 space-y-3">
          
          {/* Quick templates */}
          <div>
            <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block mb-1.5">Sheet Layout Presets</span>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                onClick={() => applyTemplate('COMBO')}
                className={`py-1.5 px-1 text-[10px] rounded-lg font-semibold border transition cursor-pointer ${
                  passportCount === 8 && stampCount === 12
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                    : 'bg-slate-850 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                Combo Pack
              </button>
              <button
                onClick={() => applyTemplate('PASSPORT_MAX')}
                className={`py-1.5 px-1 text-[10px] rounded-lg font-semibold border transition cursor-pointer ${
                  passportCount === 32 && stampCount === 0
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                    : 'bg-slate-850 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                Max Passport
              </button>
              <button
                onClick={() => applyTemplate('STAMP_MAX')}
                className={`py-1.5 px-1 text-[10px] rounded-lg font-semibold border transition cursor-pointer ${
                  passportCount === 0 && stampCount === 48
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                    : 'bg-slate-850 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                Max Stamp
              </button>
              <button
                onClick={() => applyTemplate('MINI')}
                className={`py-1.5 px-1 text-[10px] rounded-lg font-semibold border transition cursor-pointer ${
                  passportCount === 4 && stampCount === 4
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                    : 'bg-slate-850 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                Mini Pack
              </button>
            </div>
          </div>

          {/* Grid Calculations Card */}
          <div className="bg-[#0b101b] border border-slate-800 p-2.5 rounded-xl space-y-1.5 font-mono text-[10px]">
            <div className="flex justify-between text-slate-400 font-sans font-bold border-b border-slate-800/80 pb-1 uppercase tracking-wider">
              <span>Layout Calculations (35x45mm)</span>
              <span className="text-indigo-400">A4 Page</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500">Usable Width:</span>
                <span>{usableWidthMm} mm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Usable Height:</span>
                <span>{usableHeightMm} mm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Selected Gap:</span>
                <span className="text-indigo-400 font-bold">{photoGap} mm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Selected Photos:</span>
                <span>{passportCount} units</span>
              </div>
              <div className="flex justify-between border-t border-slate-850 pt-1 col-span-2">
                <span className="text-slate-400">Photos Per Row:</span>
                <span className="text-emerald-400 font-bold">{maxPhotosPerRow} images</span>
              </div>
              <div className="flex justify-between col-span-2">
                <span className="text-slate-400">Max Rows on Page:</span>
                <span className="text-emerald-400 font-bold">{maxRowsPerPage} rows</span>
              </div>
              <div className="flex justify-between col-span-2">
                <span className="text-slate-400">A4 Page Capacity:</span>
                <span className="text-indigo-300 font-bold">{totalCapacity} images</span>
              </div>
            </div>
            
            <div className="pt-1 flex items-center gap-1.5 font-sans">
              <span className={`w-2 h-2 rounded-full ${isOverflowing ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}></span>
              <span className="text-[10px] text-slate-400">
                {isOverflowing 
                  ? `Warning: Exceeds page limit (${passportCount}/${totalCapacity})` 
                  : `Perfect Fit: Occupies ${currentRowsNeeded} / ${maxRowsPerPage} rows on page`
                }
              </span>
            </div>
          </div>

          {/* Copy & Spacing sliders */}
          <div className="space-y-2">
            {/* Passport copy range slider */}
            <div className="bg-slate-850 px-3 py-1.5 rounded-xl border border-slate-800/60 flex items-center justify-between gap-3">
              <div className="shrink-0">
                <span className="text-[10px] text-slate-400 font-bold block">Passport copies (35x45)</span>
                <span className="text-[11px] text-slate-200 font-semibold">{passportCount} Photo(s)</span>
              </div>
              <input
                type="range"
                min="0"
                max="36"
                value={passportCount}
                onChange={(e) => setPassportCount(parseInt(e.target.value))}
                className="flex-1 accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Stamp copy range slider */}
            <div className="bg-slate-850 px-3 py-1.5 rounded-xl border border-slate-800/60 flex items-center justify-between gap-3">
              <div className="shrink-0">
                <span className="text-[10px] text-slate-400 font-bold block">Stamp copies (20x25)</span>
                <span className="text-[11px] text-slate-200 font-semibold">{stampCount} Photo(s)</span>
              </div>
              <input
                type="range"
                min="0"
                max="54"
                value={stampCount}
                onChange={(e) => setStampCount(parseInt(e.target.value))}
                className="flex-1 accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Custom Photo Gap range slider */}
            <div className="bg-slate-850 px-3 py-1.5 rounded-xl border border-slate-800/60 flex items-center justify-between gap-3">
              <div className="shrink-0">
                <span className="text-[10px] text-slate-400 font-bold block">Specific Photo Gap</span>
                <span className="text-[11px] text-indigo-300 font-semibold">{photoGap} mm</span>
              </div>
              <input
                type="range"
                min="0"
                max="15"
                step="1"
                value={photoGap}
                onChange={(e) => setPhotoGap(parseInt(e.target.value))}
                className="flex-1 accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          {/* Spacing & Alignment toggles */}
          <div className="grid grid-cols-2 gap-2 bg-slate-950/40 p-2.5 rounded-xl border border-slate-850">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase">Alignment</span>
              <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                <button
                  onClick={() => setSheetLayout('START')}
                  className={`flex-1 text-[9px] py-1 rounded font-bold transition cursor-pointer ${
                    sheetLayout === 'START' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400'
                  }`}
                >
                  Left Align
                </button>
                <button
                  onClick={() => setSheetLayout('CENTER')}
                  className={`flex-1 text-[9px] py-1 rounded font-bold transition cursor-pointer ${
                    sheetLayout === 'CENTER' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400'
                  }`}
                >
                  Centered
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase">Cut Borders</span>
              <button
                onClick={() => setShowCutLines(prev => !prev)}
                className={`flex-1 text-[9px] py-1 px-2 rounded-lg font-bold border transition flex items-center justify-center gap-1 cursor-pointer ${
                  showCutLines
                    ? 'bg-indigo-600/10 border-indigo-500/30 text-indigo-400'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                {showCutLines ? '✓ Border Lines' : 'No Borders'}
              </button>
            </div>
          </div>

          {/* Single PNG Photo Download */}
          <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-850 space-y-2">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Download Single Photo (PNG)</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleDownloadSingle(passportSrc, 'passport-photo-35x45.png')}
                className="py-2 px-2.5 rounded-lg text-[10px] bg-slate-900 border border-slate-800 hover:border-slate-700 text-indigo-400 hover:text-white font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Download size={12} />
                <span>Passport (35x45mm)</span>
              </button>
              <button
                onClick={() => handleDownloadSingle(stampSrc, 'stamp-photo-20x25.png')}
                className="py-2 px-2.5 rounded-lg text-[10px] bg-slate-900 border border-slate-800 hover:border-slate-700 text-indigo-400 hover:text-white font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Download size={12} />
                <span>Stamp (20x25mm)</span>
              </button>
            </div>
          </div>

          {/* Action trigger footer */}
          <div className="flex flex-col gap-1.5 pt-1">
            <div className="flex gap-2.5">
              <button
                onClick={onBack}
                className="flex-1 py-2.5 bg-slate-850 border border-slate-800 hover:bg-slate-800 text-slate-300 font-semibold rounded-xl text-xs transition cursor-pointer"
              >
                ← Re-crop
              </button>
              <button
                onClick={triggerPrint}
                className="flex-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl text-xs shadow-lg shadow-indigo-600/25 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer size={15} /> Print Document
              </button>
            </div>
            
            {/* Sandboxing helper hint */}
            <p className="text-[9px] text-slate-500 text-center leading-normal">
              💡 Running in preview? If the print window is blocked, click the <span className="text-slate-300 font-bold">"Open in New Tab"</span> icon in the top right, then trigger print.
            </p>
          </div>
        </div>
      </div>

      {/* Sandbox / Iframe Warning Modal */}
      {showIframeWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-sm w-full text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
              <ShieldAlert size={24} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-white">Browser Print Blocked</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Your browser blocks print dialogs inside sandboxed preview areas. Please click below to open the application in a new tab where printing works flawlessly!
              </p>
            </div>
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => {
                  window.open(window.location.href, '_blank');
                  setShowIframeWarning(false);
                }}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-600/20 transition cursor-pointer"
              >
                Open in New Tab & Print
              </button>
              <button
                onClick={() => setShowIframeWarning(false)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-medium rounded-xl text-xs transition cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
