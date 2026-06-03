import React from 'react';
import { useLiquidState } from './LiquidStateContext';

export const DynamicFilter: React.FC = () => {
  const { specularOpacity, specularSaturation, refractionLevel, blurLevel } = useLiquidState();

  return (
    <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }} aria-hidden="true">
      <defs>
        <filter id="dynamic-liquid-glass" colorInterpolationFilters="sRGB">
          {/* procedural noise map */}
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="42" result="noise" />
          
          {/* Dynamic refraction scale */}
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={30 * refractionLevel} xChannelSelector="R" yChannelSelector="G" result="displaced" />
          
          {/* Dynamic blur */}
          <feGaussianBlur in="displaced" stdDeviation={6 * blurLevel} result="blurred" />
          
          {/* Dynamic saturation */}
          <feColorMatrix in="blurred" type="saturate" values={specularSaturation.toString()} result="saturated" />
          
          {/* Surface highlights */}
          <feSpecularLighting in="noise" surfaceScale="8" specularConstant="1.2" specularExponent="30" lightingColor="#ffffff" result="specular">
            <fePointLight x="150" y="-100" z="200" />
          </feSpecularLighting>
          
          {/* Dynamic specular opacity */}
          <feComponentTransfer in="specular" result="specular_faded">
            <feFuncA type="linear" slope={specularOpacity} />
          </feComponentTransfer>

          {/* Merge */}
          <feComposite in="specular_faded" in2="saturated" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
        </filter>
      </defs>
    </svg>
  );
};
