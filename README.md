# WebGL-HeatMap

基于 TypeScript 和 WebGL 2 的加权点热力图。浏览器直接用 GPU 累加密度并映射颜色。演示提供城市热点、交通走廊和均匀分布三组示例，可调整半径、强度、阈值和配色，导入 CSV，在画布上加点并导出 PNG。

[打开在线演示](https://wshxbqq.github.io/WebGL-HeatMap/)

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

## GPU 渲染流程

1. **密度累加**。用实例化绘制为每个点生成一个四边形。片元着色器按距离计算高斯形状的权重，通过加法混合把重叠贡献写到同一张密度纹理。
2. **色带映射**。全屏着色器读取密度纹理，应用强度和阈值，并在五个色标间插值。演示里的密度用来比较画面内的相对热点。
3. **缓冲区与尺寸**。可渲染浮点纹理的设备使用 RGBA16F，其余 WebGL 2 设备使用 RGBA8。8 位路径在累加前应用增益，低权重贡献会受量化精度影响。按画布实际尺寸分配缓冲区，支持非 2 次幂尺寸。

旧项目可以继续引用原路径的 [WebGL.HeatMap.js](WebGL.HeatMap.js)。原有 [demo.html](demo.html) 也保留在仓库根目录。

## 感谢赞助

感谢 **智审标（SmartBid）** 赞助本项目。智审标提供招投标文件审查，支持核对资格条件、条款响应和报价，报告附原件页码供复核。

- [智审标官网](https://biao.vvcut.cn/)
- [智审标开源 Agent Skill · GitHub](https://github.com/wshxbqq/smartbid-tender-review)
