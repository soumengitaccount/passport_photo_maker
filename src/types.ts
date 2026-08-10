export type AppStep = 'CAPTURE' | 'BACKGROUND' | 'CROP' | 'PRINT';

export type CropType = 'INDIAN_PASSPORT' | 'INDIAN_STAMP';

export interface CropPreset {
  id: CropType;
  name: string;
  widthMm: number;
  heightMm: number;
  aspectRatio: number; // width / height
  description: string;
}

export const CROP_PRESETS: Record<CropType, CropPreset> = {
  INDIAN_PASSPORT: {
    id: 'INDIAN_PASSPORT',
    name: 'Indian Passport',
    widthMm: 35,
    heightMm: 45,
    aspectRatio: 35 / 45,
    description: '35 x 45 mm standard size with white/light background',
  },
  INDIAN_STAMP: {
    id: 'INDIAN_STAMP',
    name: 'Stamp Size',
    widthMm: 20,
    heightMm: 25,
    aspectRatio: 0.8, // 20:25, 2x2.5 cm
    description: '20 x 25 mm used for general applications/registers',
  },
};

export interface Point {
  x: number;
  y: number;
}

export type EditMode = 'MAGNETIC_LASSO' | 'FREEHAND_LASSO' | 'MAGIC_WAND' | 'BRUSH_ERASE' | 'BRUSH_RESTORE' | 'PAN';

export interface BackgroundState {
  imageSrc: string | null;
  history: string[]; // Store dataURLs for undo/redo
  historyIndex: number;
  zoom: number;
  panX: number;
  panY: number;
  bgColor: string; // solid color
  eraserSize: number;
  tolerance: number; // for magic wand
  isMagnetic: boolean;
}

export interface CroppedResult {
  passportSrc: string | null;
  stampSrc: string | null;
}

export interface PrintQueueItem {
  id: string;
  passportSrc: string;
  stampSrc: string;
  passportCount: number;
  stampCount: number;
  name: string;
  timestamp: number;
  passportWidthMm?: number;
  passportHeightMm?: number;
  stampWidthMm?: number;
  stampHeightMm?: number;
  countryName?: string;
}
