import React from 'react';

export const LiquidBadge: React.FC<{ text: string }> = ({ text }) => {
  return (
    <span 
      className="liquid-glass-sm"
      style={{
        padding: '6px 16px',
        borderRadius: '20px',
        fontSize: '0.875rem',
        fontWeight: 600,
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        display: 'inline-block'
      }}
    >
      {text}
    </span>
  );
};
