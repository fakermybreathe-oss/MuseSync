import React from 'react';

export const LiquidButton: React.FC<{ children: React.ReactNode, onClick?: () => void }> = ({ children, onClick }) => {
  return (
    <button 
      className="liquid-glass-sm"
      onClick={onClick}
      style={{
        padding: '12px 32px',
        borderRadius: '24px',
        fontSize: '1rem',
        fontWeight: 600,
        color: '#fff',
        cursor: 'pointer',
        outline: 'none',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.2s cubic-bezier(0.25, 1, 0.5, 1), filter 0.2s',
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = 'scale(0.95)';
        e.currentTarget.style.filter = 'brightness(0.9)';
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)';
        e.currentTarget.style.filter = 'brightness(1.1)';
        setTimeout(() => {
          if(e.currentTarget) {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.filter = 'brightness(1)';
          }
        }, 150);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.filter = 'brightness(1)';
      }}
    >
      <div style={{ position: 'relative', zIndex: 2 }}>{children}</div>
    </button>
  );
};
