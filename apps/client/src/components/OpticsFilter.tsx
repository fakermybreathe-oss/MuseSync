import React from 'react';
import { useLiquidState, useOpticsMap } from './LiquidStateContext';

interface OpticsFilterProps {
  id: string;
  width: number;
  height: number;
  radius: number;
  surfaceType?: string;
}

export const OpticsFilter: React.FC<OpticsFilterProps> = ({ id, width, height, radius, surfaceType }) => {
  const { specularOpacity, specularSaturation, blurLevel, refractionLevel } = useLiquidState();
  const { displacementUrl, specularUrl, maximumDisplacement } = useOpticsMap(width, height, radius, surfaceType);

  if (!displacementUrl) return null;

  return (
    <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }} aria-hidden="true">
      <defs>
        <filter
          id={id}
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          filterUnits="objectBoundingBox"
          primitiveUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          {blurLevel > 0 && (
            <feGaussianBlur id={`${id}-blur`} in="SourceGraphic" stdDeviation={blurLevel} result="optical_source" />
          )}
          
          <feImage id={`${id}-displacementImg`} href={displacementUrl} x="0" y="0" width={width} height={height} result="displacement_map" preserveAspectRatio="none" />
          
          <feDisplacementMap 
            id={`${id}-displacementMap`}
            in={blurLevel > 0 ? "optical_source" : "SourceGraphic"} in2="displacement_map"
            scale={maximumDisplacement * refractionLevel}
            data-base-scale={maximumDisplacement}
            xChannelSelector="R" yChannelSelector="G" 
            result="displaced"
          />
          
          <feColorMatrix in="displaced" type="saturate" values={specularSaturation.toString()} result="displaced_saturated" />
          
          <feImage id={`${id}-specularImg`} href={specularUrl} x="0" y="0" width={width} height={height} result="specular_layer" preserveAspectRatio="none" />
          
          <feComponentTransfer in="specular_layer" result="specular_faded">
            <feFuncA type="linear" slope={specularOpacity} />
          </feComponentTransfer>
          
          <feBlend in="specular_faded" in2="displaced_saturated" mode="screen" />
        </filter>
      </defs>
    </svg>
  );
};
