import { colorFragment, colorVertex, densityFragment, densityVertex } from "./shaders";

export interface HeatPoint {
  /** Normalized position measured from the left edge. */
  x: number;
  /** Normalized position measured from the top edge. */
  y: number;
  /** Relative contribution in [0, 1]. */
  weight: number;
}

export const palettes = {
  thermal: ["#101a2e", "#255993", "#20c6ba", "#ffd76c", "#ff623e"],
  sunset: ["#211630", "#50307c", "#b04986", "#ff9275", "#fff0af"],
  lagoon: ["#0a242d", "#18566a", "#1b9b9c", "#74d6ad", "#e0fcad"],
} as const;

export interface HeatmapOptions {
  radius: number;
  intensity: number;
  threshold: number;
  palette: keyof typeof palettes;
  grid: boolean;
}

export const defaultOptions: HeatmapOptions = {
  radius: 42, intensity: 1.2, threshold: 0.035, palette: "thermal", grid: true,
};

export const maxPoints = 50_000;

export function isHeatPoint(point: HeatPoint): boolean {
  return [point.x, point.y, point.weight].every((value) =>
    Number.isFinite(value) && value >= 0 && value <= 1);
}

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = required(gl.createShader(type), "着色器");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;

  const message = gl.getShaderInfoLog(shader);
  gl.deleteShader(shader);
  throw new Error("着色器编译失败\n" + message);
}

function link(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string) {
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
  let fragment: WebGLShader | undefined;
  try {
    fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = required(gl.createProgram(), "着色程序");
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;

    const message = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error("着色程序链接失败\n" + message);
  } finally {
    gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
  }
}

function required<T>(resource: T | null, name: string): T {
  if (!resource) throw new Error("无法创建或加载" + name + "。");
  return resource;
}

function uniforms<const Name extends string>(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  ...names: Name[]
): Record<Name, WebGLUniformLocation> {
  return Object.fromEntries(names.map((name) => [
    name, required(gl.getUniformLocation(program, name), name),
  ])) as Record<Name, WebGLUniformLocation>;
}

function colorChannels(colors: readonly string[]) {
  return new Float32Array(colors.flatMap((color) =>
    [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16) / 255)));
}

const paletteChannels = {
  thermal: colorChannels(palettes.thermal),
  sunset: colorChannels(palettes.sunset),
  lagoon: colorChannels(palettes.lagoon),
};

