import "./style.css";
import { datasetNames, makeDataset, parseCsv, type Dataset } from "./datasets";
import { defaultOptions, HeatmapRenderer, maxPoints, palettes, type HeatmapOptions, type HeatPoint } from "./heatmap";

function element<Element extends HTMLElement>(id: string): Element {
  return document.getElementById(id) as Element;
}

const canvas = element<HTMLCanvasElement>("heatmap");
const preset = element<HTMLSelectElement>("dataset");
const palette = element<HTMLSelectElement>("palette");
const grid = element<HTMLInputElement>("grid");
const file = element<HTMLInputElement>("file");
const count = element<HTMLParagraphElement>("point-count");
const status = element<HTMLParagraphElement>("status");
const exportButton = element<HTMLButtonElement>("export");
const legend = element<HTMLSpanElement>("legend-ramp");

const sliderFormat = {
  radius: (value: number) => String(value) + " px",
  intensity: (value: number) => value.toFixed(2) + "×",
  threshold: (value: number) => (value * 100).toFixed(1) + "%",
};
const sliderKeys = Object.keys(sliderFormat) as (keyof typeof sliderFormat)[];
const inputs = sliderKeys.map((key) => ({
  key, input: element<HTMLInputElement>(key), output: element<HTMLOutputElement>(key + "-value"),
}));

let renderer: HeatmapRenderer | undefined;
let options: HeatmapOptions = { ...defaultOptions };
let points = makeDataset("clusters");
let imported: HeatPoint[] | undefined;
let frame = 0;

function message(text = "", error = false) {
  status.textContent = text;
  status.dataset.error = String(error);
}

function disableRendering() {
  renderer?.dispose();
  renderer = undefined;
  exportButton.disabled = true;
  canvas.setAttribute("aria-disabled", "true");
}

function draw() {
  if (!renderer) return false;
  try {
    renderer.render(options);
    return true;
  } catch (error) {
    disableRendering();
    message((error as Error).message, true);
    return false;
  }
}

function scheduleDraw() {
  if (frame || !renderer) return;
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
  renderer?.setPoints(points);
  scheduleDraw();
}

function currentDataset() {
  if (preset.value === "custom" && imported) return [...imported];
  return makeDataset(preset.value as Dataset);
}

function appendPoint(x: number, y: number) {
  if (!renderer) return;
  if (points.length >= maxPoints) {
    message("已达到 50,000 个点。", true);
    return;
  }
  updatePoints([...points, { x, y, weight: 1 }]);
}

function initialize() {
  try {
    renderer = new HeatmapRenderer(canvas);
    renderer.setPoints(points);
    if (draw()) {
      exportButton.disabled = false;
      canvas.removeAttribute("aria-disabled");
      message();
    }
  } catch (error) {
    disableRendering();
    message((error as Error).message, true);
  }
}

for (const [key, name] of Object.entries(datasetNames)) preset.add(new Option(name, key));
const custom = new Option("导入的数据", "custom");
custom.hidden = true;
preset.add(custom);
preset.value = "clusters";
preset.addEventListener("change", () => {
  updatePoints(currentDataset());
  message();
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
    file.value = "";
  }
});
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
canvas.addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  disableRendering();
  message("WebGL 上下文已丢失，正在等待浏览器恢复。", true);
});
canvas.addEventListener("webglcontextrestored", initialize);
exportButton.addEventListener("click", () => {
  // Snapshot immediately after drawing, before WebGL discards the drawing buffer.
  if (!draw()) return;
  canvas.toBlob((blob) => {
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
updatePoints(points);
initialize();
new ResizeObserver(scheduleDraw).observe(canvas);
