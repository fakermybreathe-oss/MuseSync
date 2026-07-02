declare module 'raindrop-fx' {
  interface RaindropFXOptions {
    canvas: HTMLCanvasElement;
    background?: string;
    spawnInterval?: [number, number];
    spawnSize?: [number, number];
    spawnLimit?: number;
    slipRate?: number;
    motionInterval?: [number, number];
    xShifting?: [number, number];
    colliderSize?: number;
    trailDropDensity?: number;
    trailDropSize?: [number, number];
    trailDistance?: [number, number];
    trailSpread?: number;
    initialSpread?: number;
    shrinkRate?: number;
    velocitySpread?: number;
    evaporate?: number;
    gravity?: number;
    backgroundBlurSteps?: number;
    backgroundWrapMode?: 'clamp' | 'repeat' | 'mirror';
    mist?: boolean;
    mistColor?: [number, number, number, number];
    mistTime?: number;
    mistBlurStep?: number;
    dropletsPerSeconds?: number;
    dropletSize?: [number, number];
    smoothRaindrop?: [number, number];
    refractBase?: number;
    refractScale?: number;
    raindropCompose?: 'smoother' | 'harder';
    raindropLightPos?: [number, number, number, number];
    raindropDiffuseLight?: [number, number, number];
    raindropShadowOffset?: number;
    raindropEraserSize?: [number, number];
    raindropSpecularLight?: [number, number, number];
    raindropSpecularShininess?: number;
    raindropLightBump?: number;
  }

  class RaindropFX {
    constructor(options: RaindropFXOptions);
    options: RaindropFXOptions;
    start(): Promise<void>;
    stop(): void;
    resize(width: number, height: number): void;
    setBackground(source: string | HTMLCanvasElement | HTMLImageElement | ArrayBuffer): Promise<void>;
  }

  export default RaindropFX;
}
