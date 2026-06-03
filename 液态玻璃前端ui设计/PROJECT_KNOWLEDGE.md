# Liquid Glass UI - 项目架构与知识交接文档

## 1. 项目概览
本项目是一个基于 React + TypeScript + Vite 的极高还原度拟物风格（Liquid Glass / 液态玻璃）组件库。
主要目的是将 [Kube.io/Pebble & Void] 中的纯原生 HTML/JS/Canvas 硬核光学与物理组件，重构成现代的 React 组件生态。

## 2. 核心技术栈与架构
项目完全剥离了原版的静态滤镜，采用了**真实物理驱动**：
- **`src/utils/optics.ts` (光学引擎)**：底层基于斯涅尔定律 (Snell's Law)。负责通过隐藏的 Canvas 实时演算出带有厚度、折射率的 3D 法线置换贴图 (Displacement Map) 和高光贴图。
- **`src/utils/spring.ts` (弹簧物理引擎)**：一个自定义的 1D 阻尼弹簧类。所有的拖拽、滑动交互都通过它计算出实时的“速率缩放（Velocity Squish）”——即速度越快，玻璃形变越大（果冻效果）。
- **`src/components/OpticsFilter.tsx`**：将 `optics.ts` 算出的 base64 贴图喂给 SVG `<feImage>` 和 `<feDisplacementMap>`。
- **`src/components/LiquidStateContext.tsx`**：全局状态，保存用户在底部 `ParameterPanel` 调节的玻璃参数，并通过 `useOpticsMap` 钩子下发给各个视图。

## 3. 当前进度 (17个组件，100% 完成)
在原作者的 15 个组件中（扩展至 17 个），全部移植完成：
- [x] **Magnifying Glass** (`views/MagnifyingGlass.tsx`) - 透镜拖拽。
- [x] **Switch** (`views/SwitchPrototype.tsx`) - 1D轨道开关。
- [x] **Fluid Slider** (`views/FluidSlider.tsx`) - 横向果冻滑块。
- [x] **Dynamic Dock** (`views/DynamicDock.tsx`) - macOS悬浮Dock栏。
- [x] **Music Player & Searchbox** - 静态排版。
- [x] **Liquid Cursor** (`views/LiquidCursor.tsx`) - 鼠标跟随弹簧液态球，速度 squish。
- [x] **Tactile Button** (`views/TactileButton.tsx`) - 弹簧压缩回弹，涟漪效果。
- [x] **Segmented Tabs** (`views/SegmentedTabs.tsx`) - 指示器弹性横滑。
- [x] **Rotary Dial** (`views/RotaryDial.tsx`) - 极坐标旋转，松手惯性衰减。
- [x] **Focus Input** (`views/FocusInput.tsx`) - Focus 时玻璃高光边框弹入。
- [x] **Volume** (`views/VolumeKnob.tsx`) - 旋转式旋钮，SVG 圆弧进度，滚轮支持。
- [x] **Floating Action Menu** (`views/FloatingActionMenu.tsx`) - staggered 弹出，蒙层。
- [x] **Number Stepper** (`views/NumberStepper.tsx`) - 数字上下弹出切换，按钮压缩。
- [x] **Liquid Checkbox** (`views/LiquidCheckbox.tsx`) - checkmark 路径弹性绘制。
- [x] **Fluid Progress Bar** (`views/FluidProgress.tsx`) - 末端液态球弹簧延迟。
- [x] **Glass Tooltip** (`views/GlassTooltip.tsx`) - hover 弹入气泡，上下两方向。

## 4. 给新 Agent 的指令
如果你是在新对话中被唤醒的 Agent，请注意：
1. 本项目**绝对禁止**使用 `<feTurbulence>` 等静态噪波来模拟玻璃！必须使用已写好的 `OpticsFilter` 组件接入光学引擎。
2. 组件中**绝对禁止**使用 React 的 `setState` 来驱动高频拖拽动画！必须使用原生 `requestAnimationFrame` 配合 `spring.ts` 直接修改 DOM `ref.current.style.transform` 以保证极度流畅的手感。
3. 所有 17 个组件均已移植完成，如需新增组件请继续遵循上述规范。
