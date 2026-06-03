import React, { useState } from 'react';

export const LiquidSwitch: React.FC = () => {
  const [active, setActive] = useState(false);

  return (
    <div 
      className="liquid-glass-sm"
      onClick={() => setActive(!active)}
      style={{
        width: '64px',
        height: '36px',
        borderRadius: '18px',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.3s',
        background: active ? 'rgba(52, 199, 89, 0.4)' : 'rgba(255, 255, 255, 0.1)',
      }}
    >
      <div 
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          position: 'absolute',
          top: '3px',
          left: active ? '31px' : '3px',
          transition: 'left 0.4s cubic-bezier(0.25, 1, 0.5, 1)'
        }}
      />
    </div>
  );
};
