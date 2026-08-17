import React, { useState, useRef, useEffect } from 'react';
import { 
  Scissors, Hand, Trash2, RotateCcw, RotateCw, ZoomIn, ZoomOut, 
  Paintbrush, Sliders, Check, HelpCircle, Palette, ToggleLeft, ToggleRight,
  ExternalLink, Sparkles
} from 'lucide-react';
import { Point, EditMode, BackgroundState } from '../types';
import { findMagneticSnapPoint, performMagicWand, applyLassoCut, applyBgColorToDataUrl } from '../utils/imageUtils';
import { motion } from 'motion/react';

interface BackgroundStepProps {
  imageSrc: string;
  onBackgroundProcessed: (finalImageSrc: string) => void;
  onBack: () => void;
}

export default function BackgroundStep({ imageSrc, onBackgroundProcessed, onBack }: BackgroundStepProps) {
  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageContainerRef = useRef<HTMLDivElement>(null);

  // Layout states
  const [editMode, setEditMode] = useState<EditMode>('MAGIC_WAND');
  const [isLassoKeepMode, setIsLassoKeepMode] = useState<boolean>(false); // Keep selection or delete selection
  const [bgColor, setBgColor] = useState<string>('#ffffff'); // Default Indian Passport white background
  const [brushSize, setBrushSize] = useState<number>(20);
  const [tolerance, setTolerance] = useState<number>(30); // Magic wand tolerance
  
  // Undo/Redo & Image States
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);

  // Zoom & Pan States
  const [zoom, setZoom] = useState<number>(1);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });

  // Lasso Points
  const [lassoPoints, setLassoPoints] = useState<Point[]>([]);
  const [currentMousePos, setCurrentMousePos] = useState<Point | null>(null);

  // Brush drawing state
  const [isDrawing, setIsDrawing] = useState<boolean>(false);

  // Show help instructions
  const [showHelp, setShowHelp] = useState<boolean>(true);

  const imgRef = useRef<HTMLImageElement | null>(null);

  // Standard Passport Background Presets
  const BG_PRESETS = [
    { name: 'White', value: '#ffffff', label: 'White' },
    { name: 'Light Blue', value: '#add8e6', label: 'Light Blue' },
    { name: 'Blue', value: '#1d4ed8', label: 'Royal Blue' },
    { name: 'Grey', value: '#e2e8f0', label: 'Light Grey' },
    { name: 'Transparent', value: 'transparent', label: 'Transparent' },
  ];

  // Initialize main canvas when image loads
  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      imgRef.current = img;
      
      const canvas = canvasRef.current;
      if (canvas) {
        // Set canvas dimensions relative to image aspect ratio (max 800px width/height)
        const maxDim = 800;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          
          // Create offscreen copy of the original raw image
          const origCanvas = document.createElement('canvas');
          origCanvas.width = w;
          origCanvas.height = h;
          const octx = origCanvas.getContext('2d');
          if (octx) {
            octx.drawImage(img, 0, 0, w, h);
            originalCanvasRef.current = origCanvas;
          }

          const initialDataUrl = canvas.toDataURL();
          setHistory([initialDataUrl]);
          setHistoryIndex(0);
          setImageLoaded(true);

          // Center the image in the container viewport on load
          fitImageToContainer(w, h);
        }
      }
    };
  }, [imageSrc]);

  // Fit image to view container dynamically
  const fitImageToContainer = (canvasW: number, canvasH: number) => {
    const container = stageContainerRef.current;
    const containerW = container ? container.clientWidth : 500;
    const containerH = container ? container.clientHeight : 450;
    
    const scaleX = containerW / canvasW;
    const scaleY = containerH / canvasH;
    const newZoom = Math.min(scaleX * 0.95, scaleY * 0.95, 1.8); // Fit nicely with subtle padding
    
    setZoom(newZoom);
    setPanX((containerW - canvasW * newZoom) / 2);
    setPanY((containerH - canvasH * newZoom) / 2);
  };

  // Auto-fit canvas on window resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && imageLoaded) {
        fitImageToContainer(canvasRef.current.width, canvasRef.current.height);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [imageLoaded]);

  // Smooth mouse scroll wheel zooming relative to cursor position
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const zoomIntensity = 0.08;
    
    // Get mouse position relative to the container
    const containerRect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;

    const currentZoom = zoom;
    let nextZoom = currentZoom;
    if (e.deltaY < 0) {
      nextZoom = Math.min(8, currentZoom + zoomIntensity * currentZoom);
    } else {
      nextZoom = Math.max(0.4, currentZoom - zoomIntensity * currentZoom);
    }

    const canvasX = (mouseX - panX) / currentZoom;
    const canvasY = (mouseY - panY) / currentZoom;

    setZoom(nextZoom);
    setPanX(mouseX - canvasX * nextZoom);
    setPanY(mouseY - canvasY * nextZoom);
  };

  // Push canvas to history for Undo/Redo
  const saveStateToHistory = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL();
      const nextHistory = history.slice(0, historyIndex + 1);
      nextHistory.push(dataUrl);
      setHistory(nextHistory);
      setHistoryIndex(nextHistory.length - 1);
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      loadHistoryState(prevIndex);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      loadHistoryState(nextIndex);
    }
  };

  const loadHistoryState = (index: number) => {
    const dataUrl = history[index];
    const canvas = canvasRef.current;
    if (canvas && dataUrl) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          drawCanvasContent();
        }
      };
    }
  };

  // Maps viewport coordinate to canvas image coordinate
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('changedTouches' in e) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Coordinates relative to the canvas DOM element
    const elemX = ((clientX - rect.left) / rect.width) * canvas.width;
    const elemY = ((clientY - rect.top) / rect.height) * canvas.height;

    return { x: elemX, y: elemY };
  };

  // Render Loop
  const drawCanvasContent = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // We do NOT clear the image pixels on the canvas itself, because they are our editing target.
    // Instead, we just trigger drawing lasso guides and paths on top of the DOM elements or as an overlay.
  };

  // Draw overlay guides (lasso selection paths, points)
  const renderOverlaySvg = () => {
    if (!canvasRef.current) return null;
    
    const canvasW = canvasRef.current.width;
    const canvasH = canvasRef.current.height;

    // Render active lasso points scaled to screen viewport
    const pointsSvg = lassoPoints.map((p, idx) => {
      // transform coordinates based on current zoom and pan
      const screenX = p.x;
      const screenY = p.y;
      return (
        <circle
          key={idx}
          cx={screenX}
          cy={screenY}
          r={4 / zoom}
          className="fill-indigo-400 stroke-slate-950 stroke-[1.5px]"
        />
      );
    });

    let pathD = '';
    if (lassoPoints.length > 0) {
      pathD = `M ${lassoPoints[0].x} ${lassoPoints[0].y} `;
      for (let i = 1; i < lassoPoints.length; i++) {
        pathD += `L ${lassoPoints[i].x} ${lassoPoints[i].y} `;
      }

      // Live rubberband to current mouse / snapped cursor
      if (currentMousePos && editMode !== 'MAGIC_WAND' && editMode !== 'BRUSH_ERASE' && editMode !== 'BRUSH_RESTORE') {
        const snap = getSnapPoint(currentMousePos);
        pathD += `L ${snap.x} ${snap.y}`;
      }
    }

    return (
      <svg
        className="absolute inset-0 pointer-events-none w-full h-full"
        viewBox={`0 0 ${canvasW} ${canvasH}`}
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {lassoPoints.length > 0 && (
          <path
            d={pathD}
            fill="rgba(99, 102, 241, 0.15)"
            className="stroke-indigo-400 stroke-[2px] stroke-dasharray-[4] animate-[dash_1s_linear_infinite]"
            style={{ strokeWidth: 2 / zoom }}
          />
        )}
        {pointsSvg}
      </svg>
    );
  };

  // Get active snapped position if magnetic lasso is active
  const getSnapPoint = (rawPos: Point): Point => {
    if (editMode === 'MAGNETIC_LASSO' && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        // Snap coordinates in raw canvas space
        return findMagneticSnapPoint(ctx, rawPos, 18);
      }
    }
    return rawPos;
  };

  // Interactive mouse / touch gesture start
  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    // If we're using "Hand" pan tool or holding Spacebar
    if (e.button === 1 || editMode === 'MAGIC_WAND' && 'touches' in e && e.touches.length > 1) {
      // Allow multi-touch pinch pan
      return;
    }

    const pos = getCanvasCoords(e);

    // Panning navigation
    if (editMode === 'PAN' || e.button === 2 || (e.button === 0 && e.shiftKey)) {
      setIsPanning(true);
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      setPanStart({ x: clientX - panX, y: clientY - panY });
      return;
    }

    if (editMode === 'MAGIC_WAND') {
      performMagicWand(canvasRef.current!, pos, tolerance);
      saveStateToHistory();
      return;
    }

    if (editMode === 'BRUSH_ERASE' || editMode === 'BRUSH_RESTORE') {
      setIsDrawing(true);
      applyBrushAtPoint(pos);
      return;
    }

    // Lasso drawing click
    if (editMode === 'MAGNETIC_LASSO' || editMode === 'FREEHAND_LASSO') {
      const snapped = getSnapPoint(pos);
      
      // If click is very close to initial point, close lasso
      if (lassoPoints.length > 2) {
        const startP = lassoPoints[0];
        const dist = Math.sqrt(Math.pow(snapped.x - startP.x, 2) + Math.pow(snapped.y - startP.y, 2));
        if (dist < 15 / zoom) {
          closeLassoPath();
          return;
        }
      }

      setLassoPoints([...lassoPoints, snapped]);
    }
  };

  // Interactive pointer motion
  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const pos = getCanvasCoords(e);
    setCurrentMousePos(pos);

    // Pan drawing
    if (isPanning) {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      setPanX(clientX - panStart.x);
      setPanY(clientY - panStart.y);
      return;
    }

    // Manual brush erases / restores
    if (isDrawing && (editMode === 'BRUSH_ERASE' || editMode === 'BRUSH_RESTORE')) {
      applyBrushAtPoint(pos);
    }
  };

  const handlePointerUp = () => {
    if (isPanning) {
      setIsPanning(false);
    }
    if (isDrawing) {
      setIsDrawing(false);
      saveStateToHistory();
    }
  };

  // Apply manual circular brush erase or restore
  const applyBrushAtPoint = (pos: Point) => {
    const canvas = canvasRef.current;
    const origCanvas = originalCanvasRef.current;
    if (!canvas || !origCanvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);

    if (editMode === 'BRUSH_ERASE') {
      // Eraser clears pixels
      ctx.clip();
      ctx.clearRect(pos.x - brushSize, pos.y - brushSize, brushSize * 2, brushSize * 2);
    } else if (editMode === 'BRUSH_RESTORE') {
      // Restore history brush paints original pixels back
      ctx.clip();
      ctx.drawImage(origCanvas, 0, 0);
    }

    ctx.restore();
    drawCanvasContent();
  };

  // Closes lasso loop and applies standard crop/mask logic
  const closeLassoPath = () => {
    if (lassoPoints.length < 3) return;
    
    // Apply selected transparency
    // insideIfTrue: true means we erase background inside, false means keep inside and erase outside!
    // Since user selected background, typically they want to erase "Inside Selection" (to remove background),
    // or if they lassoed the subject, they want to erase "Outside Selection" (keep selection).
    // Let's ask them or apply the toggle preference:
    applyLassoCut(canvasRef.current!, lassoPoints, !isLassoKeepMode);
    
    // Clear state
    setLassoPoints([]);
    setHistoryIndex(prev => prev); // refresh state
    saveStateToHistory();
  };

  // Clear lasso points
  const clearSelection = () => {
    setLassoPoints([]);
  };

  // Zoom helpers
  const handleZoomIn = () => setZoom(z => Math.min(8, z + 0.2));
  const handleZoomOut = () => setZoom(z => Math.max(0.4, z - 0.2));
  const handleZoomReset = () => {
    if (canvasRef.current) {
      fitImageToContainer(canvasRef.current.width, canvasRef.current.height);
    }
  };

  // Apply background color composite and proceed to Crop step
  const handleProceed = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Applies the selected solid background color to the transparent spots
      const finishedDataUrl = applyBgColorToDataUrl(canvas, bgColor);
      onBackgroundProcessed(finishedDataUrl);
    }
  };

  const getCursorClass = () => {
    if (editMode === 'PAN') {
      return isPanning ? 'cursor-grabbing' : 'cursor-grab';
    }
    if (editMode === 'MAGIC_WAND') return 'cursor-pointer';
    return 'cursor-crosshair';
  };

  return (
    <div className="flex flex-col flex-1 select-none overflow-hidden h-full">
      {/* Top Banner: External AI Background Remover */}
      <a
        href="https://ais-pre-5l6cnxqrjijfjadlkmfffe-199113885584.asia-southeast1.run.app/"
        target="_blank"
        rel="noopener noreferrer"
        title="Remove background of image - Open external AI tool"
        className="bg-gradient-to-r from-indigo-950 via-indigo-900/90 to-purple-950/90 border-b border-indigo-500/30 px-3.5 py-2 flex items-center justify-between gap-2.5 text-white transition-colors hover:bg-indigo-900/60 group shrink-0 no-underline shadow-sm"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-indigo-500/25 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shrink-0 group-hover:scale-105 transition-transform">
            <Sparkles size={13} className="text-indigo-300" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-indigo-100 flex items-center gap-1.5 truncate">
              <span>Remove background of image</span>
              <span className="text-[9px] bg-indigo-500/30 text-indigo-200 px-1.5 py-0.2 rounded font-semibold border border-indigo-400/30">
                AI Tool
              </span>
            </div>
            <p className="text-[10px] text-slate-300/80 truncate hidden sm:block">
              One-click instant automated background removal
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-300 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 px-2 py-0.5 rounded-lg shrink-0 transition-colors">
          <span>Open Link</span>
          <ExternalLink size={11} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </div>
      </a>

      {/* Step Header */}
      <div className="bg-slate-900 border-b border-slate-800 p-3.5 shrink-0 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold tracking-widest text-indigo-400 uppercase">Step 2 of 4</span>
          <h2 className="text-base font-bold text-white tracking-tight">Remove Background of Image</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-40 hover:bg-slate-700 transition cursor-pointer"
            title="Undo"
          >
            <RotateCcw size={15} />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-40 hover:bg-slate-700 transition cursor-pointer"
            title="Redo"
          >
            <RotateCw size={15} />
          </button>
          <button
            onClick={() => setShowHelp(prev => !prev)}
            className={`p-1.5 rounded-lg transition cursor-pointer ${showHelp ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-slate-800 text-slate-400'}`}
          >
            <HelpCircle size={15} />
          </button>
        </div>
      </div>

      {/* Help Panel */}
      {showHelp && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-slate-900/90 border-b border-slate-800 px-4 py-2.5 text-xs text-slate-300 flex items-start gap-2 shrink-0"
        >
          <div className="text-indigo-400 font-bold shrink-0 mt-0.5">Tip:</div>
          <p className="leading-relaxed text-[11px]">
            {editMode === 'MAGNETIC_LASSO' && 'Magnetic Lasso: Click around your shoulders and head. The line automatically snaps to edges. Click first point or "Close Selection" below to finish.'}
            {editMode === 'MAGIC_WAND' && 'Magic Wand: Click any plain colored background area. It instantly removes matching colors. Use tolerance slider to adjust sensitivity.'}
            {editMode === 'BRUSH_ERASE' && 'Manual Eraser: Drag over any leftover areas to clean them up. Zoom in for absolute pixel perfection.'}
            {editMode === 'BRUSH_RESTORE' && 'Restore Brush: Drag to repaint original image back. Excellent for fixing hair or shoulder details.'}
          </p>
        </motion.div>
      )}

      {/* Canvas Viewport Stage */}
      <div 
        ref={stageContainerRef}
        onWheel={handleWheel}
        className="flex-1 relative overflow-hidden bg-slate-950 flex items-center justify-center border-b border-slate-900"
      >
        {/* Transparency Checkerboard background */}
        <div 
          className="absolute inset-0 z-0 opacity-15"
          style={{
            backgroundImage: 'radial-gradient(#334155 1px, transparent 1px), radial-gradient(#334155 1px, transparent 1px)',
            backgroundSize: '16px 16px',
            backgroundPosition: '0 0, 8px 8px',
            backgroundColor: bgColor === 'transparent' ? '#090d16' : bgColor,
          }}
        ></div>

        {/* Outer Background representation */}
        {bgColor !== 'transparent' && (
          <div 
            className="absolute inset-0 transition-colors duration-200 z-0 opacity-40 pointer-events-none"
            style={{ backgroundColor: bgColor }}
          />
        )}

        {/* Interactive Canvas Canvas and Guides container */}
        <div 
          className="relative select-none"
          style={{
            width: canvasRef.current?.width || '100%',
            height: canvasRef.current?.height || '100%',
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
            className={`absolute inset-0 z-10 touch-none max-w-none ${getCursorClass()}`}
          />
        </div>

        {/* Live Vector Snap Line and Dots Overlay */}
        {renderOverlaySvg()}

        {/* Zoom controls float button */}
        <div className="absolute bottom-4 right-4 z-30 flex flex-col gap-1 bg-slate-900/90 border border-slate-800 p-1.5 rounded-xl shadow-2xl backdrop-blur-md">
          <button onClick={handleZoomIn} className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"><ZoomIn size={16} /></button>
          <button onClick={handleZoomOut} className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"><ZoomOut size={16} /></button>
          <button onClick={handleZoomReset} className="p-1 text-[10px] text-indigo-400 hover:bg-slate-800 font-bold px-1 py-1 rounded transition cursor-pointer">Fit</button>
        </div>

        {/* Navigation Indicator / Move Instructions */}
        <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-sm border border-slate-800/80 px-2.5 py-1 rounded-lg text-[10px] text-slate-400 font-mono z-30 flex items-center gap-1.5">
          <Hand size={12} className="text-indigo-400" />
          <span>Scroll wheel / Pinch to Zoom • Drag to Pan</span>
        </div>
      </div>

      {/* Side Tools & Presets Configuration Panel */}
      <div className="bg-slate-900 p-4 border-t border-slate-850 shrink-0 space-y-4">
        {/* 1. Edit Tool Mode Selector */}
        <div>
          <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block mb-2">Editor Tools</span>
          <div className="grid grid-cols-5 gap-1.5">
            <button
              onClick={() => { setEditMode('MAGNETIC_LASSO'); clearSelection(); }}
              className={`py-2 px-1 rounded-xl text-[11px] font-medium flex flex-col items-center gap-1 border transition cursor-pointer ${
                editMode === 'MAGNETIC_LASSO'
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/25'
                  : 'bg-slate-850 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              <Scissors size={15} />
              <span>Magnetic</span>
            </button>

            <button
              onClick={() => { setEditMode('MAGIC_WAND'); clearSelection(); }}
              className={`py-2 px-1 rounded-xl text-[11px] font-medium flex flex-col items-center gap-1 border transition cursor-pointer ${
                editMode === 'MAGIC_WAND'
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/25'
                  : 'bg-slate-850 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              <Palette size={15} />
              <span>Wand</span>
            </button>

            <button
              onClick={() => { setEditMode('BRUSH_ERASE'); clearSelection(); }}
              className={`py-2 px-1 rounded-xl text-[11px] font-medium flex flex-col items-center gap-1 border transition cursor-pointer ${
                editMode === 'BRUSH_ERASE'
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/25'
                  : 'bg-slate-850 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              <Trash2 size={15} />
              <span>Eraser</span>
            </button>

            <button
              onClick={() => { setEditMode('BRUSH_RESTORE'); clearSelection(); }}
              className={`py-2 px-1 rounded-xl text-[11px] font-medium flex flex-col items-center gap-1 border transition cursor-pointer ${
                editMode === 'BRUSH_RESTORE'
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/25'
                  : 'bg-slate-850 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              <Paintbrush size={15} />
              <span>Restore</span>
            </button>

            <button
              onClick={() => { setEditMode('PAN'); clearSelection(); }}
              className={`py-2 px-1 rounded-xl text-[11px] font-medium flex flex-col items-center gap-1 border transition cursor-pointer ${
                editMode === 'PAN'
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/25'
                  : 'bg-slate-850 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              <Hand size={15} />
              <span>Pan & Zoom</span>
            </button>
          </div>
        </div>

        {/* 2. Tool Adjustment Sliders / Lasso Close Controls */}
        {editMode === 'BRUSH_ERASE' || editMode === 'BRUSH_RESTORE' ? (
          <div className="bg-slate-850 p-2.5 rounded-xl border border-slate-800/60 flex items-center justify-between gap-3">
            <span className="text-[11px] text-slate-300 font-medium shrink-0">Brush Size: {brushSize}px</span>
            <input
              type="range"
              min="5"
              max="100"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="flex-1 accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        ) : null}

        {editMode === 'MAGIC_WAND' ? (
          <div className="bg-slate-850 p-2.5 rounded-xl border border-slate-800/60 flex items-center justify-between gap-3">
            <span className="text-[11px] text-slate-300 font-medium shrink-0">Tolerance: {tolerance}</span>
            <input
              type="range"
              min="5"
              max="120"
              value={tolerance}
              onChange={(e) => setTolerance(parseInt(e.target.value))}
              className="flex-1 accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        ) : null}

        {editMode === 'MAGNETIC_LASSO' && lassoPoints.length > 0 ? (
          <div className="flex gap-2">
            <button
              onClick={closeLassoPath}
              className="flex-1 py-1.5 px-3 bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-xs rounded-lg font-semibold hover:bg-indigo-500/30 transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check size={14} /> Close Selection
            </button>
            <button
              onClick={clearSelection}
              className="py-1.5 px-3 bg-slate-800 border border-slate-750 text-slate-300 text-xs rounded-lg font-semibold hover:bg-slate-700 transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        ) : null}

        {editMode === 'MAGNETIC_LASSO' && (
          <div className="flex items-center justify-between bg-slate-850/80 px-3 py-1.5 rounded-xl border border-slate-800/50">
            <span className="text-[11px] text-slate-300">Lasso Cut Mode:</span>
            <button
              onClick={() => setIsLassoKeepMode(prev => !prev)}
              className="text-[10px] flex items-center gap-1 px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-indigo-400 font-semibold cursor-pointer"
            >
              {isLassoKeepMode ? 'Keep Inside Lasso' : 'Erase Inside Lasso'}
            </button>
          </div>
        )}

        {/* 3. Solid Background Customization */}
        <div>
          <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block mb-2">Passport Background Color</span>
          <div className="flex items-center gap-2">
            <div className="flex flex-1 gap-1.5">
              {BG_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() => setBgColor(preset.value)}
                  className={`relative w-8 h-8 rounded-full border transition cursor-pointer ${
                    bgColor === preset.value
                      ? 'ring-2 ring-indigo-500 border-white scale-105 z-10'
                      : 'border-slate-800 hover:scale-102'
                  }`}
                  style={{
                    backgroundColor: preset.value === 'transparent' ? '#1e293b' : preset.value,
                    backgroundImage: preset.value === 'transparent' 
                      ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)' 
                      : 'none',
                    backgroundSize: '8px 8px',
                    backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0'
                  }}
                  title={preset.label}
                />
              ))}
            </div>

            {/* Custom Color input */}
            <div className="flex items-center gap-1 bg-slate-850 p-1 rounded-full border border-slate-800 shrink-0">
              <input
                type="color"
                value={bgColor === 'transparent' ? '#ffffff' : bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="w-6 h-6 rounded-full border border-slate-700 bg-transparent cursor-pointer overflow-hidden p-0"
              />
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex gap-2.5 pt-1.5">
          <button
            onClick={onBack}
            className="flex-1 py-2.5 bg-slate-850 border border-slate-800 hover:bg-slate-800 text-slate-300 font-semibold rounded-xl text-xs transition cursor-pointer"
          >
            ← Back
          </button>
          <button
            onClick={handleProceed}
            className="flex-1.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-600/25 transition flex items-center justify-center gap-1 cursor-pointer"
          >
            Crop Layout →
          </button>
        </div>
      </div>
    </div>
  );
}
