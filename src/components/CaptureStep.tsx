import React, { useState, useRef, useEffect } from 'react';
import { Camera, Image as ImageIcon, Sparkles, RefreshCw, AlertCircle, MessageCircle } from 'lucide-react';
import { motion } from 'motion/react';

function WhatsAppIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.012 2c-5.506 0-9.989 4.478-9.989 9.984 0 1.762.459 3.481 1.332 4.992l-1.355 4.954 5.085-1.331c1.46.797 3.109 1.218 4.787 1.218 5.513 0 9.998-4.48 9.998-9.986s-4.485-9.982-9.998-9.982zm0 18.232c-1.503 0-2.981-.403-4.278-1.168l-.307-.182-3.178.832.848-3.097-.2-.317c-.843-1.339-1.288-2.894-1.288-4.487 0-4.551 3.704-8.256 8.257-8.256 4.551 0 8.256 3.705 8.256 8.256 0 4.552-3.705 8.257-8.256 8.257zm4.527-6.183c-.248-.124-1.467-.724-1.695-.807-.228-.083-.394-.124-.56.124-.166.248-.642.807-.787.973-.145.166-.29.186-.538.062-.248-.124-1.048-.386-1.996-1.231-.738-.658-1.236-1.471-1.381-1.719-.145-.248-.015-.382.109-.505.111-.11.248-.29.372-.435.124-.145.166-.248.248-.414.083-.166.041-.311-.021-.435-.062-.124-.56-1.348-.767-1.846-.201-.484-.405-.418-.56-.426-.145-.008-.311-.008-.476-.008-.166 0-.435.062-.663.311-.228.248-.87.85-.87 2.073 0 1.223.89 2.404 1.014 2.57.124.166 1.752 2.675 4.244 3.752.593.256 1.056.409 1.417.524.596.19 1.138.163 1.567.099.479-.072 1.467-.6 1.674-1.18.207-.58.207-1.077.145-1.18-.062-.103-.228-.186-.476-.31z" />
    </svg>
  );
}

interface CaptureStepProps {
  onImageCaptured: (imageSrc: string) => void;
}

