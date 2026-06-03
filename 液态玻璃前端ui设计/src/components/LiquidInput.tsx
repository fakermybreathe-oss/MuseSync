import React, { useState } from 'react';

export const LiquidInput: React.FC<{ placeholder?: string }> = ({ placeholder }) => {
  const [focused, setFocused] = useState(false);
  
  return (
    <div 
      className="liquid-glass-sm"
      style={{
        borderRadius: '16px',
        padding: '2px', // Space for focus ring
        transition: 'box-shadow 0.3s ease',
        boxShadow: focused ? '0 0 0 2px rgba(255,255,255,0.6), 0 12px 24px -6px rgba(0,0,0,0.5)' : undefined
      }}
    >
      <input 
        type="text"
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%',
          padding: '14px 20px',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: '#fff',
          fontSize: '1rem',
          fontFamily: 'inherit'
        }}
      />
    </div>
  );
};
