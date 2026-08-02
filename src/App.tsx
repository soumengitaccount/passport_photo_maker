import React, { useState } from 'react';
import { AppStep, PrintQueueItem } from './types';
import AndroidFrame from './components/AndroidFrame';
import CaptureStep from './components/CaptureStep';
import BackgroundStep from './components/BackgroundStep';
import CropStep from './components/CropStep';
import PrintStep from './components/PrintStep';
import { AnimatePresence, motion } from 'motion/react';
import { Analytics } from '@vercel/analytics/react';

export default function App() {
  const [step, setStep] = useState<AppStep>('CAPTURE');
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [printQueue, setPrintQueue] = useState<PrintQueueItem[]>([]);

  // Transition handlers
  const handleImageCaptured = (imageSrc: string) => {
    setRawImage(imageSrc);
    setStep('BACKGROUND');
  };

  const handleBackgroundProcessed = (finalImageSrc: string) => {
    setProcessedImage(finalImageSrc);
    setStep('CROP');
  };

  const handleCropCompleted = (passportSrc: string, stampSrc: string) => {
    const newItem: PrintQueueItem = {
      id: `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      passportSrc,
      stampSrc,
      passportCount: 8,
      stampCount: 12,
      name: `Photo #${printQueue.length + 1}`,
      timestamp: Date.now(),
    };
    setPrintQueue((prev) => [...prev, newItem]);
    setStep('PRINT');
  };

  const handleAddAnotherPhoto = () => {
    setRawImage(null);
    setProcessedImage(null);
    setStep('CAPTURE');
  };

  const handleReset = () => {
    setRawImage(null);
    setProcessedImage(null);
    setPrintQueue([]);
    setStep('CAPTURE');
  };

  const renderActiveStep = () => {
    switch (step) {
      case 'CAPTURE':
        return (
          <motion.div
            key="capture"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col"
          >
            <CaptureStep onImageCaptured={handleImageCaptured} />
          </motion.div>
        );
      case 'BACKGROUND':
        return (
          <motion.div
            key="background"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col"
          >
            <BackgroundStep
              imageSrc={rawImage!}
              onBackgroundProcessed={handleBackgroundProcessed}
              onBack={() => setStep('CAPTURE')}
            />
          </motion.div>
        );
      case 'CROP':
        return (
          <motion.div
            key="crop"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col"
          >
            <CropStep
              imageSrc={processedImage!}
              onCropCompleted={handleCropCompleted}
              onBack={() => setStep('BACKGROUND')}
            />
          </motion.div>
        );
      case 'PRINT':
        return (
          <motion.div
            key="print"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col"
          >
            <PrintStep
              queue={printQueue}
              onUpdateQueue={setPrintQueue}
              onAddAnotherPhoto={handleAddAnotherPhoto}
              onBack={() => setStep('CROP')}
              onReset={handleReset}
            />
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <AndroidFrame activeStep={step} onReset={step !== 'CAPTURE' ? handleReset : undefined}>
        <AnimatePresence mode="wait">
          {renderActiveStep()}
        </AnimatePresence>
      </AndroidFrame>
      <Analytics />
    </>
  );
}

