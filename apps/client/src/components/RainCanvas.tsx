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
          background: new URL('/ocean-4k.jpg', import.meta.url).href, // 使用高分辨率 4K 海洋背景图

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
          backgroundBlurSteps: 1,          // 极轻微背景模糊，保持清晰
          backgroundWrapMode: 'mirror' as const,
          mist: true,                      // 启用雾气效果（极淡）
          mistColor: [0.01, 0.01, 0.02, 0.15] as [number, number, number, number], // 极低透明度雾气
          mistTime: 12,                    // 雾气渐入很慢（12秒）
          mistBlurStep: 2,                 // 极轻雾气模糊
          dropletsPerSeconds: 200,         // 降低微小水珠密度，保持画面清晰
          dropletSize: [6, 18],            // 微小水珠尺寸稍小
          smoothRaindrop: [0.96, 1.0],     // 水滴边缘平滑
          refractBase: 0.3,                // 最小折射量
          refractScale: 0.6,               // 折射缩放
          refractMaxAngle: 1.5,            // 最大折射角
          refractTime: 0.25,               // 折射时间

          /* ─── 性能参数 ─── */
          minFps: 30                       // 降低帧率要求
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
    <canvas ref={canvasRef} className="rain-canvas" aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none' }} />
  );
});

RainCanvas.displayName = 'RainCanvas';

export { RainCanvas };
