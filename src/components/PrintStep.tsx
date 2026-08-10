import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, ShieldAlert, Download, Plus, Trash2, Layers, Image as ImageIcon } from 'lucide-react';
import { PrintQueueItem } from '../types';

interface PrintStepProps {
  queue: PrintQueueItem[];
  onUpdateQueue: (queue: PrintQueueItem[]) => void;
  onAddAnotherPhoto: () => void;
  onBack: () => void;
  onReset: () => void;
  passportSrc?: string;
  stampSrc?: string;
}

export default function PrintStep({
  queue,
  onUpdateQueue,
  onAddAnotherPhoto,
  onBack,
  onReset,
  passportSrc,
  stampSrc,
}: PrintStepProps) {
  // Ensure we have at least one fallback item if queue is empty
  const activeQueue: PrintQueueItem[] = queue.length > 0 ? queue : [
    {
      id: 'fallback_1',
      passportSrc: passportSrc || '',
      stampSrc: stampSrc || '',
      passportCount: 8,
      stampCount: 12,
      name: 'Photo #1',
      timestamp: Date.now(),
    }
  ];

  // Active selected photo index in the queue for editing counts
  const [selectedIndex, setSelectedIndex] = useState<number>(activeQueue.length - 1);
  const safeSelectedIndex = Math.min(selectedIndex, activeQueue.length - 1);
  const selectedPhoto = activeQueue[safeSelectedIndex] || activeQueue[0];

  // Global sheet settings
  const [photoGap, setPhotoGap] = useState<number>(4); // in mm
  const [showCutLines, setShowCutLines] = useState<boolean>(true);
  const [sheetLayout, setSheetLayout] = useState<'START' | 'CENTER'>('START');
  const [showIframeWarning, setShowIframeWarning] = useState<boolean>(false);

  // Update selected photo's passport copy count
  const handleUpdatePassportCount = (count: number) => {
    const updated = activeQueue.map((item, idx) => 
      idx === safeSelectedIndex ? { ...item, passportCount: count } : item
    );
    onUpdateQueue(updated);
  };

  // Update selected photo's stamp copy count
  const handleUpdateStampCount = (count: number) => {
    const updated = activeQueue.map((item, idx) => 
      idx === safeSelectedIndex ? { ...item, stampCount: count } : item
    );
    onUpdateQueue(updated);
  };

  // Remove photo from queue
  const handleRemovePhoto = (idToRemove: string) => {
    if (activeQueue.length <= 1) {
      onReset();
      return;
    }
    const updated = activeQueue.filter(item => item.id !== idToRemove);
    onUpdateQueue(updated);
    setSelectedIndex(Math.max(0, safeSelectedIndex - 1));
  };

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

  // Combo templates applied to active photo or shared
  const applyTemplate = (type: 'COMBO' | 'PASSPORT_MAX' | 'STAMP_MAX' | 'MINI') => {
    let pCount = 8;
    let sCount = 12;
    if (type === 'PASSPORT_MAX') {
      pCount = 32;
      sCount = 0;
    } else if (type === 'STAMP_MAX') {
      pCount = 0;
      sCount = 48;
    } else if (type === 'MINI') {
      pCount = 4;
      sCount = 4;
    }

    const updated = activeQueue.map((item, idx) => 
      idx === safeSelectedIndex ? { ...item, passportCount: pCount, stampCount: sCount } : item
    );
    onUpdateQueue(updated);
  };

  // Calculations for country specific photos (A4 size: 210x297mm)
  const marginMm = 10; // Page padding is 10mm each side
  const usableWidthMm = 210 - (2 * marginMm); // 190mm
  const usableHeightMm = 297 - (2 * marginMm); // 277mm
  const photoWidthMm = selectedPhoto?.passportWidthMm || 35;
  const photoHeightMm = selectedPhoto?.passportHeightMm || 45;

  const maxPhotosPerRow = Math.floor((usableWidthMm + photoGap) / (photoWidthMm + photoGap));
  const maxRowsPerPage = Math.floor((usableHeightMm + photoGap) / (photoHeightMm + photoGap));
  const totalCapacity = maxPhotosPerRow * maxRowsPerPage;

  // Aggregate totals
  const totalPassportCount = activeQueue.reduce((sum, item) => sum + item.passportCount, 0);
  const totalStampCount = activeQueue.reduce((sum, item) => sum + item.stampCount, 0);
  const isOverflowing = totalPassportCount > totalCapacity;

  // Perform browser print
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

  return (
    <div className="flex flex-col flex-1 select-none overflow-hidden h-full">
      {/* Printable Area - React Portal appended to body */}
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
          
          {/* Printable Grid Wrapper rendering ALL queued photos */}
          <div 
            className={`flex flex-wrap ${sheetLayout === 'START' ? 'justify-start items-start' : 'justify-center items-center'} content-start`}
            style={{ gap: `${photoGap}mm` }}
          >
            {/* Passport Size Photos from all queued items */}
            {activeQueue.flatMap((item) => {
              const pW = item.passportWidthMm || 35;
              const pH = item.passportHeightMm || 45;
              return Array.from({ length: item.passportCount }).map((_, copyIdx) => (
                <div
                  key={`print-pass-${item.id}-${copyIdx}`}
                  className="relative overflow-hidden bg-white shrink-0"
                  style={{
                    width: `${pW}mm`,
                    height: `${pH}mm`,
                    border: showCutLines ? '0.2mm solid #d1d5db' : 'none',
                  }}
                >
                  <img src={item.passportSrc} alt={`${item.name} passport copy`} className="w-full h-full object-cover" />
                </div>
              ));
            })}

            {/* Stamp Size Photos from all queued items */}
            {activeQueue.flatMap((item) => {
              const sW = item.stampWidthMm || 20;
              const sH = item.stampHeightMm || 25;
              return Array.from({ length: item.stampCount }).map((_, copyIdx) => (
                <div
                  key={`print-stamp-${item.id}-${copyIdx}`}
                  className="relative overflow-hidden bg-white shrink-0"
                  style={{
                    width: `${sW}mm`,
                    height: `${sH}mm`,
                    border: showCutLines ? '0.2mm solid #d1d5db' : 'none',
                  }}
                >
                  <img src={item.stampSrc} alt={`${item.name} stamp copy`} className="w-full h-full object-cover" />
                </div>
              ));
            })}
          </div>
        </div>,
        document.body
      )}

      {/* Screen Interface Layout */}
      <div className="no-print flex flex-col flex-1 overflow-hidden h-full">
        {/* Header */}
        <div className="bg-slate-900 border-b border-slate-800 p-3.5 shrink-0 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold tracking-widest text-indigo-400 uppercase">Step 4 of 4</span>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              Print Sheet & Queue
              <span className="text-[11px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full font-bold">
                {activeQueue.length} {activeQueue.length === 1 ? 'Photo' : 'Photos'} in Queue
              </span>
            </h2>
          </div>
          <button
            onClick={onReset}
            className="text-[10px] bg-red-500/10 text-red-400 hover:bg-red-500/20 px-2.5 py-1 rounded-lg border border-red-500/20 transition-all font-bold cursor-pointer"
          >
            Reset App
          </button>
        </div>

        {/* Photo Queue Carousel / Tabs Bar */}
        <div className="bg-slate-950 border-b border-slate-850 px-3 py-2 shrink-0 flex items-center gap-2 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5 shrink-0 text-slate-400 pr-1">
            <Layers size={14} className="text-indigo-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Queue:</span>
          </div>

          {activeQueue.map((item, idx) => {
            const isSelected = idx === safeSelectedIndex;
            return (
              <div
                key={item.id}
                onClick={() => setSelectedIndex(idx)}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="w-5 h-6 rounded bg-slate-800 overflow-hidden border border-slate-700 shrink-0">
                  <img src={item.passportSrc} alt={item.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[10px] font-bold leading-tight truncate max-w-[80px]">{item.name}</span>
                  <span className="text-[9px] text-slate-400 font-mono">
                    {item.passportCount}P / {item.stampCount}S
                  </span>
                </div>
              </div>
            );
          })}

          {/* Add Another Photo Button */}
          <button
            onClick={onAddAnotherPhoto}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] transition shadow-md shrink-0 cursor-pointer active:scale-95 ml-auto"
          >
            <Plus size={14} />
            <span>Add Another Photo</span>
          </button>
        </div>

        {/* Virtual A4 Paper Viewport Preview */}
        <div className="flex-1 overflow-y-auto p-3 bg-[#090d16] flex flex-col items-center justify-start scrollbar-thin">
          <div className="text-center max-w-sm mb-2.5">
            <h3 className="text-xs text-slate-300 font-semibold">Virtual A4 Print Sheet Preview</h3>
            <p className="text-[10px] text-slate-400">All photos queued above will print together on this A4 sheet</p>
          </div>

          {/* Simulated A4 Sheet container */}
          <div
            className="bg-white text-slate-950 shadow-2xl relative border border-slate-300 overflow-hidden shrink-0 flex flex-col justify-between"
            style={{
              width: '280px',
              height: '396px', // A4 aspect ratio
              padding: `${10 * (280 / 210)}px`,
            }}
          >
            {/* Grid Preview */}
            <div 
              className={`flex flex-wrap ${
                sheetLayout === 'START' ? 'justify-start items-start' : 'justify-center items-center'
              } content-start h-full overflow-hidden`}
              style={{ gap: `${photoGap * (280 / 210)}px` }}
            >
              {/* Render all queued Passport copies */}
              {activeQueue.flatMap((item) => {
                const pW = item.passportWidthMm || 35;
                const pH = item.passportHeightMm || 45;
                return Array.from({ length: item.passportCount }).map((_, copyIdx) => (
                  <div
                    key={`pass-prev-${item.id}-${copyIdx}`}
                    className="bg-slate-200 overflow-hidden shrink-0 relative"
                    style={{
                      width: `${pW * (280 / 210)}px`,
                      height: `${pH * (280 / 210)}px`,
                      border: showCutLines ? '0.5px solid #cbd5e1' : 'none',
                    }}
                  >
                    <img src={item.passportSrc} alt="Preview copy" className="w-full h-full object-cover" />
                  </div>
                ));
              })}

              {/* Render all queued Stamp copies */}
              {activeQueue.flatMap((item) => {
                const sW = item.stampWidthMm || 20;
                const sH = item.stampHeightMm || 25;
                return Array.from({ length: item.stampCount }).map((_, copyIdx) => (
                  <div
                    key={`stamp-prev-${item.id}-${copyIdx}`}
                    className="bg-slate-200 overflow-hidden shrink-0 relative"
                    style={{
                      width: `${sW * (280 / 210)}px`,
                      height: `${sH * (280 / 210)}px`,
                      border: showCutLines ? '0.5px solid #cbd5e1' : 'none',
                    }}
                  >
                    <img src={item.stampSrc} alt="Preview copy" className="w-full h-full object-cover" />
                  </div>
                ));
              })}
            </div>

            {/* Simulated Watermark */}
            <div className="absolute inset-0 border border-indigo-500/10 pointer-events-none flex items-center justify-center">
              <span className="text-[9px] text-indigo-500/20 font-bold font-mono tracking-[4px] uppercase rotate-12">
                A4 Document Sheet
              </span>
            </div>
          </div>
        </div>

        {/* Range Controls & Settings Drawer */}
        <div className="bg-slate-900 border-t border-slate-850 p-3.5 shrink-0 space-y-3">
          
          {/* Active Photo Selected Header & Controls */}
          {selectedPhoto && (
            <div className="bg-slate-950/80 p-2.5 rounded-xl border border-indigo-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-6 bg-slate-800 rounded overflow-hidden border border-slate-700">
                    <img src={selectedPhoto.passportSrc} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-indigo-300 block">{selectedPhoto.name} Controls</span>
                    <span className="text-[9px] text-slate-400">Adjust copies for this photo</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {activeQueue.length > 1 && (
                    <button
                      onClick={() => handleRemovePhoto(selectedPhoto.id)}
                      className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition border border-red-500/20 cursor-pointer"
                      title="Remove this photo from queue"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Sliders for selected photo */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800">
                  <div className="flex justify-between text-[10px] text-slate-300 font-bold mb-1">
                    <span>Passport ({selectedPhoto.passportWidthMm || 35}×{selectedPhoto.passportHeightMm || 45} mm)</span>
                    <span className="text-indigo-400">{selectedPhoto.passportCount}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="32"
                    value={selectedPhoto.passportCount}
                    onChange={(e) => handleUpdatePassportCount(parseInt(e.target.value))}
                    className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800">
                  <div className="flex justify-between text-[10px] text-slate-300 font-bold mb-1">
                    <span>Stamp ({selectedPhoto.stampWidthMm || 20}×{selectedPhoto.stampHeightMm || 25} mm)</span>
                    <span className="text-indigo-400">{selectedPhoto.stampCount}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="48"
                    value={selectedPhoto.stampCount}
                    onChange={(e) => handleUpdateStampCount(parseInt(e.target.value))}
                    className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Quick presets & Photo Gap slider */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase block mb-1">Active Photo Presets</span>
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => applyTemplate('COMBO')}
                  className="py-1 px-1.5 text-[9px] bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded font-bold cursor-pointer transition"
                >
                  Combo Pack
                </button>
                <button
                  onClick={() => applyTemplate('PASSPORT_MAX')}
                  className="py-1 px-1.5 text-[9px] bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded font-bold cursor-pointer transition"
                >
                  Max Passport
                </button>
                <button
                  onClick={() => applyTemplate('STAMP_MAX')}
                  className="py-1 px-1.5 text-[9px] bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded font-bold cursor-pointer transition"
                >
                  Max Stamp
                </button>
                <button
                  onClick={() => applyTemplate('MINI')}
                  className="py-1 px-1.5 text-[9px] bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded font-bold cursor-pointer transition"
                >
                  Mini Pack
                </button>
              </div>
            </div>

            <div className="flex flex-col justify-between">
              <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase block mb-1">Sheet Spacing</span>
              <div className="bg-slate-850 px-2.5 py-1.5 rounded-lg border border-slate-800">
                <div className="flex justify-between text-[10px] text-slate-300 font-bold mb-1">
                  <span>Photo Gap</span>
                  <span className="text-indigo-400">{photoGap} mm</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="15"
                  step="1"
                  value={photoGap}
                  onChange={(e) => setPhotoGap(parseInt(e.target.value))}
                  className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Alignment & Border Toggles */}
          <div className="grid grid-cols-2 gap-2 bg-slate-950/40 p-2 rounded-xl border border-slate-850">
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

          {/* Download PNG for selected photo */}
          {selectedPhoto && (
            <div className="bg-slate-950/40 p-2 rounded-xl border border-slate-850 flex items-center justify-between gap-2">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Download Single PNG:</span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleDownloadSingle(selectedPhoto.passportSrc, `${selectedPhoto.name}-passport.png`)}
                  className="py-1 px-2 rounded-lg text-[10px] bg-slate-900 border border-slate-800 hover:border-slate-700 text-indigo-400 font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Download size={11} /> Passport
                </button>
                <button
                  onClick={() => handleDownloadSingle(selectedPhoto.stampSrc, `${selectedPhoto.name}-stamp.png`)}
                  className="py-1 px-2 rounded-lg text-[10px] bg-slate-900 border border-slate-800 hover:border-slate-700 text-indigo-400 font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Download size={11} /> Stamp
                </button>
              </div>
            </div>
          )}

          {/* Main Action Footer */}
          <div className="flex flex-col gap-1.5 pt-1">
            <div className="flex gap-2">
              <button
                onClick={onAddAnotherPhoto}
                className="flex-1 py-2.5 bg-indigo-600/20 border border-indigo-500/40 hover:bg-indigo-600/30 text-indigo-300 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus size={14} /> Add Another Photo
              </button>

              <button
                onClick={triggerPrint}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl text-xs shadow-lg shadow-indigo-600/25 transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer size={15} /> Print Sheet
              </button>
            </div>
            
            <p className="text-[9px] text-slate-500 text-center leading-normal">
              💡 Need to print in preview? Click <span className="text-slate-300 font-bold">"Open in New Tab"</span> in top right if browser popups are blocked.
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
