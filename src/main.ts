import "./style.css";
import { CanvasHeatmapRenderer } from "./canvas-heatmap";
import { datasetNames, makeDataset, parseCsv, type Dataset } from "./datasets";
import { defaultOptions, HeatmapRenderer, maxPoints, palettes, type HeatmapOptions, type HeatPoint } from "./heatmap";

function element<Element extends HTMLElement>(id: string): Element {
  return document.getElementById(id) as Element;
}

const gpuCanvas = element<HTMLCanvasElement>("heatmap");
const cpuCanvas = element<HTMLCanvasElement>("heatmap-2d");
const gpuPanel = element("gpu-panel");
const cpuPanel = element("cpu-panel");
const engine = element<HTMLSelectElement>("engine");
const preset = element<HTMLSelectElement>("dataset");
const palette = element<HTMLSelectElement>("palette");
const grid = element<HTMLInputElement>("grid");
const file = element<HTMLInputElement>("file");
const count = element<HTMLParagraphElement>("point-count");
const status = element<HTMLParagraphElement>("status");
const renderStatus = element<HTMLParagraphElement>("render-status");
const exportButton = element<HTMLButtonElement>("export");
const legend = element<HTMLSpanElement>("legend-ramp");
const note = element<HTMLParagraphElement>("demo-note");

const sliderFormat = {
  radius: (value: number) => String(value) + " px",
  intensity: (value: number) => value.toFixed(2) + "×",
  threshold: (value: number) => (value * 100).toFixed(1) + "%",
};
const sliderKeys = Object.keys(sliderFormat) as (keyof typeof sliderFormat)[];
const inputs = sliderKeys.map((key) => ({
  key, input: element<HTMLInputElement>(key), output: element<HTMLOutputElement>(key + "-value"),
}));
const notes: Record<Dataset | "custom", string> = {
  clusters: "观察离散点如何形成多个热点。",
  corridors: "增大半径，观察沿交通线分布的热点如何连起来。",
  uniform: "观察密度阈值怎样隐藏稀疏区域。",
  overlap: "左边一个权重为 1 的点，中间两个各为 0.5 的重合点，右边一个权重为 0.2 的点。比较三处峰值。",
  scale: "12,000 个可复现的样本点。拖动参数观察两种渲染方式。",
  custom: "正在使用本地 CSV 数据。两种方式共用同一份数据。",
};

let webgl: HeatmapRenderer | undefined;
let canvas2d: CanvasHeatmapRenderer | undefined;
let gpuError = "";
let cpuError = "";
let options: HeatmapOptions = { ...defaultOptions };
let points: HeatPoint[] = [];
let imported: HeatPoint[] | undefined;
let frame = 0;

function message(text = "", error = false) {
  status.textContent = text;
  status.dataset.error = String(error);
}

function updatePanels() {
  gpuPanel.hidden = !webgl || engine.value === "canvas";
  cpuPanel.hidden = !canvas2d || (engine.value === "webgl" && Boolean(webgl));
  exportButton.disabled = gpuPanel.hidden && cpuPanel.hidden;
  const failures = [
    engine.value !== "canvas" ? gpuError : "",
    engine.value !== "webgl" || !webgl ? cpuError : "",
  ].filter(Boolean);
  renderStatus.textContent = failures.join(" ");
  renderStatus.dataset.error = String(failures.length > 0);
}

function ensureRenderers() {
  if (!webgl && !gpuError && engine.value !== "canvas") {
    try {
      webgl = new HeatmapRenderer(gpuCanvas);
      webgl.setPoints(points);
    } catch (error) {
      webgl?.dispose();
      webgl = undefined;
      gpuError = (error as Error).message;
    }
  }
  if (!canvas2d && !cpuError && (engine.value !== "webgl" || !webgl)) {
    try {
      canvas2d = new CanvasHeatmapRenderer(cpuCanvas);
      canvas2d.setPoints(points);
    } catch (error) {
      cpuError = (error as Error).message;
    }
  }
  updatePanels();
}

function draw() {
  if (webgl && !gpuPanel.hidden) {
    try {
      webgl.render(options);
    } catch (error) {
      webgl.dispose();
      webgl = undefined;
      gpuError = (error as Error).message;
      ensureRenderers();
    }
  }
  if (canvas2d && !cpuPanel.hidden) {
    try {
      canvas2d.render(options);
    } catch (error) {
      canvas2d = undefined;
      cpuError = (error as Error).message;
      updatePanels();
    }
  }
}

function scheduleDraw() {
  if (frame || exportButton.disabled) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    draw();
  });
}

function updateControls() {
  inputs.forEach(({ key, input, output }) => {
    input.value = String(options[key]);
    output.value = sliderFormat[key](options[key]);
  });
  palette.value = options.palette;
  grid.checked = options.grid;
  legend.style.backgroundImage = "linear-gradient(to right, " + palettes[options.palette].join(", ") + ")";
  scheduleDraw();
}

