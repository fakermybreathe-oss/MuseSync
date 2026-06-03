import React from 'react';

export const LiquidGlassFilter: React.FC = () => {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }} aria-hidden="true">
      <defs>
        {/* 
          Main Liquid Glass Filter 
          Perfect for Cards and large areas.
          We use feTurbulence + feSpecularLighting to dynamically generate the displacement and specular maps,
          achieving extremely high fidelity without external images.
        */}
        <filter id="liquid-glass" colorInterpolationFilters="sRGB">
          {/* 1. Procedural Noise for Displacement */}
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="12" result="noise" />
          
          {/* 2. Refract the backdrop based on noise */}
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="35" xChannelSelector="R" yChannelSelector="G" result="displaced" />
          
          {/* 3. Frost the refracted image slightly */}
          <feGaussianBlur in="displaced" stdDeviation="6" result="blurred" />
          
          {/* 4. Super-saturate to mimic thick glass light gathering */}
          <feColorMatrix in="blurred" type="saturate" values="2.5" result="saturated" />
          
          {/* 5. Generate 3D Specular Highlight from the noise surface */}
          <feSpecularLighting in="noise" surfaceScale="10" specularConstant="1.2" specularExponent="40" lightingColor="#ffffff" result="specular">
            <fePointLight x="200" y="-100" z="300" />
          </feSpecularLighting>
          
          {/* 6. Add highlights on top of the refracted saturated background */}
          <feComposite in="specular" in2="saturated" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
        </filter>

        {/* 
          Small Liquid Glass Filter
          Tighter noise frequency and less blur for small elements like buttons and badges.
        */}
        <filter id="liquid-glass-sm" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="1" seed="42" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="15" xChannelSelector="R" yChannelSelector="G" result="displaced" />
          <feGaussianBlur in="displaced" stdDeviation="3" result="blurred" />
          <feColorMatrix in="blurred" type="saturate" values="1.8" result="saturated" />
          
          <feSpecularLighting in="noise" surfaceScale="5" specularConstant="1" specularExponent="30" lightingColor="#ffffff" result="specular">
            <fePointLight x="100" y="-50" z="200" />
          </feSpecularLighting>
          
          <feComposite in="specular" in2="saturated" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
        </filter>
      </defs>
    </svg>
  );
};