export default function CaptureStep({ onImageCaptured }: CaptureStepProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isMirrored, setIsMirrored] = useState(true);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stop camera stream when component unmounts
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  // Start video stream
  const startCamera = async (currentFacingMode: 'user' | 'environment' = facingMode) => {
    setCameraError(null);
    setIsCameraActive(true);
    
    // Stop any existing stream first
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: 640 }, 
          height: { ideal: 480 }, 
          facingMode: currentFacingMode 
        },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((e) => console.log('Video play error:', e));
        };
      }
    } catch (err: any) {
      console.error('Error opening camera:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || String(err).includes('Permission denied')) {
        setCameraError('Camera permission denied. If you are viewing this app inside the AI Studio sandboxed preview frame, camera access is blocked by browser iframe security. Please open the app in a new tab to grant camera access, or upload an image directly.');
      } else {
        setCameraError(`Could not access camera (${err.message || err}). Please try opening in a new tab, allow permissions, or upload an image instead.`);
      }
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  };

  const toggleFacingMode = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    // Mirror front camera (user) by default, and disable for rear camera (environment)
    setIsMirrored(nextMode === 'user');
    startCamera(nextMode);
  };

  // Capture from camera
  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Draw the current video frame (mirror it on-the-fly if active)
        if (isMirrored) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        stopCamera();
        onImageCaptured(dataUrl);
      }
    }
  };

  // Handle gallery file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onImageCaptured(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            onImageCaptured(event.target.result as string);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Load sample high-contrast image of a person for rapid testing
  const loadSampleImage = () => {
    // We can draw a high-quality human face avatar/silhouette or load a gorgeous portrait
    // Let's create an elegant, high-contrast dynamic portrait silhouette with a colorful background on a canvas,
    // so it doesn't fail due to external image blocking or CORS, and works instantly offline!
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // 1. Draw solid wall background
      const grad = ctx.createLinearGradient(0, 0, 600, 600);
      grad.addColorStop(0, '#3b82f6'); // blue
      grad.addColorStop(1, '#1d4ed8'); // dark blue
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 600, 600);

      // 2. Draw a realistic portrait outline of a person (head and shoulders)
      ctx.fillStyle = '#fef08a'; // Light yellow-skinned person face
      
      // Shoulders/Chest
      ctx.beginPath();
      ctx.ellipse(300, 520, 180, 110, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#1e293b'; // Slate suit
      ctx.fill();

      // Shirt collar
      ctx.beginPath();
      ctx.moveTo(270, 430);
      ctx.lineTo(300, 480);
      ctx.lineTo(330, 430);
      ctx.fillStyle = '#ffffff'; // White shirt
      ctx.fill();

      // Tie
      ctx.beginPath();
      ctx.moveTo(295, 470);
      ctx.lineTo(305, 470);
      ctx.lineTo(310, 550);
      ctx.lineTo(300, 560);
      ctx.lineTo(290, 550);
      ctx.fillStyle = '#ef4444'; // Red tie
      ctx.fill();

      // Neck
      ctx.beginPath();
      ctx.ellipse(300, 400, 40, 60, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ffedd5'; // Skin color neck
      ctx.fill();

      // Face
      ctx.beginPath();
      ctx.ellipse(300, 290, 95, 120, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#fed7aa'; // Skin color face
      ctx.fill();

      // Hair (dark brown)
      ctx.beginPath();
      ctx.arc(300, 210, 100, Math.PI, 0); // Top hair
      ctx.ellipse(300, 220, 100, 70, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#1e1b4b'; // Dark blue/indigo hair
      ctx.fill();

      // Hair sideburns
      ctx.beginPath();
      ctx.ellipse(210, 280, 20, 40, 0, 0, Math.PI * 2);
      ctx.ellipse(390, 280, 20, 40, 0, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.arc(260, 280, 8, 0, Math.PI * 2);
      ctx.arc(340, 280, 8, 0, Math.PI * 2);
      ctx.fill();

      // Smile
      ctx.strokeStyle = '#ea580c';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(300, 335, 25, 0, Math.PI);
      ctx.stroke();

      // Nose
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(300, 290);
      ctx.lineTo(300, 315);
      ctx.lineTo(295, 315);
      ctx.stroke();

      const dataUrl = canvas.toDataURL('image/png');
      onImageCaptured(dataUrl);
    }
  };

  return (
    <div className="flex flex-col flex-1 p-5 select-none justify-between">
      {/* Step Header */}
      <div className="text-center mb-3 relative">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold tracking-widest text-indigo-400 uppercase">Step 1 of 4</span>
          
          {/* WhatsApp Direct Contact Badge */}
          <a
            href="https://wa.me/918420882476?text=Hello%2C%20I%20need%20help%20with%20Passport%20Photo%20Maker"
            target="_blank"
            rel="noopener noreferrer"
            title="Chat on WhatsApp: 8420882476"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition text-[11px] font-bold no-underline cursor-pointer shadow-sm hover:scale-105 active:scale-95"
          >
            <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-400" />
            <span>WhatsApp: 8420882476</span>
          </a>
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">Get Portrait Photo</h2>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Capture with your camera or select from your gallery. Standard lighting works best!
        </p>
      </div>

      {/* Main Action Stage */}
      <div className="flex-1 flex flex-col justify-center my-2">
        {isCameraActive ? (
          /* Live Camera UI */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative rounded-2xl overflow-hidden bg-black aspect-[3/4] border-2 border-indigo-500/50 shadow-2xl flex flex-col justify-between"
          >
            {/* Live Camera Viewport */}
            <div className="absolute inset-0 z-0 overflow-hidden flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover transition-transform ${isMirrored ? 'scale-x-[-1]' : 'scale-x-[1]'}`}
              />
              
              {/* Overlay Face Guide Line */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center border-4 border-indigo-500/20 m-6 rounded-xl">
                {/* Oval guide */}
                <div className="w-[60%] h-[55%] border-2 border-dashed border-indigo-450 rounded-[50%] flex items-center justify-center relative">
                  <div className="absolute top-[25%] w-full h-[1px] bg-indigo-400/40"></div>
                  <div className="absolute top-[50%] w-full h-[1px] bg-indigo-400/40"></div>
                  <div className="absolute left-[50%] h-full w-[1px] bg-indigo-400/40"></div>
                  <span className="absolute -top-6 text-[10px] text-indigo-400 font-semibold uppercase bg-slate-950/80 px-2 py-0.5 rounded-full">
                    Align Face Here
                  </span>
                </div>
              </div>
            </div>

            {/* Top Bar of camera */}
            <div className="z-10 bg-slate-950/80 backdrop-blur-sm p-2 px-3 flex justify-between items-center border-b border-white/5">
              <span className="text-xs font-medium text-indigo-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> Live
              </span>
              
              <div className="flex items-center gap-1.5">
                {/* Mirror Toggle Button */}
                <button
                  type="button"
                  onClick={() => setIsMirrored(prev => !prev)}
                  title="Toggle Mirroring / Horizontal Flip"
                  className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-indigo-500/40 text-slate-300 hover:text-white hover:bg-slate-850 transition cursor-pointer flex items-center justify-center text-[10px] font-bold gap-1 shadow-sm"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isMirrored ? 'bg-indigo-400 animate-pulse' : 'bg-slate-600'}`}></span>
                  Mirror
                </button>

                {/* Flip Camera (Front/Back) Button */}
                <button
                  type="button"
                  onClick={toggleFacingMode}
                  title="Flip Camera (Front/Rear)"
                  className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 hover:border-indigo-500/40 text-slate-300 hover:text-white hover:bg-slate-850 transition cursor-pointer flex items-center justify-center text-[10px] font-bold gap-1 shadow-sm"
                >
                  <RefreshCw size={10} className="text-indigo-400" />
                  Flip Cam
                </button>

                <button
                  type="button"
                  onClick={stopCamera}
                  className="text-[10px] bg-red-500/10 border border-red-500/25 text-red-400 px-2 py-1 rounded-lg hover:bg-red-500/20 transition cursor-pointer font-bold"
                >
                  Cancel
                </button>
              </div>
            </div>

            {/* Bottom Shutter Action bar */}
            <div className="z-10 bg-slate-950/80 backdrop-blur-sm p-4 flex justify-center items-center border-t border-white/5">
              <button
                onClick={capturePhoto}
                className="w-16 h-16 rounded-full bg-white border-[6px] border-indigo-500/30 flex items-center justify-center active:scale-90 transition-transform shadow-lg cursor-pointer"
              >
                <div className="w-11 h-11 rounded-full bg-indigo-600 hover:bg-indigo-500 transition"></div>
              </button>
            </div>
          </motion.div>
        ) : (
          /* Landing options */
          <div className="space-y-4">
            {cameraError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-xl text-xs flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
                  <span className="leading-relaxed">{cameraError}</span>
                </div>
                {cameraError.includes('new tab') && (
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition shadow-md active:scale-95 cursor-pointer select-none no-underline"
                  >
                    <Sparkles size={12} />
                    Open App in New Tab
                  </a>
                )}
              </div>
            )}

            {/* Drag and Drop Zone */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all h-60 ${
                dragActive
                  ? 'border-indigo-500 bg-indigo-500/5'
                  : 'border-slate-800 bg-slate-900/40 hover:bg-slate-900/70 hover:border-slate-700'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3 shadow-lg">
                <ImageIcon size={22} />
              </div>
              <h3 className="text-sm font-semibold text-slate-200">Upload Portrait Photo</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-[220px]">
                Drag & drop or tap to select from device gallery
              </p>
            </div>

            {/* Camera Quick Action Card */}
            <button
              onClick={startCamera}
              className="w-full bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-750 p-4 rounded-2xl text-left flex items-center justify-between transition-all group active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
                  <Camera size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">
                    Take Photo with Camera
                  </h3>
                  <p className="text-xs text-slate-500">Use live front or rear camera stream</p>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-slate-700 group-hover:text-white transition">
                →
              </div>
            </button>

            {/* Sample Image Action Card (for testing) */}
            <button
              onClick={loadSampleImage}
              className="w-full bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-750 p-4 rounded-2xl text-left flex items-center justify-between transition-all group active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-400 group-hover:scale-105 transition-transform">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">
                    Try with Demo Portrait
                  </h3>
                  <p className="text-xs text-slate-500">Perfect silhouette for rapid lasso testing</p>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-slate-700 group-hover:text-white transition">
                ✨
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Safety Guideline Box & WhatsApp Contact Footer */}
      <div className="mt-3 space-y-2">
        <a
          href="https://wa.me/918420882476?text=Hi%2C%20I%20am%20using%20Passport%20Photo%20Maker%20and%20need%20assistance"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/20 p-2.5 rounded-xl flex items-center justify-between text-emerald-400 transition no-underline cursor-pointer group"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
              <WhatsAppIcon className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="text-xs font-bold text-emerald-300">WhatsApp Support / Contact</div>
              <div className="text-[10px] text-emerald-400/80 font-mono">+91 8420882476</div>
            </div>
          </div>
          <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/30">
            Chat Now →
          </span>
        </a>

        <div className="p-2.5 bg-slate-900/60 border border-slate-850 rounded-xl text-[11px] text-slate-500 flex items-center gap-2">
          <Sparkles size={14} className="text-indigo-400 shrink-0" />
          <span>For passport size, try to stand against a plain wall with natural frontal lighting.</span>
        </div>
      </div>
    </div>
  );
}
