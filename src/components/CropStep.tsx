import React, { useState, useRef, useEffect } from 'react';
import { Scissors, RotateCw, Check, Undo, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { CropType, CROP_PRESETS, Point } from '../types';
import { motion } from 'motion/react';

interface CropStepProps {
  imageSrc: string; // Background processed image
  onCropCompleted: (passportSrc: string, stampSrc: string) => void;
  onBack: () => void;
}

export default function CropStep({ imageSrc, onCropCompleted, onBack }: CropStepProps) {
  const [activePreset, setActivePreset] = useState<CropType>('INDIAN_PASSPORT');
  
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

  // Load image once
  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      imgRef.current = img;
      
      // Auto-initialize crops on load so the user has immediate outputs without needing to manually crop!
      generateAutoCrops(img);
    };
  }, [imageSrc]);

  // Generate automated starting crops so user always has valid results
  const generateAutoCrops = (img: HTMLImageElement) => {
    const passCanvas = document.createElement('canvas');
    passCanvas.width = 420;
    passCanvas.height = 540;
    const pctx = passCanvas.getContext('2d');
    if (pctx) {
      // Draw centered 35:45 crop
      let sw = img.width;
      let sh = (img.width * 45) / 35;
      if (sh > img.height) {
        sh = img.height;
        sw = (img.height * 35) / 45;
      }
      const sx = (img.width - sw) / 2;
      const sy = (img.height - sh) / 2;
      pctx.drawImage(img, sx, sy, sw, sh, 0, 0, 420, 540);
      setPassportCroppedSrc(passCanvas.toDataURL());
    }

    const stampCanvas = document.createElement('canvas');
    stampCanvas.width = 400;
    stampCanvas.height = 500; // 4:5 aspect ratio
    const sctx = stampCanvas.getContext('2d');
    if (sctx) {
      // Draw centered 4:5 crop
      let sw = img.width;
      let sh = (img.width * 5) / 4;
      if (sh > img.height) {
        sh = img.height;
        sw = (img.height * 4) / 5;
      }
      const sx = (img.width - sw) / 2;
      const sy = (img.height - sh) / 2;
      sctx.drawImage(img, sx, sy, sw, sh, 0, 0, 400, 500);
      setStampCroppedSrc(stampCanvas.toDataURL());
    }
  };

  // Switch presets and apply default zooms
  const handlePresetChange = (preset: CropType) => {
    setActivePreset(preset);
  };

  // Get active values based on current activePreset tab
  const getTransformValues = () => {
    if (activePreset === 'INDIAN_PASSPORT') {
      return {
        zoom: passZoom,
        setZoom: setPassZoom,
        pan: passPan,
        setPan: setPassPan,
        rotate: passRotate,
        setRotate: setPassRotate,
        aspectRatio: 35 / 45,
        maskW: 196,
        maskH: 252,
      };
    } else {
      return {
        zoom: stampZoom,
        setZoom: setStampZoom,
        pan: stampPan,
        setPan: setStampPan,
        rotate: stampRotate,
        setRotate: setStampRotate,
        aspectRatio: 0.8, // 20:25 (4:5)
        maskW: 200,
        maskH: 250,
      };
    }
  };

  const { zoom, setZoom, pan, setPan, rotate, setRotate, maskW, maskH } = getTransformValues();

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

    const cropCanvas = document.createElement('canvas');
    
    // Passport is 420x540 (35:45 ratio), Stamp is 480x600 (4:5 ratio)
    if (activePreset === 'INDIAN_PASSPORT') {
      cropCanvas.width = 420;
      cropCanvas.height = 540;
    } else {
      cropCanvas.width = 480;
      cropCanvas.height = 600;
    }

    const ctx = cropCanvas.getContext('2d');
    if (!ctx) return;

    const cw = cropCanvas.width;
    const ch = cropCanvas.height;

    // Apply background color to crop canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cw, ch);

    // Save context and apply transformations
    ctx.save();
    
    // 1. Move to center of canvas
    ctx.translate(cw / 2, ch / 2);
    
    // 2. Apply user rotation
    ctx.rotate((rotate * Math.PI) / 180);
    
    // 3. Apply user zoom & relative panning
    // Scale must scale based on the relative size of image inside viewport
    const viewportScale = Math.min(280 / img.width, 280 / img.height); // estimate scale inside preview
    const activeMaskW = activePreset === 'INDIAN_PASSPORT' ? 196 : 200;
    const finalScale = zoom * viewportScale * (cw / activeMaskW); // scale up to crop canvas resolution
    
    ctx.scale(finalScale, finalScale);
    
    // 4. Draw image with pan coordinates
    // Translate inside the scaled space
    const relativePanX = (pan.x / zoom) / viewportScale;
    const relativePanY = (pan.y / zoom) / viewportScale;
    
    ctx.drawImage(img, -img.width / 2 + relativePanX, -img.height / 2 + relativePanY);
    
    ctx.restore();

    // Save resulting dataURL
    const dataUrl = cropCanvas.toDataURL('image/png');
    if (activePreset === 'INDIAN_PASSPORT') {
      setPassportCroppedSrc(dataUrl);
      
      // Smart Auto-crop: also create a stamp size based on Passport adjustments
      // so user doesn't strictly have to adjust stamp size separately!
      const stampCanvas = document.createElement('canvas');
      stampCanvas.width = 480;
      stampCanvas.height = 600;
      const sctx = stampCanvas.getContext('2d');
      if (sctx) {
        sctx.fillStyle = '#ffffff';
        sctx.fillRect(0, 0, 480, 600);
        sctx.save();
        sctx.translate(240, 300);
        sctx.rotate((rotate * Math.PI) / 180);
        // Slightly tighter zoom for stamp
        const sScale = stampZoom * viewportScale * (480 / 200);
        sctx.scale(sScale, sScale);
        
        const sPanX = (stampPan.x === 0 ? pan.x : stampPan.x) / stampZoom / viewportScale;
        const sPanY = (stampPan.y === 0 ? pan.y : stampPan.y) / stampZoom / viewportScale;
        
        sctx.drawImage(img, -img.width / 2 + sPanX, -img.height / 2 + sPanY);
        sctx.restore();
        setStampCroppedSrc(stampCanvas.toDataURL());
      }
    } else {
      setStampCroppedSrc(dataUrl);
    }
  };

  const handleFinish = () => {
    if (passportCroppedSrc && stampCroppedSrc) {
      onCropCompleted(passportCroppedSrc, stampCroppedSrc);
    }
  };

  return (
    <div className="flex flex-col flex-1 select-none overflow-hidden h-full">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 p-4 shrink-0">
        <span className="text-[10px] font-bold tracking-widest text-indigo-400 uppercase">Step 3 of 4</span>
        <h2 className="text-base font-bold text-white tracking-tight">Passport Size Cropping</h2>
      </div>

      {/* Selector Tabs */}
      <div className="bg-slate-950 p-2.5 shrink-0 border-b border-slate-900 flex gap-2">
        <button
          onClick={() => handlePresetChange('INDIAN_PASSPORT')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activePreset === 'INDIAN_PASSPORT'
              ? 'bg-indigo-600/15 text-indigo-300 border-indigo-500/30 shadow-sm'
              : 'bg-transparent text-slate-400 border-transparent hover:text-slate-300'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
          Indian Passport (35 x 45 mm)
        </button>
        <button
          onClick={() => handlePresetChange('INDIAN_STAMP')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activePreset === 'INDIAN_STAMP'
              ? 'bg-indigo-600/15 text-indigo-300 border-indigo-500/30 shadow-sm'
              : 'bg-transparent text-slate-400 border-transparent hover:text-slate-300'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-indigo-500/60"></span>
          Stamp Size (2 x 2.5cm)
        </button>
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
              className={`absolute border-[3px] border-dashed shadow-[0_0_0_999px_rgba(0,0,0,0.6)] rounded-sm flex items-center justify-center transition-all ${
                activePreset === 'INDIAN_PASSPORT' ? 'border-indigo-400' : 'border-indigo-500/70'
              }`}
              style={{ width: maskW, height: maskH }}
            >
              {/* Head Outline guide */}
              <div className="absolute border border-white/20 rounded-[50%] flex items-center justify-center pointer-events-none"
                   style={{ width: '70%', height: '70%', top: '12%' }}>
                 {/* Hair line */}
                 <div className="absolute top-[20%] w-full h-[1px] border-t border-dashed border-white/10"></div>
                 {/* Eye line */}
                 <div className="absolute top-[42%] w-full h-[1px] border-t border-dashed border-white/15"></div>
                 {/* Chin line */}
                 <div className="absolute bottom-[20%] w-full h-[1px] border-t border-dashed border-white/10"></div>
              </div>

              {/* Label indicator */}
              <span className="absolute bottom-2 bg-slate-950/80 backdrop-blur-sm text-[9px] font-bold tracking-widest text-slate-300 px-2 py-0.5 rounded-full uppercase border border-white/10">
                {activePreset === 'INDIAN_PASSPORT' ? '35 x 45 mm Frame' : '2 x 2.5cm Stamp'}
              </span>
            </div>
          </div>
        </div>


      </div>

      {/* Adjustments Bottom Sheet */}
      <div className="bg-slate-900 p-4 shrink-0 space-y-4 border-t border-slate-850">
        {/* Double slider control */}
        <div className="space-y-3">
          {/* Scale Slider */}
          <div className="flex items-center justify-between gap-3 bg-slate-850 px-3 py-2 rounded-xl border border-slate-800/60">
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
          <div className="flex items-center justify-between gap-3 bg-slate-850 px-3 py-2 rounded-xl border border-slate-800/60">
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
        <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-850">
          <div className="flex items-center gap-2">
            {passportCroppedSrc ? (
              <CheckCircle2 size={14} className="text-indigo-400 shrink-0" />
            ) : (
              <div className="w-3.5 h-3.5 rounded-full border border-slate-700 shrink-0"></div>
            )}
            <span className="text-[10px] text-slate-400 font-medium">Passport Size</span>
          </div>
          <div className="flex items-center gap-2">
            {stampCroppedSrc ? (
              <CheckCircle2 size={14} className="text-indigo-400 shrink-0" />
            ) : (
              <div className="w-3.5 h-3.5 rounded-full border border-slate-700 shrink-0"></div>
            )}
            <span className="text-[10px] text-slate-400 font-medium">Stamp Size</span>
          </div>
        </div>

        {/* Lock / Next Actions */}
        <div className="flex gap-2.5 pt-1.5">
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
