import React, { createContext, useContext, useState, useMemo } from 'react';
import { SurfaceEquations, calculateDisplacementMap1D, calculateDisplacementMap2D, calculateSpecularHighlight, imageDataToDataURL } from '../utils/optics';

/* eslint-disable react-refresh/only-export-components */

interface LiquidState {
  surfaceType: string;
  bezelWidth: number;
  glassThickness: number;
  refractiveIndex: number;
  specularOpacity: number;
  specularSaturation: number;
  refractionLevel: number;
  blurLevel: number;
  
  setSurfaceType: (v: string) => void;
  setBezelWidth: (v: number) => void;
  setGlassThickness: (v: number) => void;
  setSpecularOpacity: (v: number) => void;
  setSpecularSaturation: (v: number) => void;
  setRefractionLevel: (v: number) => void;
  setBlurLevel: (v: number) => void;
}

const defaultState = {
  surfaceType: 'convex_squircle',
  bezelWidth: 5,
  glassThickness: 74,
  refractiveIndex: 1.5,
  specularOpacity: 0.40,
  specularSaturation: 1.00,
  refractionLevel: 1.50,
  blurLevel: 0.0,
};

const LiquidStateContext = createContext<LiquidState | null>(null);

interface LiquidStateProviderProps {
  children: React.ReactNode;
  initialState?: Partial<typeof defaultState>;
}

export const LiquidStateProvider: React.FC<LiquidStateProviderProps> = ({ children, initialState }) => {
  const finalDefault = useMemo(() => ({ ...defaultState, ...initialState }), [initialState]);
  const [surfaceType, setSurfaceType] = useState(finalDefault.surfaceType);
  const [bezelWidth, setBezelWidth] = useState(finalDefault.bezelWidth);
  const [glassThickness, setGlassThickness] = useState(finalDefault.glassThickness);
  const [specularOpacity, setSpecularOpacity] = useState(finalDefault.specularOpacity);
  const [specularSaturation, setSpecularSaturation] = useState(finalDefault.specularSaturation);
  const [refractionLevel, setRefractionLevel] = useState(finalDefault.refractionLevel);
  const [blurLevel, setBlurLevel] = useState(finalDefault.blurLevel);

  return (
    <LiquidStateContext.Provider value={{
      surfaceType, setSurfaceType,
      bezelWidth, setBezelWidth,
      glassThickness, setGlassThickness,
      refractiveIndex: finalDefault.refractiveIndex,
      specularOpacity, setSpecularOpacity,
      specularSaturation, setSpecularSaturation,
      refractionLevel, setRefractionLevel,
      blurLevel, setBlurLevel,
    }}>
      {children}
    </LiquidStateContext.Provider>
  );
};

export const useLiquidState = () => {
  const ctx = useContext(LiquidStateContext);
  if (!ctx) throw new Error('useLiquidState must be used within LiquidStateProvider');
  return ctx;
};

// Custom hook to run the optics engine per-component
export const useOpticsMap = (width: number, height: number, radius: number, overrideSurfaceType?: string) => {
  const state = useLiquidState();
  
  const maps = useMemo(() => {
    const finalSurfaceType = overrideSurfaceType || state.surfaceType;
    const surfaceFn = SurfaceEquations[finalSurfaceType] || SurfaceEquations.convex_squircle;
    const precomputed = calculateDisplacementMap1D(
      state.glassThickness, state.bezelWidth, surfaceFn, state.refractiveIndex
    );
    const maximumDisplacement = Math.max(...precomputed.map(Math.abs));
    
    const displacementData = calculateDisplacementMap2D(
      width, height, width, height, radius, state.bezelWidth, maximumDisplacement || 1, precomputed
    );
    const specularData = calculateSpecularHighlight(
      width, height, radius, state.bezelWidth
    );
    
    return {
      displacementUrl: imageDataToDataURL(displacementData),
      specularUrl: imageDataToDataURL(specularData),
      maximumDisplacement
    };
  }, [state.surfaceType, state.bezelWidth, state.glassThickness, state.refractiveIndex, width, height, radius, overrideSurfaceType]);
  
  return maps;
};
