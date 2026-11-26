export const densityVertex = `#version 300 es
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
`;

export const densityFragment = `#version 300 es
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
`;

export const colorVertex = `#version 300 es
out vec2 v_uv;
void main() {
  vec2 position = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
  v_uv = position;
}
`;

export const colorFragment = `#version 300 es
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
`;
