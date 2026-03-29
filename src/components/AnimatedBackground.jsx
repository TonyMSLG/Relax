import React, { useEffect, useRef } from 'react';
import p5 from 'p5';
import './AnimatedBackground.css';

const VERTEX_SHADER = `
attribute vec3 aPosition;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

void main() {
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
}
`;

const FRAGMENT_SHADER = `
#ifdef GL_ES
precision highp float;
#endif

uniform float uTime;
uniform float uSpeedColor;
uniform vec2 uResolution;

uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec3 uColor4;
uniform vec3 uColor5;
uniform vec3 uBackgroundColor;

const int AMOUNT = 2;
const float scale = 2.0;

vec3 blendExclusion(vec3 base, vec3 blend) {
  return base + blend - 2.0 * base * blend;
}

vec3 blendExclusion(vec3 base, vec3 blend, float opacity) {
  return (blendExclusion(base, blend) * opacity + base * (1.0 - opacity));
}

float blendLighten(float base, float blend) {
  return max(blend, base);
}

vec3 blendLighten(vec3 base, vec3 blend) {
  return vec3(blendLighten(base.r, blend.r), blendLighten(base.g, blend.g), blendLighten(base.b, blend.b));
}

vec3 blendLighten(vec3 base, vec3 blend, float opacity) {
  return (blendLighten(base, blend) * opacity + base * (1.0 - opacity));
}

float blendDarken(float base, float blend) {
  return min(blend, base);
}

vec3 blendDarken(vec3 base, vec3 blend) {
  return vec3(blendDarken(base.r, blend.r), blendDarken(base.g, blend.g), blendDarken(base.b, blend.b));
}

vec3 blendDarken(vec3 base, vec3 blend, float opacity) {
  return (blendDarken(base, blend) * opacity + base * (1.0 - opacity));
}

float blendPinLight(float base, float blend) {
  return (blend < 0.5) ? blendDarken(base, (2.0 * blend)) : blendLighten(base, (2.0 * (blend - 0.5)));
}

vec3 blendPinLight(vec3 base, vec3 blend) {
  return vec3(blendPinLight(base.r, blend.r), blendPinLight(base.g, blend.g), blendPinLight(base.b, blend.b));
}

vec3 blendPinLight(vec3 base, vec3 blend, float opacity) {
  return (blendPinLight(base, blend) * opacity + base * (1.0 - opacity));
}

float blendOverlay(float base, float blend) {
  return base < 0.5 ? (2.0 * base * blend) : (1.0 - 2.0 * (1.0 - base) * (1.0 - blend));
}

vec3 blendOverlay(vec3 base, vec3 blend) {
  return vec3(blendOverlay(base.r, blend.r), blendOverlay(base.g, blend.g), blendOverlay(base.b, blend.b));
}

vec3 blendOverlay(vec3 base, vec3 blend, float opacity) {
  return (blendOverlay(base, blend) * opacity + base * (1.0 - opacity));
}

float blendLinearDodge(float base, float blend) {
  return min(base + blend, 1.0);
}

vec3 blendLinearDodge(vec3 base, vec3 blend) {
  return min(base + blend, vec3(1.0));
}

vec3 blendLinearDodge(vec3 base, vec3 blend, float opacity) {
  return (blendLinearDodge(base, blend) * opacity + base * (1.0 - opacity));
}

float blendLinearBurn(float base, float blend) {
  return max(base + blend - 1.0, 0.0);
}

vec3 blendLinearBurn(vec3 base, vec3 blend) {
  return max(base + blend - vec3(1.0), vec3(0.0));
}

vec3 blendLinearBurn(vec3 base, vec3 blend, float opacity) {
  return (blendLinearBurn(base, blend) * opacity + base * (1.0 - opacity));
}

float blendLinearLight(float base, float blend) {
  return blend < 0.5 ? blendLinearBurn(base, (2.0 * blend)) : blendLinearDodge(base, (2.0 * (blend - 0.5)));
}

vec3 blendLinearLight(vec3 base, vec3 blend) {
  return vec3(blendLinearLight(base.r, blend.r), blendLinearLight(base.g, blend.g), blendLinearLight(base.b, blend.b));
}

vec3 blendLinearLight(vec3 base, vec3 blend, float opacity) {
  return (blendLinearLight(base, blend) * opacity + base * (1.0 - opacity));
}

float blendScreen(float base, float blend) {
  return 1.0 - ((1.0 - base) * (1.0 - blend));
}

vec3 blendScreen(vec3 base, vec3 blend) {
  return vec3(blendScreen(base.r, blend.r), blendScreen(base.g, blend.g), blendScreen(base.b, blend.b));
}

vec3 blendScreen(vec3 base, vec3 blend, float opacity) {
  return (blendScreen(base, blend) * opacity + base * (1.0 - opacity));
}

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

float createLen() {
  float time = 10.0 + uTime / 1.0;
  vec2 coord = scale * (gl_FragCoord.xy - uResolution.xy) / min(uResolution.y, uResolution.x);
  float len;
  for (int i = 0; i < AMOUNT; i++) {
    len = length(vec2(coord.x, coord.y));
    coord.x = coord.x + cos(coord.y - sin(len)) - cos(time / 9.1);
    coord.y = coord.y + sin(coord.y + cos(len)) + sin(time / 12.0);
  }
  return len;
}

float createLen2(float x, float y, float speed, float offset) {
  float time = offset + uTime / speed;
  vec2 coord = scale * (gl_FragCoord.xy - uResolution.xy) / min(uResolution.y, uResolution.x);
  float len;
  for (int i = 0; i < AMOUNT; i++) {
    len = length(vec2(coord.x, coord.y));
    coord.x = coord.x + sin(coord.y + cos(len) * cos(len)) + sin(time / x);
    coord.y = coord.y - cos(coord.y + sin(len) * sin(len)) + cos(time / y);
  }
  return len;
}

float createLen3(float x, float y, float speed, float offset) {
  float time = offset + uTime / speed;
  vec2 coord = scale * (gl_FragCoord.xy - uResolution.xy) / min(uResolution.y, uResolution.x);
  float len;
  for (int i = 0; i < AMOUNT; i++) {
    len = length(vec2(coord.x, coord.y));
    coord.y = coord.y + sin(coord.y + cos(len)) + sin(time / y);
  }
  return len;
}

float createLen4(float x, float y, float speed, float offset) {
  float time = offset + uTime / speed;
  vec2 coord = scale * (gl_FragCoord.xy - uResolution.xy) / min(uResolution.y, uResolution.x);
  float len;
  for (int i = 0; i < AMOUNT; i++) {
    len = length(vec2(coord.x, coord.y));
    coord.x = coord.x - cos(coord.y + sin(len)) + cos(time / x);
  }
  return len;
}

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec2 coord = scale * (gl_FragCoord.xy - uResolution.xy) / min(uResolution.y, uResolution.x);

  float len = createLen();
  float len2 = createLen2(10.0, 10.0, 8.0, 20.0);
  float len3 = createLen3(2.0, 2.0, 10.0, 30.0);
  float len4 = createLen4(5.0, 20.0, 5.0, 40.0);

  vec3 blue = uColor1 + cos(len) * 0.25 + 0.25;
  vec3 turquoise = uColor2 + cos(len2) * 0.5 + 0.75;
  vec3 pink = uColor3 + cos(len3) * 0.5 + 0.75;
  vec3 peach = uColor4 + cos(len4) * 0.75 + 0.95;
  vec3 mist = uColor5 + cos(len2 + len3) * 0.35 + 0.55;

  float pinkValue = min(1.0, max(0.0, 1.2 - (pink[0] / 1.2)));
  float peachValue = min(1.0, max(0.0, 1.5 - (peach[0] / 1.2)));
  float turquoiseValue = min(1.0, max(0.0, 1.5 - (turquoise[2] / 1.1)));
  float mistValue = min(1.0, max(0.0, 1.25 - (mist[1] / 1.15)));

  vec3 blend = mix(uBackgroundColor, blue, 0.72);
  blend = mix(blend, turquoise, turquoiseValue);
  blend = mix(blend, peach, peachValue);
  blend = mix(blend, pink, pinkValue);
  blend = mix(blend, mist, mistValue * 0.45);

  vec3 lightercolor = blendLinearBurn(blend, peach);
  blend = mix(blend, lightercolor, max(1.0 - lightercolor[0], 0.0));
  blend = blendOverlay(blend, vec3(0.0, 0.0, 0.0));

  vec3 color = blend;
  vec3 hsb = rgb2hsv(color);
  hsb[1] -= rand(coord) * 0.15;
  vec3 rgb = hsv2rgb(hsb);

  gl_FragColor = vec4(rgb, 1.0);
}
`;

