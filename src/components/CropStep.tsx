import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Scissors, RotateCw, Check, Undo, Image as ImageIcon, CheckCircle2, Search, Globe, ChevronDown, Sparkles } from 'lucide-react';
import { Point } from '../types';
import { COUNTRY_PASSPORT_PRESETS, STAMP_SIZE_PRESETS, CountryPreset } from '../data/countryPresets';

interface CropStepProps {
  imageSrc: string; // Background processed image
  onCropCompleted: (
    passportSrc: string,
    stampSrc: string,
    passportWidthMm?: number,
    passportHeightMm?: number,
    stampWidthMm?: number,
    stampHeightMm?: number,
    countryName?: string
  ) => void;
  onBack: () => void;
}

export default function CropStep({ imageSrc, onCropCompleted, onBack }: CropStepProps) {
  // Category Mode
  const [activeCategory, setActiveCategory] = useState<'PASSPORT' | 'STAMP'>('PASSPORT');

  // Selected Presets
  const [selectedPassportPreset, setSelectedPassportPreset] = useState<CountryPreset>(COUNTRY_PASSPORT_PRESETS[0]); // Default India
  const [selectedStampPreset, setSelectedStampPreset] = useState<CountryPreset>(STAMP_SIZE_PRESETS[0]); // Default Standard 20x25

  // Search & Dropdown State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSelectorOpen, setIsSelectorOpen] = useState<boolean>(false);

  // Transform states for Passport Size
  const [passZoom, setPassZoom] = useState<number>(1);
  const [passPan, setPassPan] = useState<Point>({ x: 0, y: 0 });
  const [passRotate, setPassRotate] = useState<number>(0);

  // Transform states for Stamp Size
  const [stampZoom, setStampZoom] = useState<number>(1.1);
  const [stampPan, setStampPan] = useState<Point>({ x: 0, y: 0 });
  const [stampRotate, setStampRotate] = useState<number>(0);

  // Completed Crop states
  const [passportCroppedSrc, setPassportCroppedSrc] = useState<string | null>(null);
  const [stampCroppedSrc, setStampCroppedSrc] = useState<string | null>(null);

  // Drag state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Active preset depending on selected category
  const activePreset = activeCategory === 'PASSPORT' ? selectedPassportPreset : selectedStampPreset;

  // Filter presets based on search query
  const filteredPresets = useMemo(() => {
    const list = activeCategory === 'PASSPORT' ? COUNTRY_PASSPORT_PRESETS : STAMP_SIZE_PRESETS;
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        `${p.widthMm}x${p.heightMm}`.includes(q) ||
        `${p.widthMm} x ${p.heightMm}`.includes(q)
    );
  }, [activeCategory, searchQuery]);

  // Popular quick chips
  const popularPresets = useMemo(() => {
    return activeCategory === 'PASSPORT'
      ? COUNTRY_PASSPORT_PRESETS.filter((p) => p.popular)
      : STAMP_SIZE_PRESETS.filter((p) => p.popular);
  }, [activeCategory]);

  // Load image once
  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      imgRef.current = img;
      
      // Auto-initialize starting crops on load
      generateAutoCrops(img, selectedPassportPreset, selectedStampPreset);
    };
  }, [imageSrc]);

  // Re-generate crops if presets change or when initialized
  const generateAutoCrops = (img: HTMLImageElement, passPreset: CountryPreset, stmPreset: CountryPreset) => {
    // Generate Passport Crop
    const passW = Math.max(350, Math.round(passPreset.widthMm * 12));
    const passH = Math.max(450, Math.round(passPreset.heightMm * 12));
    const passCanvas = document.createElement('canvas');
    passCanvas.width = passW;
    passCanvas.height = passH;
    const pctx = passCanvas.getContext('2d');
    if (pctx) {
      pctx.fillStyle = '#ffffff';
      pctx.fillRect(0, 0, passW, passH);

      let sw = img.width;
      let sh = (img.width * passPreset.heightMm) / passPreset.widthMm;
      if (sh > img.height) {
        sh = img.height;
        sw = (img.height * passPreset.widthMm) / passPreset.heightMm;
      }
      const sx = (img.width - sw) / 2;
      const sy = (img.height - sh) / 2;
      pctx.drawImage(img, sx, sy, sw, sh, 0, 0, passW, passH);
      setPassportCroppedSrc(passCanvas.toDataURL());
    }

    // Generate Stamp Crop
    const stmW = Math.max(240, Math.round(stmPreset.widthMm * 12));
    const stmH = Math.max(300, Math.round(stmPreset.heightMm * 12));
    const stampCanvas = document.createElement('canvas');
    stampCanvas.width = stmW;
    stampCanvas.height = stmH;
    const sctx = stampCanvas.getContext('2d');
    if (sctx) {
      sctx.fillStyle = '#ffffff';
      sctx.fillRect(0, 0, stmW, stmH);

      let sw = img.width;
      let sh = (img.width * stmPreset.heightMm) / stmPreset.widthMm;
      if (sh > img.height) {
        sh = img.height;
        sw = (img.height * stmPreset.widthMm) / stmPreset.heightMm;
      }
      const sx = (img.width - sw) / 2;
      const sy = (img.height - sh) / 2;
      sctx.drawImage(img, sx, sy, sw, sh, 0, 0, stmW, stmH);
      setStampCroppedSrc(stampCanvas.toDataURL());
    }
  };

  // Get dynamic mask dimensions fitting inside 280x280 viewport box
  const getMaskDimensions = () => {
    const ratio = activePreset.widthMm / activePreset.heightMm; // W / H
    const maxBox = 220; // max width/height pixel boundary
    let maskW = maxBox;
    let maskH = maxBox;

    if (ratio <= 1) {
      // Portrait or square
      maskH = maxBox;
      maskW = Math.round(maxBox * ratio);
      if (maskW > maxBox) {
        maskW = maxBox;
        maskH = Math.round(maxBox / ratio);
      }
    } else {
      // Landscape
      maskW = maxBox;
      maskH = Math.round(maxBox / ratio);
      if (maskH > maxBox) {
        maskH = maxBox;
        maskW = Math.round(maxBox * ratio);
      }
    }

    return { maskW, maskH, ratio };
  };

  const { maskW, maskH, ratio } = getMaskDimensions();

  // Get transform states for currently active category tab
  const zoom = activeCategory === 'PASSPORT' ? passZoom : stampZoom;
  const setZoom = activeCategory === 'PASSPORT' ? setPassZoom : setStampZoom;
  const pan = activeCategory === 'PASSPORT' ? passPan : stampPan;
  const setPan = activeCategory === 'PASSPORT' ? setPassPan : setStampPan;
  const rotate = activeCategory === 'PASSPORT' ? passRotate : stampRotate;
  const setRotate = activeCategory === 'PASSPORT' ? setPassRotate : setStampRotate;

  // Pointer drag events for panning photo relative to mask
  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDragStart({ x: clientX - pan.x, y: clientY - pan.y });
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setPan({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y,
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  // Perform surgical crop action
  const commitCrop = () => {
    if (!imgRef.current) return;
    const img = imgRef.current;

    // 1. Passport Crop
    const passW = Math.max(350, Math.round(selectedPassportPreset.widthMm * 12));
    const passH = Math.max(450, Math.round(selectedPassportPreset.heightMm * 12));
    const passCanvas = document.createElement('canvas');
    passCanvas.width = passW;
    passCanvas.height = passH;
    const pctx = passCanvas.getContext('2d');

    if (pctx) {
      pctx.fillStyle = '#ffffff';
      pctx.fillRect(0, 0, passW, passH);
      pctx.save();
      pctx.translate(passW / 2, passH / 2);
      pctx.rotate((passRotate * Math.PI) / 180);

      const viewportScale = Math.min(280 / img.width, 280 / img.height);
      const activeMaskW = getMaskWidthForPreset(selectedPassportPreset);
      const finalScale = passZoom * viewportScale * (passW / activeMaskW);

      pctx.scale(finalScale, finalScale);

      const relativePanX = (passPan.x / passZoom) / viewportScale;
      const relativePanY = (passPan.y / passZoom) / viewportScale;

      pctx.drawImage(img, -img.width / 2 + relativePanX, -img.height / 2 + relativePanY);
      pctx.restore();
      setPassportCroppedSrc(passCanvas.toDataURL('image/png'));
    }

    // 2. Stamp Crop
    const stmW = Math.max(240, Math.round(selectedStampPreset.widthMm * 12));
    const stmH = Math.max(300, Math.round(selectedStampPreset.heightMm * 12));
    const stampCanvas = document.createElement('canvas');
    stampCanvas.width = stmW;
    stampCanvas.height = stmH;
    const sctx = stampCanvas.getContext('2d');

    if (sctx) {
      sctx.fillStyle = '#ffffff';
      sctx.fillRect(0, 0, stmW, stmH);
      sctx.save();
      sctx.translate(stmW / 2, stmH / 2);
      sctx.rotate((stampRotate * Math.PI) / 180);

      const viewportScale = Math.min(280 / img.width, 280 / img.height);
      const activeMaskW = getMaskWidthForPreset(selectedStampPreset);
      const finalScale = stampZoom * viewportScale * (stmW / activeMaskW);

      sctx.scale(finalScale, finalScale);

      const sPanX = (stampPan.x === 0 ? passPan.x : stampPan.x) / stampZoom / viewportScale;
      const sPanY = (stampPan.y === 0 ? passPan.y : stampPan.y) / stampZoom / viewportScale;

      sctx.drawImage(img, -img.width / 2 + sPanX, -img.height / 2 + sPanY);
      sctx.restore();
      setStampCroppedSrc(stampCanvas.toDataURL('image/png'));
    }
  };

  const getMaskWidthForPreset = (preset: CountryPreset) => {
    const r = preset.widthMm / preset.heightMm;
    const maxBox = 220;
    if (r <= 1) {
      let mw = Math.round(maxBox * r);
      return mw > maxBox ? maxBox : mw;
    } else {
      return maxBox;
    }
  };

  const handleFinish = () => {
    if (passportCroppedSrc && stampCroppedSrc) {
      onCropCompleted(
        passportCroppedSrc,
        stampCroppedSrc,
        selectedPassportPreset.widthMm,
        selectedPassportPreset.heightMm,
        selectedStampPreset.widthMm,
        selectedStampPreset.heightMm,
        selectedPassportPreset.name
      );
    }
  };

  const handleSelectPreset = (preset: CountryPreset) => {
    if (activeCategory === 'PASSPORT') {
      setSelectedPassportPreset(preset);
    } else {
      setSelectedStampPreset(preset);
    }
    setIsSelectorOpen(false);
    if (imgRef.current) {
      if (activeCategory === 'PASSPORT') {
        generateAutoCrops(imgRef.current, preset, selectedStampPreset);
      } else {
        generateAutoCrops(imgRef.current, selectedPassportPreset, preset);
      }
    }
  };

  return (
    <div className="flex flex-col flex-1 select-none overflow-hidden h-full">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 p-3.5 shrink-0 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold tracking-widest text-indigo-400 uppercase">Step 3 of 4</span>
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            Passport & Stamp Photo Crop
          </h2>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
          <Globe size={13} className="text-indigo-400" />
          <span className="text-[11px] font-bold text-slate-200">
            {selectedPassportPreset.flag} {selectedPassportPreset.code}
          </span>
        </div>
      </div>

      {/* Main Category Switcher Tabs */}
      <div className="bg-slate-950 p-2 shrink-0 border-b border-slate-850 flex gap-1.5">
        <button
          onClick={() => {
            setActiveCategory('PASSPORT');
            setIsSelectorOpen(false);
          }}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeCategory === 'PASSPORT'
              ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 shadow-sm'
              : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-300'
          }`}
        >
          <span className="text-sm">🌐</span>
          <span>Passport Size (All Countries)</span>
        </button>

        <button
          onClick={() => {
            setActiveCategory('STAMP');
            setIsSelectorOpen(false);
          }}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeCategory === 'STAMP'
              ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 shadow-sm'
              : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-300'
          }`}
        >
          <span className="text-sm">🏷️</span>
          <span>Stamp Size Options</span>
        </button>
      </div>

      {/* Country / Preset Selection Toolbar */}
      <div className="bg-slate-900 p-2.5 shrink-0 border-b border-slate-850 space-y-2">
        {/* Active Selection Dropdown Button */}
        <div className="relative">
          <button
            onClick={() => setIsSelectorOpen((prev) => !prev)}
            className="w-full bg-slate-950 hover:bg-slate-850 p-2.5 rounded-xl border border-indigo-500/30 transition flex items-center justify-between cursor-pointer group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-lg shrink-0">{activePreset.flag}</span>
              <div className="text-left min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white truncate">{activePreset.name}</span>
                  <span className="text-[10px] bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.2 rounded font-mono font-bold shrink-0">
                    {activePreset.widthMm} × {activePreset.heightMm} mm
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 truncate">{activePreset.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-indigo-400 shrink-0 ml-2">
              <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Change</span>
              <ChevronDown size={16} className={`transition-transform duration-200 ${isSelectorOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {/* Preset Selector Drawer / Dropdown */}
          {isSelectorOpen && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-950 border border-indigo-500/30 rounded-2xl p-3 shadow-2xl z-30 space-y-2 max-h-[320px] flex flex-col">
              {/* Search Bar */}
              <div className="relative shrink-0">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={activeCategory === 'PASSPORT' ? "Search country or size (e.g., USA, UK, Canada, 35x45)..." : "Search stamp sizes..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  autoFocus
                />
              </div>

              {/* Scrollable Presets Grid */}
              <div className="flex-1 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                {filteredPresets.length > 0 ? (
                  filteredPresets.map((preset) => {
                    const isSelected = preset.id === activePreset.id;
                    return (
                      <div
                        key={preset.id}
                        onClick={() => handleSelectPreset(preset)}
                        className={`p-2 rounded-xl border transition flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600/20 border-indigo-500 text-white'
                            : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/80 text-slate-300 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-base shrink-0">{preset.flag}</span>
                          <div className="min-w-0">
                            <span className="text-xs font-bold block truncate">{preset.name}</span>
                            <span className="text-[10px] text-slate-400 block truncate">{preset.description}</span>
                          </div>
                        </div>

                        <span className={`text-[10px] px-2 py-0.5 rounded-lg font-mono font-bold shrink-0 ml-2 border ${
                          isSelected 
                            ? 'bg-indigo-500 text-white border-indigo-400' 
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}>
                          {preset.widthMm} × {preset.heightMm} mm
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-xs text-slate-500">
                    No matching presets found. Try searching for dimensions like "35x45" or country name.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Popular Quick-Select Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
          <span className="text-[9px] font-bold text-slate-400 uppercase shrink-0 mr-0.5">Quick Select:</span>
          {popularPresets.map((preset) => {
            const isSelected = preset.id === activePreset.id;
            return (
              <button
                key={`chip-${preset.id}`}
                onClick={() => handleSelectPreset(preset)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition shrink-0 flex items-center gap-1 cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-850 hover:text-white'
                }`}
              >
                <span>{preset.flag}</span>
                <span>{preset.name.split(' ')[0]}</span>
                <span className="text-[9px] font-mono text-indigo-300 font-semibold">({preset.widthMm}×{preset.heightMm})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Interactive Stage */}
      <div className="flex-1 relative bg-[#090d16] flex items-center justify-center overflow-hidden border-b border-slate-900">
        {/* Responsive viewport cropped container */}
        <div
          ref={containerRef}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
          className="relative overflow-hidden cursor-move touch-none flex items-center justify-center border border-slate-800 bg-slate-950 shadow-2xl"
          style={{ width: 280, height: 280 }}
        >
          {/* Transforming Portrait Image */}
          {imgRef.current && (
            <img
              src={imageSrc}
              alt="Cropping target"
              className="absolute max-w-none max-h-none pointer-events-none select-none"
              style={{
                width: imgRef.current.width,
                height: imgRef.current.height,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom * Math.min(280 / imgRef.current.width, 280 / imgRef.current.height)}) rotate(${rotate}deg)`,
                transformOrigin: 'center center',
              }}
            />
          )}

          {/* Cropping Semi-Transparent Boundary Mask */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Overlay mask with cut-out hole */}
            <div className="absolute inset-0 bg-black/60"></div>

            {/* Glowing Cropping Frame Hole */}
            <div
              className={`absolute border-[3px] border-dashed shadow-[0_0_0_999px_rgba(0,0,0,0.6)] rounded-sm flex items-center justify-center transition-all border-indigo-400`}
              style={{ width: maskW, height: maskH }}
            >
              {/* Head Outline guide */}
              <div
                className="absolute border border-white/20 rounded-[50%] flex items-center justify-center pointer-events-none"
                style={{ width: '70%', height: '70%', top: '12%' }}
              >
                {/* Hair line */}
                <div className="absolute top-[20%] w-full h-[1px] border-t border-dashed border-white/10"></div>
                {/* Eye line */}
                <div className="absolute top-[42%] w-full h-[1px] border-t border-dashed border-white/15"></div>
                {/* Chin line */}
                <div className="absolute bottom-[20%] w-full h-[1px] border-t border-dashed border-white/10"></div>
              </div>

              {/* Label indicator overlay */}
              <span className="absolute bottom-1.5 bg-slate-950/85 backdrop-blur-sm text-[9px] font-bold tracking-wider text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30 flex items-center gap-1 shadow-md">
                <span>{activePreset.flag}</span>
                <span>{activePreset.widthMm} × {activePreset.heightMm} mm</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Adjustments Bottom Sheet */}
      <div className="bg-slate-900 p-3.5 shrink-0 space-y-3 border-t border-slate-850">
        {/* Double slider control */}
        <div className="space-y-2">
          {/* Scale Slider */}
          <div className="flex items-center justify-between gap-3 bg-slate-850 px-3 py-1.5 rounded-xl border border-slate-800/60">
            <span className="text-[11px] text-slate-400 font-semibold shrink-0">Zoom Size</span>
            <input
              type="range"
              min="0.4"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs text-slate-300 font-mono font-bold shrink-0 w-8 text-right">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* Rotate Slider */}
          <div className="flex items-center justify-between gap-3 bg-slate-850 px-3 py-1.5 rounded-xl border border-slate-800/60">
            <span className="text-[11px] text-slate-400 font-semibold shrink-0">Align Angle</span>
            <input
              type="range"
              min="-45"
              max="45"
              step="1"
              value={rotate}
              onChange={(e) => setRotate(parseInt(e.target.value))}
              className="flex-1 accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs text-slate-300 font-mono font-bold shrink-0 w-8 text-right">
              {rotate}°
            </span>
          </div>
        </div>

        {/* Locked crop statuses */}
        <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-2 rounded-xl border border-slate-850">
          <div className="flex items-center gap-2">
            {passportCroppedSrc ? (
              <CheckCircle2 size={13} className="text-indigo-400 shrink-0" />
            ) : (
              <div className="w-3.5 h-3.5 rounded-full border border-slate-700 shrink-0"></div>
            )}
            <div className="min-w-0">
              <span className="text-[10px] text-slate-300 font-bold block truncate">
                {selectedPassportPreset.flag} Passport ({selectedPassportPreset.widthMm}x{selectedPassportPreset.heightMm}mm)
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {stampCroppedSrc ? (
              <CheckCircle2 size={13} className="text-indigo-400 shrink-0" />
            ) : (
              <div className="w-3.5 h-3.5 rounded-full border border-slate-700 shrink-0"></div>
            )}
            <div className="min-w-0">
              <span className="text-[10px] text-slate-300 font-bold block truncate">
                🏷️ Stamp ({selectedStampPreset.widthMm}x{selectedStampPreset.heightMm}mm)
              </span>
            </div>
          </div>
        </div>

        {/* Lock / Next Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onBack}
            className="flex-1 py-2.5 bg-slate-850 border border-slate-800 hover:bg-slate-800 text-slate-300 font-semibold rounded-xl text-xs transition cursor-pointer"
          >
            ← Back
          </button>

          <button
            onClick={commitCrop}
            className="flex-1 py-2.5 bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600/30 text-indigo-300 font-bold rounded-xl text-xs transition flex items-center justify-center gap-1 cursor-pointer"
          >
            <Scissors size={14} /> Lock Crop
          </button>

          <button
            onClick={handleFinish}
            disabled={!passportCroppedSrc && !stampCroppedSrc}
            className="flex-1.2 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl text-xs shadow-lg shadow-indigo-600/25 transition disabled:opacity-40 cursor-pointer"
          >
            Print Grid →
          </button>
        </div>
      </div>
    </div>
  );
}
