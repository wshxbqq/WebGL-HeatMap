(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=`#version 300 es
layout(location = 0) in vec3 a_point;
uniform vec2 u_size;
uniform float u_radius;
out vec2 v_offset;
out float v_weight;

void main() {
  // Each instance covers an axis-aligned quad around a single point.
  vec2 corner = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1)) * 2.0 - 1.0;
  vec2 center = vec2(a_point.x, 1.0 - a_point.y) * 2.0 - 1.0;
  gl_Position = vec4(center + corner * u_radius * 2.0 / u_size, 0.0, 1.0);
  v_offset = corner;
  v_weight = a_point.z;
}
`,t=`#version 300 es
precision highp float;
in vec2 v_offset;
in float v_weight;
uniform float u_gain;
out vec4 color;

void main() {
  // Gaussian-like radial falloff, remapped to zero at the radius.
  float r2 = dot(v_offset, v_offset);
  if (r2 >= 1.0) discard;
  const float tail = 0.0111089965; // exp(-4.5)
  float kernel = (exp(-4.5 * r2) - tail) / (1.0 - tail);
  color = vec4(kernel * v_weight * u_gain, 0.0, 0.0, 0.0);
}
`,n=`#version 300 es
out vec2 v_uv;
void main() {
  vec2 position = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
  v_uv = position;
}
`,r=`#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_density;
uniform float u_gain;
uniform float u_threshold;
uniform float u_pixelRatio;
uniform vec3 u_palette[5];
uniform bool u_grid;
out vec4 color;

void main() {
  float density = clamp(texture(u_density, v_uv).r * u_gain, 0.0, 1.0);
  vec3 background = u_palette[0];
  if (u_grid) {
    vec2 cell = gl_FragCoord.xy / (32.0 * u_pixelRatio);
    vec2 distanceToLine = abs(fract(cell + 0.5) - 0.5);
    float grid = 1.0 - smoothstep(0.005, 0.030, min(distanceToLine.x, distanceToLine.y));
    background += vec3(0.042, 0.047, 0.052) * grid;
  }
  float index = density * 4.0;
  int band = min(int(index), 3);
  vec3 tint = mix(u_palette[band], u_palette[band + 1], index - float(band));
  float visible = smoothstep(u_threshold, u_threshold + 0.025, density);
  vec3 surface = mix(background, tint, visible);
  color = vec4(surface, 1.0);
}
`,i={thermal:[`#101a2e`,`#255993`,`#20c6ba`,`#ffd76c`,`#ff623e`],sunset:[`#211630`,`#50307c`,`#b04986`,`#ff9275`,`#fff0af`],lagoon:[`#0a242d`,`#18566a`,`#1b9b9c`,`#74d6ad`,`#e0fcad`]},a={radius:42,intensity:1.2,threshold:.035,palette:`thermal`,grid:!0};function o(e){return[e.x,e.y,e.weight].every(e=>Number.isFinite(e)&&e>=0&&e<=1)}function s(e,t,n){let r=l(e.createShader(t),`着色器`);if(e.shaderSource(r,n),e.compileShader(r),e.getShaderParameter(r,e.COMPILE_STATUS))return r;let i=e.getShaderInfoLog(r);throw e.deleteShader(r),Error(`着色器编译失败
`+i)}function c(e,t,n){let r=s(e,e.VERTEX_SHADER,t),i;try{i=s(e,e.FRAGMENT_SHADER,n);let t=l(e.createProgram(),`着色程序`);if(e.attachShader(t,r),e.attachShader(t,i),e.linkProgram(t),e.getProgramParameter(t,e.LINK_STATUS))return t;let a=e.getProgramInfoLog(t);throw e.deleteProgram(t),Error(`着色程序链接失败
`+a)}finally{e.deleteShader(r),i&&e.deleteShader(i)}}function l(e,t){if(!e)throw Error(`无法创建或加载`+t+`。`);return e}function u(e,t,...n){return Object.fromEntries(n.map(n=>[n,l(e.getUniformLocation(t,n),n)]))}function d(e){return new Float32Array(e.flatMap(e=>[1,3,5].map(t=>Number.parseInt(e.slice(t,t+2),16)/255)))}var f={thermal:d(i.thermal),sunset:d(i.sunset),lagoon:d(i.lagoon)},p=class{canvas;gl;densityProgram;colorProgram;densityUniforms;colorUniforms;pointBuffer;pointArray;densityTexture;framebuffer;maxSize;floatingPoint;size=[0,0];count=0;disposed=!1;constructor(i){this.canvas=i;let a=i.getContext(`webgl2`,{alpha:!1,antialias:!1});if(!a)throw Error(`当前浏览器无法创建 WebGL 2 上下文。请检查硬件加速设置。`);this.gl=a;let o=[];try{this.densityProgram=c(a,e,t),o.push(()=>a.deleteProgram(this.densityProgram)),this.colorProgram=c(a,n,r),o.push(()=>a.deleteProgram(this.colorProgram)),this.densityUniforms=m(a,this.densityProgram),this.colorUniforms=h(a,this.colorProgram),this.pointBuffer=l(a.createBuffer(),`点数据缓冲区`),o.push(()=>a.deleteBuffer(this.pointBuffer)),this.pointArray=l(a.createVertexArray(),`顶点数组`),o.push(()=>a.deleteVertexArray(this.pointArray)),a.bindVertexArray(this.pointArray),a.bindBuffer(a.ARRAY_BUFFER,this.pointBuffer),a.bufferData(a.ARRAY_BUFFER,0,a.DYNAMIC_DRAW),a.enableVertexAttribArray(0),a.vertexAttribPointer(0,3,a.FLOAT,!1,0,0),a.vertexAttribDivisor(0,1),a.bindVertexArray(null),this.densityTexture=l(a.createTexture(),`密度纹理`),o.push(()=>a.deleteTexture(this.densityTexture)),this.framebuffer=l(a.createFramebuffer(),`密度帧缓冲区`),o.push(()=>a.deleteFramebuffer(this.framebuffer)),a.activeTexture(a.TEXTURE0),a.bindTexture(a.TEXTURE_2D,this.densityTexture),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_MIN_FILTER,a.NEAREST),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_MAG_FILTER,a.NEAREST),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_WRAP_S,a.CLAMP_TO_EDGE),a.texParameteri(a.TEXTURE_2D,a.TEXTURE_WRAP_T,a.CLAMP_TO_EDGE),this.floatingPoint=!!a.getExtension(`EXT_color_buffer_float`);let i=a.getParameter(a.MAX_VIEWPORT_DIMS);this.maxSize=Math.min(4096,a.getParameter(a.MAX_TEXTURE_SIZE),...i)}catch(e){for(let e of o.reverse())e();throw e}}setPoints(e){if(this.disposed)throw Error(`渲染器已释放。`);if(e.length>5e4)throw RangeError(`点数量超过 50,000。`);let t=new Float32Array(e.length*3);e.forEach((e,n)=>{if(!o(e))throw RangeError(`坐标与权重必须在 0 到 1 之间。`);t.set([e.x,e.y,e.weight],n*3)}),this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.pointBuffer),this.gl.bufferData(this.gl.ARRAY_BUFFER,t,this.gl.DYNAMIC_DRAW),this.count=e.length}render(e=a){let{gl:t,canvas:n}=this;if(this.disposed||t.isContextLost())return;let r=n.clientWidth,i=n.clientHeight;if(!r||!i)return;let o=Math.min(devicePixelRatio||1,2,this.maxSize/Math.max(r,i));this.resize(Math.max(1,Math.round(r*o)),Math.max(1,Math.round(i*o)));let s=e.intensity*.1;t.bindFramebuffer(t.FRAMEBUFFER,this.framebuffer),t.viewport(0,0,n.width,n.height),t.clearColor(0,0,0,0),t.clear(t.COLOR_BUFFER_BIT),t.enable(t.BLEND),t.blendEquation(t.FUNC_ADD),t.blendFunc(t.ONE,t.ONE),t.useProgram(this.densityProgram),t.bindVertexArray(this.pointArray),t.uniform2f(this.densityUniforms.u_size,n.width,n.height),t.uniform1f(this.densityUniforms.u_radius,e.radius*o),t.uniform1f(this.densityUniforms.u_gain,this.floatingPoint?1:s),t.drawArraysInstanced(t.TRIANGLE_STRIP,0,4,this.count),t.bindFramebuffer(t.FRAMEBUFFER,null),t.disable(t.BLEND),t.useProgram(this.colorProgram),t.bindVertexArray(null),t.activeTexture(t.TEXTURE0),t.bindTexture(t.TEXTURE_2D,this.densityTexture),t.uniform1i(this.colorUniforms.u_density,0),t.uniform1f(this.colorUniforms.u_gain,this.floatingPoint?s:1),t.uniform1f(this.colorUniforms.u_threshold,e.threshold),t.uniform1f(this.colorUniforms.u_pixelRatio,o),t.uniform3fv(this.colorUniforms[`u_palette[0]`],f[e.palette]),t.uniform1i(this.colorUniforms.u_grid,Number(e.grid)),t.drawArrays(t.TRIANGLES,0,3)}resize(e,t){let n=this.gl;if(e===this.size[0]&&t===this.size[1])return;this.canvas.width=e,this.canvas.height=t,n.activeTexture(n.TEXTURE0),n.bindTexture(n.TEXTURE_2D,this.densityTexture),n.bindFramebuffer(n.FRAMEBUFFER,this.framebuffer),n.framebufferTexture2D(n.FRAMEBUFFER,n.COLOR_ATTACHMENT0,n.TEXTURE_2D,this.densityTexture,0),this.floatingPoint&&=(n.texImage2D(n.TEXTURE_2D,0,n.RGBA16F,e,t,0,n.RGBA,n.HALF_FLOAT,null),n.checkFramebufferStatus(n.FRAMEBUFFER)===n.FRAMEBUFFER_COMPLETE),this.floatingPoint||n.texImage2D(n.TEXTURE_2D,0,n.RGBA8,e,t,0,n.RGBA,n.UNSIGNED_BYTE,null);let r=n.checkFramebufferStatus(n.FRAMEBUFFER);if(n.bindFramebuffer(n.FRAMEBUFFER,null),r!==n.FRAMEBUFFER_COMPLETE)throw Error(`无法创建密度缓冲区。`);this.size=[e,t]}dispose(){if(this.disposed)return;let e=this.gl;e.deleteProgram(this.densityProgram),e.deleteProgram(this.colorProgram),e.deleteBuffer(this.pointBuffer),e.deleteVertexArray(this.pointArray),e.deleteFramebuffer(this.framebuffer),e.deleteTexture(this.densityTexture),this.disposed=!0}};function m(e,t){return u(e,t,`u_size`,`u_radius`,`u_gain`)}function h(e,t){return u(e,t,`u_density`,`u_gain`,`u_threshold`,`u_pixelRatio`,`u_palette[0]`,`u_grid`)}var g={clusters:`城市热点`,corridors:`交通走廊`,uniform:`均匀分布`};function _(){let e=2026;return()=>(e=Math.imul(e,1664525)+0x3c6ef35f>>>0,e/2**32)}var v=e=>Math.max(0,Math.min(1,e));function y(e){let t=_(),n=[[.19,.3,56],[.32,.66,45],[.47,.41,66],[.58,.68,30],[.74,.32,74],[.85,.61,45]],r=()=>(t()+t()+t()-1.5)*.09,i=(e,n)=>({x:v(e),y:v(n),weight:.25+t()*.75});return e===`clusters`?Array.from({length:60},()=>{let e=i(t(),t());return{...e,weight:e.weight*.35}}).concat(n.flatMap(([e,t,n])=>Array.from({length:n},()=>i(e+r(),t+r()*1.4)))):e===`corridors`?Array.from({length:440},(e,n)=>{let a=.07+t()*.86,o=n%3==0?.68-.34*a+r()*.55:.37+Math.sin(a*8)*.2+r()*.5;return i(a,o)}):Array.from({length:380},()=>i(t(),t()))}function b(e){let t=e.trim().split(/\r?\n/),n=/^x\s*,\s*y\s*,\s*weight$/i.test(t[0]),r=[];for(let e=Number(n);e<t.length;e++){if(!t[e].trim())continue;let n=t[e].split(`,`).map(e=>e.trim()),[i,a,s]=n.map(Number),c={x:i,y:a,weight:s};if(n.length!==3||n.some(e=>!e)||!o(c))throw Error(`第 `+(e+1)+` 行需要 3 个 0 到 1 之间的数值，依次为 x、y、weight。`);if(r.length>=5e4)throw Error(`CSV 最多可导入 50,000 个点。`);r.push(c)}if(!r.length)throw Error(`CSV 没有数据行。`);return r}function x(e){return document.getElementById(e)}var S=x(`heatmap`),C=x(`dataset`),w=x(`palette`),T=x(`grid`),E=x(`file`),D=x(`point-count`),O=x(`status`),k=x(`export`),A=x(`legend-ramp`),j={radius:e=>String(e)+` px`,intensity:e=>e.toFixed(2)+`×`,threshold:e=>(e*100).toFixed(1)+`%`},M=Object.keys(j).map(e=>({key:e,input:x(e),output:x(e+`-value`)})),N,P={...a},F=y(`clusters`),I,L=0;function R(e=``,t=!1){O.textContent=e,O.dataset.error=String(t)}function z(){N?.dispose(),N=void 0,k.disabled=!0,S.setAttribute(`aria-disabled`,`true`)}function B(){if(!N)return!1;try{return N.render(P),!0}catch(e){return z(),R(e.message,!0),!1}}function V(){!L&&N&&(L=requestAnimationFrame(()=>{L=0,B()}))}function H(){M.forEach(({key:e,input:t,output:n})=>{t.value=String(P[e]),n.value=j[e](P[e])}),w.value=P.palette,T.checked=P.grid,A.style.backgroundImage=`linear-gradient(to right, `+i[P.palette].join(`, `)+`)`,V()}function U(e){F=e,D.textContent=new Intl.NumberFormat(`zh-CN`).format(F.length)+` 个数据点`,N?.setPoints(F),V()}function W(){return C.value===`custom`&&I?[...I]:y(C.value)}function G(e,t){N&&(F.length>=5e4?R(`已达到 50,000 个点。`,!0):U([...F,{x:e,y:t,weight:1}]))}function K(){try{N=new p(S),N.setPoints(F),B()&&(k.disabled=!1,S.removeAttribute(`aria-disabled`),R())}catch(e){z(),R(e.message,!0)}}for(let[e,t]of Object.entries(g))C.add(new Option(t,e));var q=new Option(`导入的数据`,`custom`);q.hidden=!0,C.add(q),C.value=`clusters`,C.addEventListener(`change`,()=>{U(W()),R()}),M.forEach(({key:e,input:t,output:n})=>{t.addEventListener(`input`,()=>{P[e]=t.valueAsNumber,n.value=j[e](P[e]),V()})}),w.addEventListener(`change`,()=>{P.palette=w.value,H()}),T.addEventListener(`change`,()=>{P.grid=T.checked,V()}),x(`reset`).addEventListener(`click`,()=>{P={...a},H(),U(W()),R()}),x(`import`).addEventListener(`click`,()=>E.click()),E.addEventListener(`change`,async()=>{let e=E.files?.[0];if(e)try{if(e.size>2097152)throw Error(`CSV 文件不能超过 2 MB。`);I=b(await e.text()),q.hidden=!1,C.value=`custom`,U(W()),R(`已导入 `+I.length+` 个数据点。`)}catch(e){R(e.message,!0)}finally{E.value=``}}),S.addEventListener(`click`,e=>{let t=S.getBoundingClientRect();G((e.clientX-t.left)/t.width,(e.clientY-t.top)/t.height)}),S.addEventListener(`keydown`,e=>{e.key===`Enter`&&(e.preventDefault(),G(.5,.5))}),S.addEventListener(`webglcontextlost`,e=>{e.preventDefault(),z(),R(`WebGL 上下文已丢失，正在等待浏览器恢复。`,!0)}),S.addEventListener(`webglcontextrestored`,K),k.addEventListener(`click`,()=>{B()&&S.toBlob(e=>{if(!e){R(`PNG 导出失败，请重试。`,!0);return}let t=URL.createObjectURL(e),n=document.createElement(`a`);n.href=t,n.download=`webgl-heatmap.png`,n.click(),window.setTimeout(()=>URL.revokeObjectURL(t),15e3)})}),H(),U(F),K(),new ResizeObserver(V).observe(S);