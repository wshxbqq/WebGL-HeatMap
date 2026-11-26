import { densityGain, paletteChannels, type HeatmapOptions, type HeatPoint } from "./heatmap";

const maxDensitySamples = 500_000;
const maxKernelSamples = 8_000_000;
const kernelTail = Math.exp(-4.5);
const backgroundGrid = [0.042, 0.047, 0.052];

function clampUnit(value: number) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(start: number, end: number, value: number) {
  const x = clampUnit((value - start) / (end - start));
  return x * x * (3 - 2 * x);
}

export class CanvasHeatmapRenderer {
  private readonly context: CanvasRenderingContext2D;
  private readonly buffer = document.createElement("canvas");
  private readonly bufferContext: CanvasRenderingContext2D;
  private points: readonly HeatPoint[] = [];
  private density = new Float32Array();
  private colors: ImageData | undefined;

  constructor(readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d", { alpha: false });
    const bufferContext = this.buffer.getContext("2d", { alpha: false });
    if (!context || !bufferContext) throw new Error("当前浏览器无法创建 Canvas 2D 上下文。");
    this.context = context;
    this.bufferContext = bufferContext;
  }

  setPoints(points: readonly HeatPoint[]) {
    this.points = points;
  }

  render(options: HeatmapOptions) {
    const { canvas } = this;
    const { clientWidth, clientHeight } = canvas;
    if (!clientWidth || !clientHeight) return;
    const pixelRatio = Math.min(devicePixelRatio || 1, 2, 4096 / Math.max(clientWidth, clientHeight));
    const displayWidth = Math.max(1, Math.round(clientWidth * pixelRatio));
    const displayHeight = Math.max(1, Math.round(clientHeight * pixelRatio));
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }

    // Bound total pixel and kernel work for imported or stress-test data.
    const kernelArea = Math.max(1, this.points.length * (options.radius * 2) ** 2);
    const scale = Math.min(pixelRatio, Math.sqrt(maxDensitySamples / (clientWidth * clientHeight)),
      Math.sqrt(maxKernelSamples / kernelArea));
    const width = Math.max(1, Math.round(clientWidth * scale));
    const height = Math.max(1, Math.round(clientHeight * scale));
    if (!this.colors || this.buffer.width !== width || this.buffer.height !== height) {
      this.buffer.width = width;
      this.buffer.height = height;
      this.density = new Float32Array(width * height);
      this.colors = this.bufferContext.createImageData(width, height);
    }

    this.density.fill(0);
    this.accumulate(options.radius * scale, width, height);
    this.applyPalette(this.colors.data, options, width, height, scale);
    this.bufferContext.putImageData(this.colors, 0, 0);
    this.context.drawImage(this.buffer, 0, 0, displayWidth, displayHeight);
  }

  private accumulate(radius: number, width: number, height: number) {
    const radiusSquared = radius * radius;
    for (const { x, y, weight } of this.points) {
      const centerX = x * width - 0.5;
      const centerY = y * height - 0.5;
      const left = Math.max(0, Math.ceil(centerX - radius));
      const right = Math.min(width - 1, Math.floor(centerX + radius));
      const top = Math.max(0, Math.ceil(centerY - radius));
      const bottom = Math.min(height - 1, Math.floor(centerY + radius));
      const rowWeight = weight / (1 - kernelTail);
      for (let row = top; row <= bottom; row++) {
        const dySquared = (row - centerY) ** 2;
        for (let column = left; column <= right; column++) {
          const distance = ((column - centerX) ** 2 + dySquared) / radiusSquared;
          if (distance < 1) {
            this.density[row * width + column] += (Math.exp(-4.5 * distance) - kernelTail) * rowWeight;
          }
        }
      }
    }
  }

  private applyPalette(output: Uint8ClampedArray, options: HeatmapOptions, width: number, height: number, scale: number) {
    const palette = paletteChannels[options.palette];
    const gain = options.intensity * densityGain;
    const gridDistances = (length: number) => Float32Array.from({ length }, (_, index) => {
      const cell = (index + 0.5) / (32 * scale);
      return Math.abs(cell - Math.round(cell));
    });
    const columns = options.grid ? gridDistances(width) : undefined;
    const rows = options.grid ? gridDistances(height) : undefined;
    for (let index = 0; index < this.density.length; index++) {
      const value = clampUnit(this.density[index] * gain);
      const position = value * 4;
      const band = Math.min(Math.floor(position), 3);
      const fraction = position - band;
      const visible = smoothstep(options.threshold, options.threshold + 0.025, value);
      const grid = columns && rows
        ? 1 - smoothstep(0.005, 0.030, Math.min(columns[index % width], rows[height - 1 - Math.floor(index / width)]))
        : 0;
      for (let channel = 0; channel < 3; channel++) {
        const first = palette[band * 3 + channel];
        const next = palette[(band + 1) * 3 + channel];
        const color = first + (next - first) * fraction;
        const background = palette[channel] + backgroundGrid[channel] * grid;
        output[index * 4 + channel] = (background + (color - background) * visible) * 255;
      }
      output[index * 4 + 3] = 255;
    }
  }
}