const hexToRgb = (hexColor) => {
  const sanitizedHex = hexColor.replace('#', '');
  return [
    parseInt(sanitizedHex.slice(0, 2), 16) / 255,
    parseInt(sanitizedHex.slice(2, 4), 16) / 255,
    parseInt(sanitizedHex.slice(4, 6), 16) / 255,
  ];
};

const AnimatedBackground = ({ palette }) => {
  const containerRef = useRef(null);
  const paletteRef = useRef(palette);

  useEffect(() => {
    paletteRef.current = palette;
  }, [palette]);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    let shaderInstance;

    const sketch = (instance) => {
      instance.setup = () => {
        const canvas = instance.createCanvas(window.innerWidth, window.innerHeight, instance.WEBGL);
        canvas.parent(containerRef.current);
        canvas.elt.setAttribute('aria-hidden', 'true');
        instance.pixelDensity(1);
        instance.noStroke();
        instance.rectMode(instance.CENTER);
        shaderInstance = instance.createShader(VERTEX_SHADER, FRAGMENT_SHADER);
      };

      instance.draw = () => {
        const currentPalette = paletteRef.current;
        instance.background(currentPalette.baseEnd);
        instance.shader(shaderInstance);

        shaderInstance.setUniform('uResolution', [instance.width, instance.height]);
        shaderInstance.setUniform('uTime', instance.millis() / 100.0);
        shaderInstance.setUniform('uSpeedColor', 20.0);
        shaderInstance.setUniform('uColor1', hexToRgb(currentPalette.inkCool));
        shaderInstance.setUniform('uColor2', hexToRgb(currentPalette.glowWarm));
        shaderInstance.setUniform('uColor3', hexToRgb(currentPalette.inkWarm));
        shaderInstance.setUniform('uColor4', hexToRgb(currentPalette.baseStart));
        shaderInstance.setUniform('uColor5', hexToRgb(currentPalette.glowLight));
        shaderInstance.setUniform('uBackgroundColor', hexToRgb(currentPalette.baseEnd));

        instance.rect(0, 0, instance.width, instance.height);
      };

      instance.windowResized = () => {
        instance.resizeCanvas(window.innerWidth, window.innerHeight);
      };
    };

    const backgroundSketch = new p5(sketch);

    return () => {
      backgroundSketch.remove();
    };
  }, []);

  return (
    <div className="animated-background" ref={containerRef}></div>
  );
};

export default AnimatedBackground;
