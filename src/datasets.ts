import { isHeatPoint, maxPoints, type HeatPoint } from "./heatmap";

export const datasetNames = {
  clusters: "城市热点",
  corridors: "交通走廊",
  uniform: "均匀分布",
  overlap: "权重与叠加",
  scale: "万点压力测试",
} as const;

export type Dataset = keyof typeof datasetNames;

function randomSequence() {
  let state = 2026;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const clampUnit = (value: number) => Math.max(0, Math.min(1, value));

export function makeDataset(dataset: Dataset): HeatPoint[] {
  const random = randomSequence();
  const clusters = [
    [0.19, 0.30, 56], [0.32, 0.66, 45], [0.47, 0.41, 66],
    [0.58, 0.68, 30], [0.74, 0.32, 74], [0.85, 0.61, 45],
  ];
  const jitter = () => (random() + random() + random() - 1.5) * 0.09;
  const point = (x: number, y: number): HeatPoint => ({
    x: clampUnit(x), y: clampUnit(y), weight: 0.25 + random() * 0.75,
  });

  if (dataset === "clusters") {
    const scattered = Array.from({ length: 60 }, () => {
      const sample = point(random(), random());
      return { ...sample, weight: sample.weight * 0.35 };
    });
    return scattered.concat(clusters.flatMap(([x, y, count]) =>
      Array.from({ length: count }, () => point(x + jitter(), y + jitter() * 1.4))));
  }
  if (dataset === "corridors") {
    return Array.from({ length: 440 }, (_, index) => {
      const x = 0.07 + random() * 0.86;
      const y = index % 3 === 0
        ? 0.68 - 0.34 * x + jitter() * 0.55
        : 0.37 + Math.sin(x * 8) * 0.20 + jitter() * 0.50;
      return point(x, y);
    });
  }
  if (dataset === "overlap") {
    return [
      { x: 0.23, y: 0.5, weight: 1 },
      { x: 0.5, y: 0.5, weight: 0.5 },
      { x: 0.5, y: 0.5, weight: 0.5 },
      { x: 0.76, y: 0.5, weight: 0.2 },
    ];
  }
  if (dataset === "scale") {
    return Array.from({ length: 12_000 }, (_, index) => {
      const [x, y] = clusters[index % clusters.length];
      return { ...point(x + jitter() * 1.6, y + jitter() * 1.8), weight: 0.02 + random() * 0.06 };
    });
  }
  return Array.from({ length: 380 }, () => point(random(), random()));
}

export function parseCsv(text: string): HeatPoint[] {
  const lines = text.trim().split(/\r?\n/);
  const hasHeader = /^x\s*,\s*y\s*,\s*weight$/i.test(lines[0]);
  const points: HeatPoint[] = [];
  for (let index = Number(hasHeader); index < lines.length; index++) {
    if (!lines[index].trim()) continue;
    const values = lines[index].split(",").map((value) => value.trim());
    const [x, y, weight] = values.map(Number);
    const point = { x, y, weight };
    if (values.length !== 3 || values.some((value) => !value) || !isHeatPoint(point)) {
      throw new Error("第 " + (index + 1) + " 行需要 3 个 0 到 1 之间的数值，依次为 x、y、weight。");
    }
    if (points.length >= maxPoints) throw new Error("CSV 最多可导入 50,000 个点。");
    points.push(point);
  }
  if (!points.length) throw new Error("CSV 没有数据行。");
  return points;
}