function updatePoints(next: HeatPoint[]) {
  points = next;
  count.textContent = new Intl.NumberFormat("zh-CN").format(points.length) + " 个数据点";
  note.textContent = notes[preset.value as keyof typeof notes];
  webgl?.setPoints(points);
  canvas2d?.setPoints(points);
  scheduleDraw();
}

function currentDataset() {
  if (preset.value === "custom" && imported) return [...imported];
  return makeDataset(preset.value as Dataset);
}

function appendPoint(x: number, y: number) {
  if (points.length >= maxPoints) {
    message("已达到 50,000 个点。", true);
    return;
  }
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  updatePoints([...points, { x: clamp(x), y: clamp(y), weight: 1 }]);
}

function reflectDemo() {
  const url = new URL(location.href);
  url.searchParams.set("renderer", engine.value);
  if (preset.value !== "custom") url.searchParams.set("demo", preset.value);
  history.replaceState(null, "", url);
}

for (const [key, name] of Object.entries(datasetNames)) preset.add(new Option(name, key));
const custom = new Option("导入的数据", "custom");
custom.hidden = true;
preset.add(custom);
const params = new URLSearchParams(location.search);
const requestedDemo = params.get("demo");
preset.value = requestedDemo && Object.hasOwn(datasetNames, requestedDemo) ? requestedDemo : "clusters";
const requestedRenderer = params.get("renderer");
engine.value = requestedRenderer === "canvas" || requestedRenderer === "webgl" ? requestedRenderer : "compare";

preset.addEventListener("change", () => {
  updatePoints(currentDataset());
  reflectDemo();
  message();
});
engine.addEventListener("change", () => {
  ensureRenderers();
  reflectDemo();
  scheduleDraw();
});
inputs.forEach(({ key, input, output }) => {
  input.addEventListener("input", () => {
    options[key] = input.valueAsNumber;
    output.value = sliderFormat[key](options[key]);
    scheduleDraw();
  });
});
palette.addEventListener("change", () => {
  options.palette = palette.value as HeatmapOptions["palette"];
  updateControls();
});
grid.addEventListener("change", () => {
  options.grid = grid.checked;
  scheduleDraw();
});
element("reset").addEventListener("click", () => {
  options = { ...defaultOptions };
  updateControls();
  updatePoints(currentDataset());
  message();
});
element("import").addEventListener("click", () => file.click());
file.addEventListener("change", async () => {
  const selected = file.files?.[0];
  if (!selected) return;
  try {
    if (selected.size > 2 * 1024 * 1024) throw new Error("CSV 文件不能超过 2 MB。");
    imported = parseCsv(await selected.text());
    custom.hidden = false;
    preset.value = "custom";
    updatePoints(currentDataset());
    message("已导入 " + imported.length + " 个数据点。");
  } catch (error) {
    message((error as Error).message, true);
  } finally {
    if (file.files?.[0] === selected) file.value = "";
  }
});
for (const canvas of [gpuCanvas, cpuCanvas]) {
  canvas.addEventListener("click", (event) => {
    const rect = canvas.getBoundingClientRect();
    appendPoint((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
  });
  canvas.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      appendPoint(0.5, 0.5);
    }
  });
}
gpuCanvas.addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  webgl = undefined;
  gpuError = "WebGL 2 上下文已丢失，等待浏览器恢复。";
  ensureRenderers();
  scheduleDraw();
});
gpuCanvas.addEventListener("webglcontextrestored", () => {
  gpuError = "";
  ensureRenderers();
  scheduleDraw();
});
exportButton.addEventListener("click", () => {
  // Snapshot before WebGL discards its drawing buffer.
  draw();
  const visible = [
    ...(!gpuPanel.hidden ? [gpuCanvas] : []),
    ...(!cpuPanel.hidden ? [cpuCanvas] : []),
  ];
  if (!visible.length) return;
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = visible.reduce((total, canvas) => total + canvas.width, 0);
  exportCanvas.height = Math.max(...visible.map((canvas) => canvas.height));
  const context = exportCanvas.getContext("2d");
  if (!context) {
    message("无法创建 PNG 导出画布。", true);
    return;
  }
  let x = 0;
  for (const canvas of visible) {
    context.drawImage(canvas, x, 0);
    x += canvas.width;
  }
  exportCanvas.toBlob((blob) => {
    if (!blob) {
      message("PNG 导出失败，请重试。", true);
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "webgl-heatmap.png";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 15_000);
  });
});

updateControls();
updatePoints(currentDataset());
ensureRenderers();
scheduleDraw();
const observer = new ResizeObserver(scheduleDraw);
observer.observe(gpuCanvas);
observer.observe(cpuCanvas);
