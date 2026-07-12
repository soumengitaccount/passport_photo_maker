import React from 'react';

interface AndroidFrameProps {
  children: React.ReactNode;
  activeStep: string;
  onReset?: () => void;
}

export default function AndroidFrame({ children, activeStep, onReset }: AndroidFrameProps) {
  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 font-sans flex flex-col antialiased selection:bg-indigo-500/30 selection:text-white">
      {/* Main Responsive Web Workspace Wrapper */}
      <main className="flex-1 flex flex-col justify-start py-4 sm:py-6 px-4 max-w-5xl mx-auto w-full">
        <div className="w-full bg-[#0b101b] border border-slate-900 rounded-3xl shadow-2xl shadow-black/40 overflow-hidden flex flex-col min-h-[75vh] md:min-h-[82vh] transition-all">
          <div className="flex-1 flex flex-col relative overflow-hidden">
            {children}
          </div>
        </div>
      </main>

      {/* Decorative ambient lighting/glow elements */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -z-10"></div>
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl pointer-events-none -z-10"></div>
    </div>
  );
}


