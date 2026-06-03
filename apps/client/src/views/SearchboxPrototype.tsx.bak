import React from 'react';
import { useLiquidState } from '../components/LiquidStateContext';
import { ParameterPanel } from '../components/ParameterPanel';
import { OpticsFilter } from '../components/OpticsFilter';

export const SearchboxPrototype: React.FC = () => {
  const { glassBackgroundOpacity } = useLiquidState();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '800px', margin: '0 auto' }}>
      <OpticsFilter id="search-filter" width={320} height={48} radius={24} />
      <div style={{ alignSelf: 'flex-start', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#111' }}>Searchbox</h1>
      </div>

      <div style={{ 
        width: '100%', height: '400px', 
        background: '#eef2f5', 
        borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
        boxShadow: '0 24px 48px rgba(0,0,0,0.05)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Grid pattern */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: 'linear-gradient(#d1d5db 1px, transparent 1px), linear-gradient(90deg, #d1d5db 1px, transparent 1px)',
          backgroundSize: '40px 40px', opacity: 0.5
        }} />

        <div style={{
          width: '320px', height: '48px', borderRadius: '24px',
          backdropFilter: 'url(#search-filter)',
          WebkitBackdropFilter: 'url(#search-filter)',
          backgroundColor: `rgba(255, 255, 255, ${glassBackgroundOpacity})`, 
          boxShadow: '0 8px 16px rgba(0,0,0,0.08), inset 0 2px 4px rgba(255,255,255,0.4)',
          position: 'relative',
          border: '1px solid rgba(255,255,255,0.4)',
          display: 'flex', alignItems: 'center', padding: '0 20px'
        }}>
           <div style={{ width: '14px', height: '14px', border: '2px solid #777', borderRadius: '50%', position: 'relative' }}>
             <div style={{ width: '2px', height: '6px', background: '#777', position: 'absolute', bottom: '-5px', right: '-3px', transform: 'rotate(-45deg)' }} />
           </div>
           <div style={{ marginLeft: '12px', color: '#777', fontSize: '0.95rem', fontWeight: 500 }}>Search</div>
        </div>
      </div>
      
      <ParameterPanel />
    </div>
  );
};
