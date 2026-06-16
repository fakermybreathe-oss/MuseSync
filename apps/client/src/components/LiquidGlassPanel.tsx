import React, { forwardRef } from 'react';
import { OpticalGlassSurface } from './OpticalGlassSurface';

type LiquidGlassPanelProps = React.HTMLAttributes<HTMLElement> & {
  id: string;
  width?: number;
  height?: number;
  radius?: number;
  surfaceType?: string;
  interactive?: boolean;
};

type LiquidGlassStyle = React.CSSProperties & {
  '--liquid-panel-width': string;
  '--liquid-panel-min-height': string;
  '--liquid-panel-radius': string;
};

export const LiquidGlassPanel = forwardRef<HTMLElement, LiquidGlassPanelProps>(({
  id,
  width = 460,
  height = 520,
  radius = 28,
  surfaceType = 'auth-panel',
  className = '',
  children,
  style,
  interactive = true,
  ...sectionProps
}, ref) => {
  const panelStyle: LiquidGlassStyle = {
    '--liquid-panel-width': `${width}px`,
    '--liquid-panel-min-height': `${height}px`,
    '--liquid-panel-radius': `${radius}px`,
    ...style
  };

  return (
    <OpticalGlassSurface
      {...sectionProps}
      ref={ref}
      as="section"
      id={id}
      radius={radius}
      edgeDepth={22}
      fallbackWidth={width}
      fallbackHeight={height}
      surfaceType={surfaceType}
      interactive={interactive}
      className={`liquid-glass-panel ${className}`.trim()}
      style={panelStyle}
    >
      <div className="liquid-glass-panel__content">
        {children}
      </div>
    </OpticalGlassSurface>
  );
});

LiquidGlassPanel.displayName = 'LiquidGlassPanel';
