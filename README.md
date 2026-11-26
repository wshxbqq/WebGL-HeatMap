# WebGL-HeatMap

用 TypeScript 在浏览器里绘制加权点热力图。可以独立运行 Canvas 2D 或 WebGL 2，也可以并排查看，两种方式共用数据、半径、强度、阈值和色带。支持导入 CSV、在画布上加点和导出 PNG。

[打开在线演示](https://wshxbqq.github.io/WebGL-HeatMap/)

## 演示

| 示例 | 可以观察什么 |
| --- | --- |
| [城市热点 · 并排对照](https://wshxbqq.github.io/WebGL-HeatMap/?demo=clusters&renderer=compare) | 离散的加权点怎样形成聚集区域 |
| [交通走廊 · WebGL 2](https://wshxbqq.github.io/WebGL-HeatMap/?demo=corridors&renderer=webgl) | 沿线热点随半径变大逐渐连成走廊 |
| [均匀分布 · Canvas 2D](https://wshxbqq.github.io/WebGL-HeatMap/?demo=uniform&renderer=canvas) | 调高阈值，筛去密度较低的区域 |
| [权重与叠加 · 并排对照](https://wshxbqq.github.io/WebGL-HeatMap/?demo=overlap&renderer=compare) | 两个重合的半权重点如何得到与单个全权重点相同的峰值 |
| [万点压力测试 · 并排对照](https://wshxbqq.github.io/WebGL-HeatMap/?demo=scale&renderer=compare) | 12,000 个样本点下两种实现的交互表现 |

## 本地运行

需要 Node.js 20.19+ 或 22.12+，以及支持 WebGL 2 的浏览器。

```sh
npm ci
npm run dev
```

```sh
npm run build
npm run preview
```

## 导入数据

CSV 可带表头。每行三个数字，横坐标 x、纵坐标 y 和权重 weight 都在 0 到 1 之间，左上角是 (0, 0)。旧数据如果使用像素坐标，可分别除以原图宽度和高度。权重可按业务的共同标尺缩放到 0 到 1。

```csv
x,y,weight
0.25,0.35,0.8
0.60,0.40,1
0.62,0.43,0.7
```

## 在 TypeScript 项目内使用

将 [src/heatmap.ts](src/heatmap.ts) 和 [src/shaders.ts](src/shaders.ts) 放进使用 ESM 的前端工程。给 canvas 设置 CSS 宽高，尺寸变化时重新渲染。半径单位为 CSS 像素，阈值以 0 到 1 的显示密度表示。

```ts
import { defaultOptions, HeatmapRenderer } from "./heatmap";

const canvas = document.querySelector<HTMLCanvasElement>("#heatmap");
if (!canvas) throw new Error("找不到画布");

const heatmap = new HeatmapRenderer(canvas);
heatmap.setPoints([
  { x: 0.25, y: 0.35, weight: 0.8 },
  { x: 0.6, y: 0.4, weight: 1 },
]);

const redraw = () => heatmap.render({ ...defaultOptions, radius: 32 });
const resize = new ResizeObserver(redraw);
resize.observe(canvas);
redraw();

// 页面或组件卸载时调用。
function unmount() {
  resize.disconnect();
  heatmap.dispose();
}
```

## 渲染流程

1. **密度累加**。用实例化绘制为每个点生成一个四边形。片元着色器按距离计算高斯形状的权重，通过加法混合把重叠贡献写到同一张密度纹理。
2. **色带映射**。全屏着色器读取密度纹理，应用强度和阈值，并在五个色标间插值。演示里的密度用来比较画面内的相对热点。
3. **WebGL 缓冲区与尺寸**。可渲染浮点纹理的设备使用 RGBA16F，其余 WebGL 2 设备使用 RGBA8。8 位路径在累加前应用增益，低权重贡献会受量化精度影响。按画布实际尺寸分配缓冲区，支持非 2 次幂尺寸。

Canvas 2D 版本在 [src/canvas-heatmap.ts](src/canvas-heatmap.ts)。它把同一种径向核累加到 CPU 浮点数组，再对照色带写入 ImageData。大量数据或高像素比场景下会降低内部采样分辨率，画布继续按页面尺寸显示。

旧项目可以继续引用原路径的 [WebGL.HeatMap.js](WebGL.HeatMap.js)。原有 [demo.html](demo.html) 也保留在仓库根目录。

## 特别感谢

感谢**智审标（SmartBid）**。智审标提供招投标文件审查，支持核对资格条件、条款响应与报价，审查报告附原件页码供复核。

[智审标官网](https://biao.vvcut.cn/) · [智审标开源 Skill](https://github.com/wshxbqq/smartbid-tender-review)
