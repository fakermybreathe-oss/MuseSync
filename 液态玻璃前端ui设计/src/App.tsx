import React, { useState } from 'react';
import { LiquidStateProvider } from './components/LiquidStateContext';
import { MusicPlayer } from './views/MusicPlayer';
import { SwitchPrototype } from './views/SwitchPrototype';
import { SearchboxPrototype } from './views/SearchboxPrototype';
import { MagnifyingGlass } from './views/MagnifyingGlass';
import { FluidSlider } from './views/FluidSlider';
import { DynamicDock } from './views/DynamicDock';
// ── 新增：11 个移植组件 ──────────────────────────────────────────
import { LiquidCursor } from './views/LiquidCursor';
import { TactileButton } from './views/TactileButton';
import { SegmentedTabs } from './views/SegmentedTabs';
import { RotaryDial } from './views/RotaryDial';
import { FocusInput } from './views/FocusInput';
import { VolumeKnob } from './views/VolumeKnob';
import { FloatingActionMenu } from './views/FloatingActionMenu';
import { NumberStepper } from './views/NumberStepper';
import { LiquidCheckbox } from './views/LiquidCheckbox';
import { FluidProgress } from './views/FluidProgress';
import { GlassTooltip } from './views/GlassTooltip';

const TABS = [
  { id: 'lens',     label: 'Magnifying Glass',    component: MagnifyingGlass },
  { id: 'slider',   label: 'Fluid Slider',         component: FluidSlider },
  { id: 'switch',   label: 'Switch',               component: SwitchPrototype },
  { id: 'searchbox',label: 'Searchbox',            component: SearchboxPrototype },
  { id: 'music',    label: 'Music Player',         component: MusicPlayer },
  { id: 'dock',     label: 'Dynamic Dock',         component: DynamicDock },
  { id: 'cursor',   label: 'Liquid Cursor',        component: LiquidCursor },
  { id: 'button',   label: 'Tactile Button',       component: TactileButton },
  { id: 'tabs',     label: 'Segmented Tabs',       component: SegmentedTabs },
  { id: 'dial',     label: 'Rotary Dial',          component: RotaryDial },
  { id: 'input',    label: 'Focus Input',          component: FocusInput },
  { id: 'vol',      label: 'Volume',               component: VolumeKnob },
  { id: 'fab',      label: 'Floating Action Menu', component: FloatingActionMenu },
  { id: 'stepper',  label: 'Number Stepper',       component: NumberStepper },
  { id: 'checkbox', label: 'Liquid Checkbox',      component: LiquidCheckbox },
  { id: 'progress', label: 'Fluid Progress Bar',   component: FluidProgress },
  { id: 'tooltip',  label: 'Glass Tooltip',        component: GlassTooltip },
];

function App() {
  const [activeTab, setActiveTab] = useState('slider');

  const ActiveComponent = TABS.find(t => t.id === activeTab)?.component;

  return (
    <LiquidStateProvider>
      <div className="hex-bg" />
      
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1rem 1rem' }}>
        <nav style={{ 
          display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center',
          background: 'rgba(255,255,255,0.6)', padding: '1rem', borderRadius: '16px',
          backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.4)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
        }}>
          {TABS.map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 16px', borderRadius: '100px',
                border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                background: activeTab === tab.id ? '#111' : 'transparent',
                color: activeTab === tab.id ? '#fff' : '#555',
                transition: 'all 0.2s ease',
                opacity: tab.component ? 1 : 0.4
              }}
              title={!tab.component ? "Coming Soon" : ""}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <main style={{ paddingBottom: '4rem', paddingTop: '2rem' }}>
        {ActiveComponent ? <ActiveComponent /> : (
          <div style={{ textAlign: 'center', marginTop: '4rem', color: '#888', fontWeight: 600, fontSize: '1.2rem' }}>
            🚧 Component in progress...
          </div>
        )}
      </main>
    </LiquidStateProvider>
  );
}

export default App;
