import React, { useEffect, useRef } from 'react';

/* ═══════════════════════════════════════════════════════════
 * RainCanvas — 基于 raindrop-fx (WebGL2) 的真实玻璃雨滴特效
 *
 * 使用 GPU 加速的 GLSL 着色器实现：
 *   • 真实光学折射 — 每个水滴都对背景产生扭曲
 *   • 物理碰撞合并 — 水滴相撞会融合成更大的水滴
 *   • 连续水痕拖尾 — 滑动路径留下自然的湿润痕迹
 *   • 雾气凝结层   — 朦胧的玻璃雾面呼吸效果
 *   • 极致性能     — 2000 个水滴仅需 ~6ms/帧
 * ═══════════════════════════════════════════════════════════ */

const RainCanvas: React.FC = React.memo(() => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<any>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let destroyed = false;

    const init = async () => {
      try {
        // 动态导入 raindrop-fx（WebGL2 库）
        const { default: RaindropFX } = await import('raindrop-fx');

        if (destroyed) return;

        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * (window.devicePixelRatio || 1);
        canvas.height = rect.height * (window.devicePixelRatio || 1);

        const fx = new RaindropFX({
          canvas,
          background: '/ocean-bg.png', // 使用项目已有的海洋背景图

          /* ─── 水滴物理模拟参数 ─── */
          spawnInterval: [0.1, 0.4],      // 生成间隔（秒）
          spawnSize: [20, 60],             // 水滴尺寸范围
          spawnLimit: 500,                 // 最大水滴数量
          slipRate: 0.5,                   // 滑落概率
          motionInterval: [0.6, 1.8],      // 运动状态切换间隔
          xShifting: [0, 0.05],            // 横向偏移
          colliderSize: 0.85,              // 碰撞检测范围
          trailDropDensity: 0.15,          // 水痕密度
          trailDropSize: [0.3, 0.45],      // 水痕尺寸
          trailDistance: [25, 35],          // 水痕间距
          trailSpread: 0.5,                // 水痕扩散
          initialSpread: 0.5,              // 初始扩散
          shrinkRate: 0.015,               // 收缩速率
          velocitySpread: 0.3,             // 速度扩散
          evaporate: 18,                   // 蒸发速率
          gravity: 2400,                   // 重力加速度 (px/s²)

          /* ─── 渲染参数 ─── */
          backgroundBlurSteps: 0,          // 完全关闭背景模糊，保持绝对清晰
          backgroundWrapMode: 'mirror' as const,
          mist: false,                     // 完全关闭雾气效果
          mistColor: [0.0, 0.0, 0.0, 0.0] as [number, number, number, number],
          mistTime: 0,
          mistBlurStep: 0,
          dropletsPerSeconds: 0,           // 完全关闭密集的微小水珠，只保留真实滑落的大雨滴
          dropletSize: [0, 0],             // 无微小水珠
          smoothRaindrop: [0.96, 1.0],     // 水滴边缘平滑
          refractBase: 0.3,                // 最小折射量
          refractScale: 0.6,               // 折射缩放
          raindropCompose: 'smoother' as const,
          raindropLightPos: [-1, 1, 2, 0] as [number, number, number, number],
          raindropDiffuseLight: [0.25, 0.25, 0.3] as [number, number, number],
          raindropShadowOffset: 0.7,
          raindropEraserSize: [0.93, 1.0],
          raindropSpecularLight: [0.15, 0.15, 0.2] as [number, number, number],
          raindropSpecularShininess: 64,
          raindropLightBump: 0.5,
        });

        fxRef.current = fx;
        await fx.start();

        // 响应窗口 resize
        const onResize = () => {
          if (!canvas || destroyed) return;
          const r = canvas.getBoundingClientRect();
          canvas.width = r.width * (window.devicePixelRatio || 1);
          canvas.height = r.height * (window.devicePixelRatio || 1);
          fx.resize(r.width, r.height);
        };

        window.addEventListener('resize', onResize);

        // 保存 cleanup 函数
        (canvas as any).__cleanupResize = onResize;
      } catch (err) {
        console.warn('[RainCanvas] raindrop-fx 初始化失败，降级为无特效模式:', err);
      }
    };

    init();

    return () => {
      destroyed = true;
      if (fxRef.current && typeof fxRef.current.stop === 'function') {
        fxRef.current.stop();
      }
      const onResize = (canvas as any)?.__cleanupResize;
      if (onResize) {
        window.removeEventListener('resize', onResize);
      }
      fxRef.current = null;
    };
  }, []);

  return (
    <div 
      className="rain-canvas-wrapper" 
      style={{ 
        position: 'fixed', 
        inset: 0, 
        zIndex: -1, 
        pointerEvents: 'none', 
        opacity: 0.999 // 强制浏览器为 WebGL 创建中间离屏纹理，修复 SVG backdrop-filter 在 WebGL 上失效/不可见的 Chromium 渲染 bug
      }}
    >
      <canvas ref={canvasRef} className="rain-canvas" aria-hidden="true" />
    </div>
  );
});

RainCanvas.displayName = 'RainCanvas';

export { RainCanvas };
