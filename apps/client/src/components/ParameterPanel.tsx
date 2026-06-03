import React from 'react';
import { useLiquidState } from './LiquidStateContext';

// 参数面板 — 复刻原版 liquid-glass-demo 的极简滑块控件设计
// 细线轨道 + 渐变圆点滑块 + monospace 数值显示
const SLIDER_STYLE_ID = 'parameter-panel-slider-styles';

// 注入全局滑块样式（只执行一次）
function ensureSliderStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(SLIDER_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SLIDER_STYLE_ID;
  style.textContent = `
    .lg-slider {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 2px;
      background: rgba(128, 128, 128, 0.2);
      border-radius: 1px;
      outline: none;
      cursor: pointer;
    }
    .lg-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      cursor: pointer;
      transition: transform 0.15s ease;
      box-shadow: 0 1px 4px rgba(0,0,0,0.25);
      border: none;
    }
    .lg-slider::-webkit-slider-thumb:hover {
      transform: scale(1.3);
    }
    .lg-slider::-webkit-slider-thumb:active {
      transform: scale(1.1);
    }
    .lg-slider::-moz-range-thumb {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      cursor: pointer;
      border: none;
      box-shadow: 0 1px 4px rgba(0,0,0,0.25);
    }
    .lg-slider::-moz-range-track {
      height: 2px;
      background: rgba(128,128,128,0.2);
      border: none;
      border-radius: 1px;
    }
  `;
  document.head.appendChild(style);
}

// 单个滑块行组件
const SliderRow: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}> = ({ label, value, min, max, step, onChange, format }) => {
  const displayValue = format ? format(value) : value.toFixed(2);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      marginBottom: '1rem',
    }}>
      <div style={{
        width: '160px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        fontSize: '11px',
        opacity: 0.8,
        flexShrink: 0,
        fontWeight: 500,
        color: '#4a5568',
      }}>
        {label}
      </div>
      <div style={{
        width: '50px',
        textAlign: 'right',
        fontFamily: '"SF Mono", Monaco, "Cascadia Code", monospace',
        fontSize: '11px',
        opacity: 0.6,
        fontVariantNumeric: 'tabular-nums',
        flexShrink: 0,
        color: '#4a5568',
      }}>
        {displayValue}
      </div>
      <div style={{ flex: 1 }}>
        <input
          className="lg-slider"
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        />
      </div>
    </div>
  );
};

// Surface Type 按钮组件
const SurfaceBtn: React.FC<{
  type: string;
  label: string;
  currentType: string;
  onSelect: (type: string) => void;
}> = ({ type, label, currentType, onSelect }) => {
  const active = currentType === type;
  return (
    <button
      onClick={() => onSelect(type)}
      style={{
        padding: '0.5rem 1rem',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: 500,
        background: active ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'transparent',
        color: active ? '#fff' : '#4a5568',
        border: active ? '1px solid transparent' : '1px solid rgba(0,0,0,0.1)',
        transition: 'all 0.15s ease',
      }}
    >
      {label}
    </button>
  );
};

export const ParameterPanel: React.FC = () => {
  const state = useLiquidState();

  // 确保滑块全局样式已注入
  React.useEffect(() => {
    ensureSliderStyles();
  }, []);

  return (
    <div style={{
      background: 'rgba(255,255,255,0.9)',
      backdropFilter: 'blur(10px)',
      borderRadius: '12px',
      border: '1px solid rgba(0,0,0,0.1)',
      padding: '1.5rem',
      marginTop: '1.5rem',
      width: '100%',
      maxWidth: '800px',
    }}>
      {/* 标题行 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>
        <span style={{
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          fontSize: '10px',
          opacity: 0.7,
          color: '#667eea',
          fontWeight: 600,
        }}>
          Optics Parameters
        </span>
        <span style={{
          flex: 1,
          height: '1px',
          background: 'rgba(0,0,0,0.1)',
        }} />
      </div>

      {/* Surface Type 选择器 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>
        <div style={{
          width: '160px',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontSize: '11px',
          opacity: 0.8,
          flexShrink: 0,
          fontWeight: 500,
          color: '#4a5568',
        }}>
          Surface Type
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <SurfaceBtn type="convex_squircle" label="Convex Squircle" currentType={state.surfaceType} onSelect={state.setSurfaceType} />
          <SurfaceBtn type="convex_circle" label="Convex Circle" currentType={state.surfaceType} onSelect={state.setSurfaceType} />
          <SurfaceBtn type="concave" label="Concave" currentType={state.surfaceType} onSelect={state.setSurfaceType} />
          <SurfaceBtn type="lip" label="Lip" currentType={state.surfaceType} onSelect={state.setSurfaceType} />
        </div>
      </div>

      {/* 参数滑块 */}
      <SliderRow label="Bezel Width" value={state.bezelWidth} min={5} max={70} step={1} onChange={state.setBezelWidth} format={v => Math.round(v).toString()} />
      <SliderRow label="Glass Thickness" value={state.glassThickness} min={10} max={200} step={1} onChange={state.setGlassThickness} format={v => Math.round(v).toString()} />
      <SliderRow label="Refraction Scale" value={state.refractionLevel} min={0} max={3} step={0.01} onChange={state.setRefractionLevel} />
      <SliderRow label="Specular Opacity" value={state.specularOpacity} min={0} max={1} step={0.01} onChange={state.setSpecularOpacity} />
      <SliderRow label="Saturation" value={state.specularSaturation} min={0} max={10} step={0.1} onChange={state.setSpecularSaturation} />
      <SliderRow label="Blur Level" value={state.blurLevel} min={0} max={10} step={0.1} onChange={state.setBlurLevel} format={v => v.toFixed(1)} />
    </div>
  );
};