export class HeatmapRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly densityProgram: WebGLProgram;
  private readonly colorProgram: WebGLProgram;
  private readonly densityUniforms: ReturnType<typeof makeDensityUniforms>;
  private readonly colorUniforms: ReturnType<typeof makeColorUniforms>;
  private readonly pointBuffer: WebGLBuffer;
  private readonly pointArray: WebGLVertexArrayObject;
  private readonly densityTexture: WebGLTexture;
  private readonly framebuffer: WebGLFramebuffer;
  private readonly maxSize: number;
  private floatingPoint: boolean;
  private size = [0, 0];
  private count = 0;
  private disposed = false;

  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false });
    if (!gl) throw new Error("当前浏览器无法创建 WebGL 2 上下文。请检查硬件加速设置。");
    this.gl = gl;
    const cleanups: (() => void)[] = [];
    try {
      this.densityProgram = link(gl, densityVertex, densityFragment);
      cleanups.push(() => gl.deleteProgram(this.densityProgram));
      this.colorProgram = link(gl, colorVertex, colorFragment);
      cleanups.push(() => gl.deleteProgram(this.colorProgram));
      this.densityUniforms = makeDensityUniforms(gl, this.densityProgram);
      this.colorUniforms = makeColorUniforms(gl, this.colorProgram);

      this.pointBuffer = required(gl.createBuffer(), "点数据缓冲区");
      cleanups.push(() => gl.deleteBuffer(this.pointBuffer));
      this.pointArray = required(gl.createVertexArray(), "顶点数组");
      cleanups.push(() => gl.deleteVertexArray(this.pointArray));
      gl.bindVertexArray(this.pointArray);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, 0, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(0, 1);
      gl.bindVertexArray(null);

      this.densityTexture = required(gl.createTexture(), "密度纹理");
      cleanups.push(() => gl.deleteTexture(this.densityTexture));
      this.framebuffer = required(gl.createFramebuffer(), "密度帧缓冲区");
      cleanups.push(() => gl.deleteFramebuffer(this.framebuffer));
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.densityTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      this.floatingPoint = Boolean(gl.getExtension("EXT_color_buffer_float"));
      const viewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
      this.maxSize = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE), ...viewport);
    } catch (error) {
      for (const cleanup of cleanups.reverse()) cleanup();
      throw error;
    }
  }

  setPoints(points: readonly HeatPoint[]) {
    if (this.disposed) throw new Error("渲染器已释放。");
    if (points.length > maxPoints) throw new RangeError("点数量超过 50,000。");

    const vertices = new Float32Array(points.length * 3);
    points.forEach((point, index) => {
      if (!isHeatPoint(point)) throw new RangeError("坐标与权重必须在 0 到 1 之间。");
      vertices.set([point.x, point.y, point.weight], index * 3);
    });
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.pointBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.DYNAMIC_DRAW);
    this.count = points.length;
  }

  render(options: HeatmapOptions = defaultOptions) {
    const { gl, canvas } = this;
    if (this.disposed || gl.isContextLost()) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(devicePixelRatio || 1, 2, this.maxSize / Math.max(width, height));
    this.resize(Math.max(1, Math.round(width * ratio)), Math.max(1, Math.round(height * ratio)));

    const gain = options.intensity * 0.10;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(this.densityProgram);
    gl.bindVertexArray(this.pointArray);
    gl.uniform2f(this.densityUniforms.u_size, canvas.width, canvas.height);
    gl.uniform1f(this.densityUniforms.u_radius, options.radius * ratio);
    // The 8-bit target clamps additions, so scale each contribution before accumulation.
    gl.uniform1f(this.densityUniforms.u_gain, this.floatingPoint ? 1 : gain);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.count);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.disable(gl.BLEND);
    gl.useProgram(this.colorProgram);
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.densityTexture);
    gl.uniform1i(this.colorUniforms.u_density, 0);
    gl.uniform1f(this.colorUniforms.u_gain, this.floatingPoint ? gain : 1);
    gl.uniform1f(this.colorUniforms.u_threshold, options.threshold);
    gl.uniform1f(this.colorUniforms.u_pixelRatio, ratio);
    gl.uniform3fv(this.colorUniforms["u_palette[0]"], paletteChannels[options.palette]);
    gl.uniform1i(this.colorUniforms.u_grid, Number(options.grid));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private resize(width: number, height: number) {
    const gl = this.gl;
    if (width === this.size[0] && height === this.size[1]) return;

    this.canvas.width = width;
    this.canvas.height = height;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.densityTexture);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.densityTexture, 0);
    if (this.floatingPoint) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
      this.floatingPoint = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    }
    if (!this.floatingPoint) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error("无法创建密度缓冲区。");
    this.size = [width, height];
  }

  dispose() {
    if (this.disposed) return;
    const gl = this.gl;
    gl.deleteProgram(this.densityProgram);
    gl.deleteProgram(this.colorProgram);
    gl.deleteBuffer(this.pointBuffer);
    gl.deleteVertexArray(this.pointArray);
    gl.deleteFramebuffer(this.framebuffer);
    gl.deleteTexture(this.densityTexture);
    this.disposed = true;
  }
}

function makeDensityUniforms(gl: WebGL2RenderingContext, program: WebGLProgram) {
  return uniforms(gl, program, "u_size", "u_radius", "u_gain");
}

function makeColorUniforms(gl: WebGL2RenderingContext, program: WebGLProgram) {
  return uniforms(gl, program, "u_density", "u_gain", "u_threshold", "u_pixelRatio", "u_palette[0]", "u_grid");
}
