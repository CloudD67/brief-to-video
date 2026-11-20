/* Three.js 确定性 3D 舞台：PBR、三点光、阴影、雾、雨/尘/蒸汽/火花、
   体积光、景深、动态模糊、泛光、ACES、颗粒与 FXAA。
   所有动画只由 renderAt(t) 驱动，不读 Date.now / Math.random，逐帧可复现。 */
(function () {
  'use strict';

  const T = window.THREE;
  if (!T) {
    console.error('three-kit: 先加载 vendor/three.min.js');
    return;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const smooth = p => {
    p = clamp(p, 0, 1);
    return p * p * (3 - 2 * p);
  };
  const TAU = Math.PI * 2;

  function canvasTexture(w, h, draw, opts) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    draw(ctx, w, h);
    const t = new T.CanvasTexture(c);
    t.colorSpace = (opts && opts.linear) ? T.NoColorSpace : T.SRGBColorSpace;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    if (opts && opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
    if (opts && opts.clamp) {
      t.wrapS = t.wrapT = T.ClampToEdgeWrapping;
    }
    t.anisotropy = 4;
    t.needsUpdate = true;
    return t;
  }

  function noiseCanvas(size, seed, octaves) {
    const r = mulberry32(seed);
    const grids = [];
    let total = 0;
    for (let o = 0; o < (octaves || 4); o++) {
      const n = 4 << o;
      const g = new Float32Array(n * n);
      for (let i = 0; i < g.length; i++) g[i] = r();
      grids.push({ n, g });
      total += 1 / (1 << o);
    }
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let v = 0;
        let amp = 1;
        for (let o = 0; o < grids.length; o++) {
          const { n, g } = grids[o];
          const fx = x / size * n;
          const fy = y / size * n;
          const x0 = Math.floor(fx);
          const y0 = Math.floor(fy);
          const tx = smooth(fx - x0);
          const ty = smooth(fy - y0);
          const i00 = g[(y0 % n) * n + (x0 % n)];
          const i10 = g[(y0 % n) * n + ((x0 + 1) % n)];
          const i01 = g[((y0 + 1) % n) * n + (x0 % n)];
          const i11 = g[((y0 + 1) % n) * n + ((x0 + 1) % n)];
          v += lerp(lerp(i00, i10, tx), lerp(i01, i11, tx), ty) * amp;
          amp *= 0.55;
        }
        v = v / total;
        const k = (y * size + x) * 4;
        const b = Math.round(clamp(v, 0, 1) * 255);
        img.data[k] = img.data[k + 1] = img.data[k + 2] = b;
        img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function heightToNormal(src, strength) {
    const w = src.width;
    const h = src.height;
    const sctx = src.getContext('2d');
    const data = sctx.getImageData(0, 0, w, h).data;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const at = (x, y) => data[((y + h) % h * w + (x + w) % w) * 4] / 255;
    const k = strength == null ? 2 : strength;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (at(x + 1, y) - at(x - 1, y)) * k;
        const dy = (at(x, y + 1) - at(x, y - 1)) * k;
        const len = Math.sqrt(dx * dx + dy * dy + 1);
        const i = (y * w + x) * 4;
        img.data[i] = Math.round((-dx / len * 0.5 + 0.5) * 255);
        img.data[i + 1] = Math.round((-dy / len * 0.5 + 0.5) * 255);
        img.data[i + 2] = Math.round((1 / len * 0.5 + 0.5) * 255);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function dotTexture(size, inner, outer) {
    return canvasTexture(size, size, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, inner || 'rgba(255,255,255,1)');
      g.addColorStop(0.35, inner || 'rgba(255,255,255,0.9)');
      g.addColorStop(1, outer || 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }, { clamp: true });
  }

  function ringTexture(size, color, width) {
    return canvasTexture(size, size, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = color || 'rgba(220,235,255,0.9)';
      ctx.lineWidth = width || 3;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w * 0.36, 0, TAU);
      ctx.stroke();
    }, { clamp: true });
  }

  function beamTexture(color) {
    return canvasTexture(128, 256, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, color || 'rgba(255,210,150,0.85)');
      g.addColorStop(0.55, 'rgba(255,210,150,0.22)');
      g.addColorStop(1, 'rgba(255,210,150,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(w * 0.32, 0);
      ctx.lineTo(w * 0.68, 0);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
    }, { clamp: true });
  }

  function textTexture(text, opts) {
    const o = opts || {};
    const w = o.width || 512;
    const h = o.height || 256;
    return canvasTexture(w, h, (ctx) => {
      ctx.clearRect(0, 0, w, h);
      if (o.bg) {
        ctx.fillStyle = o.bg;
        ctx.fillRect(0, 0, w, h);
      }
      const size = o.size || 150;
      ctx.font = (o.weight || 800) + ' ' + size + 'px ' + (o.font || '"PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lines = String(text).split('\n');
      const lh = size * 1.06;
      const y0 = h / 2 - (lines.length - 1) * lh / 2;
      lines.forEach((line, i) => {
        if (o.glow !== false) {
          ctx.shadowColor = o.glowColor || o.color || '#ff5a3c';
          ctx.shadowBlur = o.glowBlur || 26;
        }
        ctx.fillStyle = o.color || '#fff3e6';
        ctx.fillText(line, w / 2, y0 + i * lh);
        ctx.shadowBlur = 0;
      });
    }, { clamp: true });
  }

  function verticalTextTexture(text, opts) {
    const chars = Array.from(String(text));
    return textTexture(chars.join('\n'), Object.assign({ width: 220, height: 620, size: 150 }, opts));
  }

  function makeEnvironment(stage, opts) {
    const o = Object.assign({
      top: 0x070b16,
      bottom: 0x1a0d14,
      neonA: 0xff3f6d,
      neonB: 0x38c7ff,
      intensity: 1
    }, opts || {});
    const env = new T.Scene();
    const geo = new T.SphereGeometry(40, 32, 20);
    const colors = [];
    const pos = geo.attributes.position;
    const cTop = new T.Color(o.top);
    const cBottom = new T.Color(o.bottom);
    const cA = new T.Color(o.neonA).multiplyScalar(o.intensity * 2.2);
    const cB = new T.Color(o.neonB).multiplyScalar(o.intensity * 1.6);
    const tmp = new T.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 40;
      tmp.copy(cBottom).lerp(cTop, smooth((y + 1) / 2));
      const x = pos.getX(i) / 40;
      const z = pos.getZ(i) / 40;
      if (x > 0.35 && y > -0.1 && y < 0.7) tmp.add(cA.clone().multiplyScalar(0.35 * (1 - Math.abs(z))));
      if (x < -0.35 && y > -0.1 && y < 0.7) tmp.add(cB.clone().multiplyScalar(0.3 * (1 - Math.abs(z))));
      colors.push(tmp.r, tmp.g, tmp.b);
    }
    geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    const mat = new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide });
    env.add(new T.Mesh(geo, mat));

    const panel = (color, x, y, z, w, h) => {
      const m = new T.Mesh(
        new T.PlaneGeometry(w, h),
        new T.MeshBasicMaterial({ color: new T.Color(color).multiplyScalar(o.intensity * 6), side: T.DoubleSide })
      );
      m.position.set(x, y, z);
      m.lookAt(0, y, 0);
      env.add(m);
    };
    panel(o.neonA, 12, 4, -2, 4, 9);
    panel(o.neonB, -12, 3, 1, 3, 7);
    panel(0xffd2a0, 2, 9, 10, 5, 3);

    const pmrem = new T.PMREMGenerator(stage.renderer);
    pmrem.compileEquirectangularShader();
    const rt = pmrem.fromScene(env, 0.03);
    stage.scene.environment = rt.texture;
    pmrem.dispose();
    env.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
    return rt.texture;
  }

  const VERT = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `;

  const BRIGHT_FRAG = `
    uniform sampler2D tScene;
    uniform float uThreshold;
    uniform float uKnee;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tScene, vUv).rgb;
      float l = max(c.r, max(c.g, c.b));
      float k = smoothstep(uThreshold, uThreshold + uKnee, l);
      gl_FragColor = vec4(c * k, 1.0);
    }
  `;

  const BLUR_FRAG = `
    uniform sampler2D tTex;
    uniform vec2 uDir;
    varying vec2 vUv;
    void main() {
      vec2 d = uDir;
      vec3 c = texture2D(tTex, vUv).rgb * 0.2270270270;
      c += texture2D(tTex, vUv + d * 1.3846153846).rgb * 0.3162162162;
      c += texture2D(tTex, vUv - d * 1.3846153846).rgb * 0.3162162162;
      c += texture2D(tTex, vUv + d * 3.2307692308).rgb * 0.0702702703;
      c += texture2D(tTex, vUv - d * 3.2307692308).rgb * 0.0702702703;
      gl_FragColor = vec4(c, 1.0);
    }
  `;

  const ADD_FRAG = `
    uniform sampler2D tScene;
    uniform float uWeight;
    varying vec2 vUv;
    void main() {
      gl_FragColor = vec4(texture2D(tScene, vUv).rgb * uWeight, 1.0);
    }
  `;

  const COMPOSITE_FRAG = `
    uniform sampler2D tScene;
    uniform sampler2D tBloom;
    uniform sampler2D tDepth;
    uniform vec2 uResolution;
    uniform float uNear;
    uniform float uFar;
    uniform float uFocus;
    uniform float uAperture;
    uniform float uMaxBlur;
    uniform float uBloom;
    uniform float uExposure;
    uniform float uContrast;
    uniform float uSaturation;
    uniform vec3 uShadowTint;
    uniform vec3 uHighTint;
    uniform float uTint;
    uniform float uGrain;
    uniform float uVignette;
    uniform float uTime;
    uniform float uFade;
    varying vec2 vUv;

    float linearDepth(float d) {
      float z = d * 2.0 - 1.0;
      return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
    }
    float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
    vec3 aces(vec3 x) {
      return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
    }
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }
    vec3 srgb(vec3 c) {
      return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
    }

    void main() {
      vec2 texel = 1.0 / uResolution;
      float depth = texture2D(tDepth, vUv).x;
      float z = linearDepth(depth);
      float coc = clamp(abs(z - uFocus) / max(uFocus, 0.001) * uAperture, 0.0, 1.0);
      coc = pow(coc, 0.85) * uMaxBlur;

      vec3 color = texture2D(tScene, vUv).rgb;
      if (coc > 0.5) {
        vec3 sum = color;
        float total = 1.0;
        for (int i = 0; i < 12; i++) {
          float fi = float(i) + 0.5;
          float a = fi * 2.39996323;
          float r = sqrt(fi / 12.0);
          vec2 off = vec2(cos(a), sin(a)) * r * coc * texel;
          float zs = linearDepth(texture2D(tDepth, vUv + off).x);
          float w = 1.0 / (1.0 + abs(zs - z) * 1.6);
          sum += texture2D(tScene, vUv + off).rgb * w;
          total += w;
        }
        color = sum / total;
      }

      color += texture2D(tBloom, vUv).rgb * uBloom;
      color *= uExposure;

      float l = luma(color);
      color += mix(uShadowTint, uHighTint, smoothstep(0.18, 0.82, l)) * uTint;
      color = (color - 0.5) * uContrast + 0.5;
      l = luma(color);
      color = mix(vec3(l), color, uSaturation);
      color = aces(max(color, vec3(0.0)));

      float v = length((vUv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0));
      float vig = 1.0 - smoothstep(0.28, 1.15, v);
      color *= mix(1.0, vig, uVignette);
      float g = hash(vUv * uResolution + fract(uTime) * vec2(37.0, 17.0)) - 0.5;
      color += g * uGrain;
      color *= uFade;

      gl_FragColor = vec4(srgb(clamp(color, 0.0, 1.0)), 1.0);
    }
  `;

  const FXAA_FRAG = `
    uniform sampler2D tLdr;
    uniform vec2 uResolution;
    varying vec2 vUv;
    float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
    void main() {
      vec2 texel = 1.0 / uResolution;
      vec3 m = texture2D(tLdr, vUv).rgb;
      vec3 nw = texture2D(tLdr, vUv + vec2(-1.0, -1.0) * texel).rgb;
      vec3 ne = texture2D(tLdr, vUv + vec2(1.0, -1.0) * texel).rgb;
      vec3 sw = texture2D(tLdr, vUv + vec2(-1.0, 1.0) * texel).rgb;
      vec3 se = texture2D(tLdr, vUv + vec2(1.0, 1.0) * texel).rgb;
      float lm = luma(m), lnw = luma(nw), lne = luma(ne), lsw = luma(sw), lse = luma(se);
      float lmin = min(lm, min(min(lnw, lne), min(lsw, lse)));
      float lmax = max(lm, max(max(lnw, lne), max(lsw, lse)));
      if (lmax - lmin < max(0.0312, lmax * 0.125)) {
        gl_FragColor = vec4(m, 1.0);
        return;
      }
      vec2 dir = vec2(-((lnw + lne) - (lsw + lse)), ((lnw + lsw) - (lne + lse)));
      float reduce = max((lnw + lne + lsw + lse) * 0.25 * 0.03125, 0.0078125);
      float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + reduce);
      dir = clamp(dir * rcp, -8.0, 8.0) * texel;
      vec3 a = 0.5 * (texture2D(tLdr, vUv + dir * (1.0 / 3.0 - 0.5)).rgb +
                       texture2D(tLdr, vUv + dir * (2.0 / 3.0 - 0.5)).rgb);
      vec3 b = a * 0.5 + 0.25 * (texture2D(tLdr, vUv - dir * 0.5).rgb +
                                 texture2D(tLdr, vUv + dir * 0.5).rgb);
      float lb = luma(b);
      gl_FragColor = vec4((lb < lmin || lb > lmax) ? a : b, 1.0);
    }
  `;

  function createStage(opts) {
    const o = Object.assign({
      width: 1920,
      height: 1080,
      fov: 38,
      near: 0.05,
      far: 120,
      exposure: 1.0,
      background: 0x05070d,
      fogDensity: 0.022,
      shadows: true
    }, opts || {});

    const canvas = o.canvas || document.createElement('canvas');
    const renderer = new T.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });
    renderer.setPixelRatio(1);
    renderer.setSize(o.width, o.height, false);
    renderer.outputColorSpace = T.LinearSRGBColorSpace;
    renderer.toneMapping = T.NoToneMapping;
    renderer.useLegacyLights = false;
    renderer.shadowMap.enabled = !!o.shadows;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.setClearColor(o.background, 1);

    const scene = new T.Scene();
    scene.background = new T.Color(o.background);
    scene.fog = new T.FogExp2(o.background, o.fogDensity);

    const camera = new T.PerspectiveCamera(o.fov, o.width / o.height, o.near, o.far);
    camera.position.set(0, 1.6, 5);

    const hdr = renderer.capabilities.isWebGL2 &&
      (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'))
      ? T.HalfFloatType
      : T.UnsignedByteType;

    const depthTexture = new T.DepthTexture(o.width, o.height);
    depthTexture.type = T.UnsignedIntType;
    depthTexture.format = T.DepthFormat;

    let sceneTarget = makeRT(o.width, o.height, hdr, true, depthTexture);
    let accumTarget = makeRT(o.width, o.height, hdr, false);
    let bloomA = makeRT(Math.max(1, o.width >> 1), Math.max(1, o.height >> 1), hdr, false);
    let bloomB = makeRT(Math.max(1, o.width >> 1), Math.max(1, o.height >> 1), hdr, false);
    let ldrTarget = makeRT(o.width, o.height, T.UnsignedByteType, false);

    function makeRT(w, h, type, depth, depthTex) {
      const rt = new T.WebGLRenderTarget(w, h, {
        type,
        format: T.RGBAFormat,
        minFilter: T.LinearFilter,
        magFilter: T.LinearFilter,
        depthBuffer: !!depth,
        stencilBuffer: false
      });
      rt.texture.colorSpace = T.NoColorSpace;
      if (depthTex) rt.depthTexture = depthTex;
      return rt;
    }

    const quadScene = new T.Scene();
    const quadCamera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new T.Mesh(new T.PlaneGeometry(2, 2), null);
    quad.frustumCulled = false;
    quadScene.add(quad);

    const brightMat = new T.ShaderMaterial({
      uniforms: { tScene: { value: null }, uThreshold: { value: 0.75 }, uKnee: { value: 0.55 } },
      vertexShader: VERT, fragmentShader: BRIGHT_FRAG, depthTest: false, depthWrite: false
    });
    const blurMat = new T.ShaderMaterial({
      uniforms: { tTex: { value: null }, uDir: { value: new T.Vector2() } },
      vertexShader: VERT, fragmentShader: BLUR_FRAG, depthTest: false, depthWrite: false
    });
    const addMat = new T.ShaderMaterial({
      uniforms: { tScene: { value: null }, uWeight: { value: 1 } },
      vertexShader: VERT, fragmentShader: ADD_FRAG,
      depthTest: false, depthWrite: false,
      blending: T.AdditiveBlending
    });
    const compositeMat = new T.ShaderMaterial({
      uniforms: {
        tScene: { value: null },
        tBloom: { value: null },
        tDepth: { value: null },
        uResolution: { value: new T.Vector2(o.width, o.height) },
        uNear: { value: o.near },
        uFar: { value: o.far },
        uFocus: { value: 5 },
        uAperture: { value: 1.1 },
        uMaxBlur: { value: 10 },
        uBloom: { value: 0.9 },
        uExposure: { value: o.exposure },
        uContrast: { value: 1.04 },
        uSaturation: { value: 1.08 },
        uShadowTint: { value: new T.Color(0.01, 0.015, 0.03) },
        uHighTint: { value: new T.Color(0.02, 0.012, 0.005) },
        uTint: { value: 1 },
        uGrain: { value: 0.035 },
        uVignette: { value: 0.72 },
        uTime: { value: 0 },
        uFade: { value: 1 }
      },
      vertexShader: VERT, fragmentShader: COMPOSITE_FRAG, depthTest: false, depthWrite: false
    });
    const fxaaMat = new T.ShaderMaterial({
      uniforms: { tLdr: { value: null }, uResolution: { value: new T.Vector2(o.width, o.height) } },
      vertexShader: VERT, fragmentShader: FXAA_FRAG, depthTest: false, depthWrite: false
    });

    function draw(material, target, clear) {
      quad.material = material;
      renderer.setRenderTarget(target);
      if (clear !== false) renderer.clear();
      renderer.render(quadScene, quadCamera);
    }

    const post = {
      focus: 5,
      aperture: 1.1,
      maxBlur: 10,
      bloom: 0.9,
      exposure: o.exposure,
      contrast: 1.04,
      saturation: 1.08,
      grain: 0.035,
      vignette: 0.72,
      tint: 1,
      shadowTint: [0.01, 0.015, 0.03],
      highTint: [0.02, 0.012, 0.005],
      threshold: 0.75,
      knee: 0.55,
      fade: 1
    };

    const timeUniforms = [];
    const hooks = [];
    let updater = null;

    function update(t) {
      for (let i = 0; i < timeUniforms.length; i++) timeUniforms[i].value = t;
      if (updater) updater(t);
      for (let i = 0; i < hooks.length; i++) hooks[i](t);
    }

    function renderAt(t, renderOpts) {
      const ro = renderOpts || {};
      const shutter = Math.max(0, Number(ro.motion) || 0);
      const samples = shutter > 0 ? Math.max(3, Math.min(7, ro.samples || 3)) : 1;
      const half = Math.floor(samples / 2);
      const times = [];
      if (samples > 1) {
        for (let i = half; i >= 1; i--) {
          times.push(t - i * shutter, t + i * shutter);
        }
        times.push(t);
      } else {
        times.push(t);
      }

      if (samples > 1) {
        renderer.autoClear = false;
        renderer.setRenderTarget(accumTarget);
        renderer.setClearColor(0x000000, 1);
        renderer.clear();
        for (let i = 0; i < times.length; i++) {
          update(times[i]);
          renderer.setRenderTarget(sceneTarget);
          renderer.clear();
          renderer.render(scene, camera);
          addMat.uniforms.tScene.value = sceneTarget.texture;
          addMat.uniforms.uWeight.value = 1 / times.length;
          draw(addMat, accumTarget, false);
        }
        renderer.autoClear = true;
      } else {
        update(t);
        renderer.setRenderTarget(sceneTarget);
        renderer.clear();
        renderer.render(scene, camera);
      }

      const source = samples > 1 ? accumTarget : sceneTarget;
      const bw = bloomA.width;
      const bh = bloomA.height;

      brightMat.uniforms.tScene.value = source.texture;
      brightMat.uniforms.uThreshold.value = post.threshold;
      brightMat.uniforms.uKnee.value = post.knee;
      draw(brightMat, bloomA);

      blurMat.uniforms.tTex.value = bloomA.texture;
      blurMat.uniforms.uDir.value.set(1 / bw, 0);
      draw(blurMat, bloomB);

      blurMat.uniforms.tTex.value = bloomB.texture;
      blurMat.uniforms.uDir.value.set(0, 1 / bh);
      draw(blurMat, bloomA);

      const cu = compositeMat.uniforms;
      cu.tScene.value = source.texture;
      cu.tBloom.value = bloomA.texture;
      cu.tDepth.value = sceneTarget.depthTexture;
      cu.uFocus.value = post.focus;
      cu.uAperture.value = post.aperture;
      cu.uMaxBlur.value = post.maxBlur;
      cu.uBloom.value = post.bloom;
      cu.uExposure.value = post.exposure;
      cu.uContrast.value = post.contrast;
      cu.uSaturation.value = post.saturation;
      cu.uGrain.value = post.grain;
      cu.uVignette.value = post.vignette;
      cu.uTint.value = post.tint;
      cu.uShadowTint.value.setRGB(post.shadowTint[0], post.shadowTint[1], post.shadowTint[2]);
      cu.uHighTint.value.setRGB(post.highTint[0], post.highTint[1], post.highTint[2]);
      cu.uTime.value = t;
      cu.uFade.value = post.fade;
      draw(compositeMat, ldrTarget);

      fxaaMat.uniforms.tLdr.value = ldrTarget.texture;
      draw(fxaaMat, null);
      renderer.setRenderTarget(null);
    }

    function setSize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      sceneTarget.setSize(w, h);
      accumTarget.setSize(w, h);
      bloomA.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1));
      bloomB.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1));
      ldrTarget.setSize(w, h);
      compositeMat.uniforms.uResolution.value.set(w, h);
      fxaaMat.uniforms.uResolution.value.set(w, h);
    }

    function addDirectional(lightOpts) {
      const lo = Object.assign({ color: 0xffffff, intensity: 2, position: [3, 6, 4], shadow: true, range: 12 }, lightOpts || {});
      const light = new T.DirectionalLight(lo.color, lo.intensity);
      light.position.set(lo.position[0], lo.position[1], lo.position[2]);
      if (lo.shadow) {
        light.castShadow = true;
        light.shadow.mapSize.set(lo.mapSize || 2048, lo.mapSize || 2048);
        const c = light.shadow.camera;
        c.left = -lo.range;
        c.right = lo.range;
        c.top = lo.range;
        c.bottom = -lo.range;
        c.near = 0.1;
        c.far = lo.far || 55;
        light.shadow.bias = -0.0004;
        light.shadow.normalBias = 0.025;
      }
      scene.add(light);
      scene.add(light.target);
      return light;
    }

    function addSpot(lightOpts) {
      const lo = Object.assign({
        color: 0xffd8a8, intensity: 30, position: [0, 6, 2],
        angle: 0.55, penumbra: 0.85, distance: 18, decay: 2,
        target: [0, 0, 0], shadow: false
      }, lightOpts || {});
      const light = new T.SpotLight(lo.color, lo.intensity, lo.distance, lo.angle, lo.penumbra, lo.decay);
      light.position.set(lo.position[0], lo.position[1], lo.position[2]);
      light.target.position.set(lo.target[0], lo.target[1], lo.target[2]);
      if (lo.shadow) {
        light.castShadow = true;
        light.shadow.mapSize.set(1024, 1024);
        light.shadow.bias = -0.0005;
      }
      scene.add(light);
      scene.add(light.target);
      return light;
    }

    function addPoint(lightOpts) {
      const lo = Object.assign({ color: 0xffffff, intensity: 8, distance: 8, decay: 2, position: [0, 2, 0] }, lightOpts || {});
      const light = new T.PointLight(lo.color, lo.intensity, lo.distance, lo.decay);
      light.position.set(lo.position[0], lo.position[1], lo.position[2]);
      scene.add(light);
      return light;
    }

    function addHemisphere(lightOpts) {
      const lo = Object.assign({ sky: 0x334466, ground: 0x0a0808, intensity: 0.6 }, lightOpts || {});
      const light = new T.HemisphereLight(lo.sky, lo.ground, lo.intensity);
      scene.add(light);
      return light;
    }

    return {
      canvas,
      scene,
      camera,
      renderer,
      post,
      renderAt,
      setSize,
      update,
      onUpdate(fn) { updater = fn; },
      onBeforeRender(fn) { hooks.push(fn); },
      addTimeUniform(u) { timeUniforms.push(u); return u; },
      addDirectional,
      addSpot,
      addPoint,
      addHemisphere,
      makeEnvironment: envOpts => makeEnvironment({ scene, renderer }, envOpts),
      dispose() {
        scene.traverse(obj => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach(m => {
              Object.keys(m).forEach(k => {
                const v = m[k];
                if (v && v.isTexture) v.dispose();
              });
              m.dispose();
            });
          }
        });
        sceneTarget.dispose();
        accumTarget.dispose();
        bloomA.dispose();
        bloomB.dispose();
        ldrTarget.dispose();
        renderer.dispose();
      }
    };
  }

  /* ---------------- FX ---------------- */

  function rain(stage, opts) {
    const o = Object.assign({
      count: 5200,
      area: [18, 14, 18],
      color: 0xb8d8ff,
      opacity: 0.26,
      speed: [9, 17],
      length: [0.35, 0.85],
      slant: [0.08, 0.16],
      seed: 7,
      followCamera: true
    }, opts || {});
    const r = mulberry32(o.seed);
    const positions = new Float32Array(o.count * 6);
    const seeds = new Float32Array(o.count * 2);
    const ends = new Float32Array(o.count * 2);
    const [ax, ay, az] = o.area;
    for (let i = 0; i < o.count; i++) {
      const x = (r() - 0.5) * ax;
      const y = r() * ay;
      const z = (r() - 0.5) * az;
      const s = r();
      for (let k = 0; k < 2; k++) {
        const j = i * 2 + k;
        positions[j * 3] = x;
        positions[j * 3 + 1] = y;
        positions[j * 3 + 2] = z;
        seeds[j] = s;
        ends[j] = k;
      }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(positions, 3));
    geo.setAttribute('aSeed', new T.BufferAttribute(seeds, 1));
    geo.setAttribute('aEnd', new T.BufferAttribute(ends, 1));
    const uniforms = {
      uTime: { value: 0 },
      uColor: { value: new T.Color(o.color) },
      uOpacity: { value: o.opacity },
      uSpeed: { value: new T.Vector2(o.speed[0], o.speed[1]) },
      uLength: { value: new T.Vector2(o.length[0], o.length[1]) },
      uSlant: { value: new T.Vector2(o.slant[0], o.slant[1]) },
      uArea: { value: new T.Vector3(ax, ay, az) }
    };
    const mat = new T.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      vertexShader: `
        uniform float uTime;
        uniform vec2 uSpeed;
        uniform vec2 uLength;
        uniform vec2 uSlant;
        uniform vec3 uArea;
        attribute float aSeed;
        attribute float aEnd;
        varying float vFade;
        void main() {
          vec3 p = position;
          float speed = mix(uSpeed.x, uSpeed.y, fract(aSeed * 13.7));
          float y = mod(p.y - uTime * speed + aSeed * 97.0, uArea.y);
          p.y = y + aEnd * mix(uLength.x, uLength.y, fract(aSeed * 7.1));
          p.x += aEnd * uSlant.x + sin(uTime * 0.4 + aSeed * 6.28) * 0.05;
          p.z += aEnd * uSlant.y;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float edge = smoothstep(0.0, 0.12, abs(p.x) / (uArea.x * 0.5)) *
                       smoothstep(0.0, 0.12, abs(p.z) / (uArea.z * 0.5));
          vFade = (1.0 - edge) * (0.55 + 0.45 * fract(aSeed * 3.3));
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vFade;
        void main() {
          gl_FragColor = vec4(uColor, uOpacity * vFade);
        }
      `
    });
    const mesh = new T.LineSegments(geo, mat);
    mesh.frustumCulled = false;
    stage.addTimeUniform(uniforms.uTime);
    if (o.followCamera) {
      stage.onBeforeRender(() => {
        mesh.position.x = stage.camera.position.x;
        mesh.position.z = stage.camera.position.z;
        mesh.position.y = 0;
      });
    }
    return { mesh, uniforms };
  }

  function dust(stage, opts) {
    const o = Object.assign({
      count: 420,
      area: [12, 8, 12],
      color: 0xffe2b8,
      size: 0.035,
      opacity: 0.5,
      seed: 19,
      rise: 0.08
    }, opts || {});
    const r = mulberry32(o.seed);
    const pos = new Float32Array(o.count * 3);
    const seed = new Float32Array(o.count);
    for (let i = 0; i < o.count; i++) {
      pos[i * 3] = (r() - 0.5) * o.area[0];
      pos[i * 3 + 1] = r() * o.area[1];
      pos[i * 3 + 2] = (r() - 0.5) * o.area[2];
      seed[i] = r();
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new T.BufferAttribute(seed, 1));
    const uniforms = {
      uTime: { value: 0 },
      uColor: { value: new T.Color(o.color) },
      uSize: { value: o.size },
      uOpacity: { value: o.opacity },
      uArea: { value: new T.Vector3(o.area[0], o.area[1], o.area[2]) },
      uRise: { value: o.rise }
    };
    const mat = new T.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      vertexShader: `
        uniform float uTime;
        uniform float uSize;
        uniform vec3 uArea;
        uniform float uRise;
        attribute float aSeed;
        varying float vFade;
        void main() {
          vec3 p = position;
          p.y = mod(p.y + uTime * uRise * (0.4 + aSeed), uArea.y);
          p.x += sin(uTime * 0.35 + aSeed * 12.0) * 0.35;
          p.z += cos(uTime * 0.28 + aSeed * 9.0) * 0.35;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(uSize * 900.0 / max(-mv.z, 0.1), 1.0, 96.0);
          vFade = 0.35 + 0.65 * fract(aSeed * 5.7);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vFade;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float a = (1.0 - smoothstep(0.0, 0.5, length(d)));
          gl_FragColor = vec4(uColor, a * a * uOpacity * vFade);
        }
      `
    });
    const mesh = new T.Points(geo, mat);
    mesh.frustumCulled = false;
    stage.addTimeUniform(uniforms.uTime);
    return { mesh, uniforms };
  }

  function steam(stage, opts) {
    const o = Object.assign({
      count: 140,
      origin: [0, 0.4, 0],
      spread: [0.35, 0.35],
      height: 3.2,
      color: 0xd8e2ea,
      size: 0.55,
      opacity: 0.16,
      seed: 31
    }, opts || {});
    const r = mulberry32(o.seed);
    const pos = new Float32Array(o.count * 3);
    const seed = new Float32Array(o.count);
    for (let i = 0; i < o.count; i++) {
      pos[i * 3] = o.origin[0] + (r() - 0.5) * o.spread[0];
      pos[i * 3 + 1] = o.origin[1] + r() * o.height;
      pos[i * 3 + 2] = o.origin[2] + (r() - 0.5) * o.spread[1];
      seed[i] = r();
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new T.BufferAttribute(seed, 1));
    const uniforms = {
      uTime: { value: 0 },
      uColor: { value: new T.Color(o.color) },
      uSize: { value: o.size },
      uOpacity: { value: o.opacity },
      uOrigin: { value: new T.Vector3(o.origin[0], o.origin[1], o.origin[2]) },
      uHeight: { value: o.height }
    };
    const mat = new T.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: `
        uniform float uTime;
        uniform float uSize;
        uniform vec3 uOrigin;
        uniform float uHeight;
        attribute float aSeed;
        varying float vFade;
        void main() {
          vec3 p = position;
          float life = mod(uTime * (0.11 + aSeed * 0.1) + aSeed, 1.0);
          p.y = uOrigin.y + life * uHeight;
          p.x += sin(uTime * 0.5 + aSeed * 18.0) * (0.1 + life * 0.4);
          p.z += cos(uTime * 0.42 + aSeed * 12.0) * (0.1 + life * 0.35);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(uSize * (1.0 + life * 1.8) * 520.0 / max(-mv.z, 0.1), 2.0, 140.0);
          vFade = smoothstep(0.0, 0.15, life) * (1.0 - smoothstep(0.65, 1.0, life));
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vFade;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float a = (1.0 - smoothstep(0.05, 0.5, length(d)));
          gl_FragColor = vec4(uColor, a * a * uOpacity * vFade);
        }
      `
    });
    const mesh = new T.Points(geo, mat);
    mesh.frustumCulled = false;
    stage.addTimeUniform(uniforms.uTime);
    return { mesh, uniforms };
  }

  function splashes(stage, opts) {
    const o = Object.assign({
      count: 120,
      area: [14, 14],
      y: 0.015,
      color: 0xcfe6ff,
      size: 0.24,
      opacity: 0.5,
      seed: 43
    }, opts || {});
    const r = mulberry32(o.seed);
    const pos = new Float32Array(o.count * 3);
    const seed = new Float32Array(o.count);
    for (let i = 0; i < o.count; i++) {
      pos[i * 3] = (r() - 0.5) * o.area[0];
      pos[i * 3 + 1] = o.y;
      pos[i * 3 + 2] = (r() - 0.5) * o.area[1];
      seed[i] = r();
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new T.BufferAttribute(seed, 1));
    const tex = ringTexture(64, 'rgba(210,232,255,0.9)', 4);
    const uniforms = {
      uTime: { value: 0 },
      uMap: { value: tex },
      uColor: { value: new T.Color(o.color) },
      uSize: { value: o.size },
      uOpacity: { value: o.opacity }
    };
    const mat = new T.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      vertexShader: `
        uniform float uTime;
        uniform float uSize;
        attribute float aSeed;
        varying float vFade;
        void main() {
          vec3 p = position;
          float phase = fract(uTime * (0.9 + aSeed * 0.7) + aSeed);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(uSize * (0.4 + phase * 1.4) * 520.0 / max(-mv.z, 0.1), 1.0, 120.0);
          vFade = (1.0 - phase) * (1.0 - phase) * smoothstep(0.0, 0.12, phase);
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vFade;
        void main() {
          vec4 t = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(uColor, t.a * uOpacity * vFade);
        }
      `
    });
    const mesh = new T.Points(geo, mat);
    mesh.frustumCulled = false;
    stage.addTimeUniform(uniforms.uTime);
    return { mesh, uniforms };
  }

  function embers(stage, opts) {
    const o = Object.assign({
      count: 90,
      area: [2.4, 1.6],
      origin: [0, 0.1, 0],
      color: 0xff8a3c,
      size: 0.045,
      opacity: 0.85,
      speed: [0.25, 0.8],
      seed: 53
    }, opts || {});
    const r = mulberry32(o.seed);
    const pos = new Float32Array(o.count * 3);
    const seed = new Float32Array(o.count);
    for (let i = 0; i < o.count; i++) {
      pos[i * 3] = o.origin[0] + (r() - 0.5) * o.area[0];
      pos[i * 3 + 1] = o.origin[1] + r() * o.area[1];
      pos[i * 3 + 2] = o.origin[2] + (r() - 0.5) * o.area[0];
      seed[i] = r();
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new T.BufferAttribute(seed, 1));
    const uniforms = {
      uTime: { value: 0 },
      uColor: { value: new T.Color(o.color) },
      uSize: { value: o.size },
      uOpacity: { value: o.opacity },
      uSpeed: { value: new T.Vector2(o.speed[0], o.speed[1]) }
    };
    const mat = new T.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      vertexShader: `
        uniform float uTime;
        uniform float uSize;
        uniform vec2 uSpeed;
        attribute float aSeed;
        varying float vFade;
        void main() {
          vec3 p = position;
          float life = mod(uTime * mix(uSpeed.x, uSpeed.y, aSeed) + aSeed * 5.0, 1.0);
          p.y += life * 1.8;
          p.x += sin(uTime * 2.0 + aSeed * 20.0) * 0.15;
          p.z += cos(uTime * 1.7 + aSeed * 14.0) * 0.15;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(uSize * (1.0 - life * 0.6) * 700.0 / max(-mv.z, 0.1), 1.0, 96.0);
          vFade = (1.0 - smoothstep(0.6, 1.0, life)) * smoothstep(0.0, 0.1, life);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vFade;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float a = (1.0 - smoothstep(0.0, 0.5, length(d)));
          gl_FragColor = vec4(uColor, a * a * uOpacity * vFade);
        }
      `
    });
    const mesh = new T.Points(geo, mat);
    mesh.frustumCulled = false;
    stage.addTimeUniform(uniforms.uTime);
    return { mesh, uniforms };
  }

  function lightShaft(stage, opts) {
    const o = Object.assign({
      color: 0xffd9a6,
      opacity: 0.5,
      position: [0, 3.2, -2],
      scale: [2.6, 7.5],
      rotation: 0,
      seed: 61
    }, opts || {});
    const tex = beamTexture('rgba(255,214,160,0.9)');
    const mat = new T.SpriteMaterial({
      map: tex,
      color: new T.Color(o.color),
      transparent: true,
      opacity: o.opacity,
      blending: T.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      toneMapped: false
    });
    const sp = new T.Sprite(mat);
    sp.position.set(o.position[0], o.position[1], o.position[2]);
    sp.scale.set(o.scale[0], o.scale[1], 1);
    sp.material.rotation = o.rotation;
    stage.scene.add(sp);
    return sp;
  }

  function glowSprite(stage, opts) {
    const o = Object.assign({
      color: 0xff5a6e,
      opacity: 0.8,
      position: [0, 2, 0],
      size: 2,
      seed: 71
    }, opts || {});
    const tex = dotTexture(96, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    const mat = new T.SpriteMaterial({
      map: tex,
      color: new T.Color(o.color),
      transparent: true,
      opacity: o.opacity,
      blending: T.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    });
    const sp = new T.Sprite(mat);
    sp.position.set(o.position[0], o.position[1], o.position[2]);
    sp.scale.set(o.size, o.size, 1);
    stage.scene.add(sp);
    return sp;
  }

  /* ---------------- procedural materials ---------------- */

  function asphalt(opts) {
    const o = Object.assign({ seed: 5, size: 512, repeat: [3, 3] }, opts || {});
    const base = noiseCanvas(o.size, o.seed, 5);
    const ctx = base.getContext('2d');
    const r = mulberry32(o.seed + 1);
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 1400; i++) {
      const x = r() * o.size;
      const y = r() * o.size;
      const v = Math.round(20 + r() * 50);
      ctx.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
      const s = r() * 2.4 + 0.4;
      ctx.fillRect(x, y, s, s);
    }
    ctx.globalAlpha = 1;
    const normalSrc = noiseCanvas(o.size, o.seed + 2, 4);
    const nctx = normalSrc.getContext('2d');
    const nr = mulberry32(o.seed + 3);
    nctx.strokeStyle = 'rgba(0,0,0,0.8)';
    for (let i = 0; i < 22; i++) {
      nctx.lineWidth = 1 + nr() * 2;
      nctx.beginPath();
      let x = nr() * o.size;
      let y = nr() * o.size;
      nctx.moveTo(x, y);
      for (let k = 0; k < 8; k++) {
        x += (nr() - 0.5) * 90;
        y += nr() * 40;
        nctx.lineTo(x, y);
      }
      nctx.stroke();
    }
    const normal = heightToNormal(normalSrc, 1.6);
    const rough = noiseCanvas(o.size, o.seed + 4, 3);
    const rctx = rough.getContext('2d');
    const rr = mulberry32(o.seed + 5);
    rctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 70; i++) {
      const x = rr() * o.size;
      const y = rr() * o.size;
      const rad = 12 + rr() * 70;
      const g = rctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(0,0,0,0.95)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      rctx.fillStyle = g;
      rctx.beginPath();
      rctx.arc(x, y, rad, 0, TAU);
      rctx.fill();
    }
    return {
      map: canvasTexture(o.size, o.size, c => c.drawImage(base, 0, 0), { repeat: o.repeat, linear: false }),
      normalMap: canvasTexture(o.size, o.size, c => c.drawImage(normal, 0, 0), { repeat: o.repeat, linear: true }),
      roughnessMap: canvasTexture(o.size, o.size, c => c.drawImage(rough, 0, 0), { repeat: o.repeat, linear: true })
    };
  }

  function concrete(opts) {
    const o = Object.assign({ seed: 11, size: 512, repeat: [2, 2] }, opts || {});
    const base = noiseCanvas(o.size, o.seed, 5);
    const ctx = base.getContext('2d');
    const r = mulberry32(o.seed + 1);
    ctx.globalAlpha = 0.18;
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = r() > 0.5 ? '#000' : '#fff';
      ctx.fillRect(r() * o.size, r() * o.size, 20 + r() * 120, 2 + r() * 8);
    }
    ctx.globalAlpha = 1;
    return {
      map: canvasTexture(o.size, o.size, c => c.drawImage(base, 0, 0), { repeat: o.repeat }),
      normalMap: canvasTexture(o.size, o.size, c => c.drawImage(heightToNormal(base, 0.7), 0, 0), { repeat: o.repeat, linear: true })
    };
  }

  function brushedMetal(opts) {
    const o = Object.assign({ seed: 21, size: 512, repeat: [2, 2] }, opts || {});
    const c = document.createElement('canvas');
    c.width = c.height = o.size;
    const ctx = c.getContext('2d');
    const r = mulberry32(o.seed);
    ctx.fillStyle = '#8a8f96';
    ctx.fillRect(0, 0, o.size, o.size);
    for (let i = 0; i < 9000; i++) {
      const y = r() * o.size;
      const x = r() * o.size;
      const len = 8 + r() * 80;
      const v = Math.round(90 + r() * 90);
      ctx.strokeStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + (0.08 + r() * 0.2) + ')';
      ctx.lineWidth = 0.5 + r();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y);
      ctx.stroke();
    }
    return {
      map: canvasTexture(o.size, o.size, x => x.drawImage(c, 0, 0), { repeat: o.repeat }),
      normalMap: canvasTexture(o.size, o.size, x => x.drawImage(heightToNormal(c, 0.35), 0, 0), { repeat: o.repeat, linear: true })
    };
  }

  window.THREEKIT = {
    createStage,
    makeEnvironment,
    rng: mulberry32,
    clamp,
    lerp,
    smooth,
    canvasTexture,
    noiseCanvas,
    heightToNormal,
    dotTexture,
    ringTexture,
    beamTexture,
    textTexture,
    verticalTextTexture,
    fx: { rain, dust, steam, splashes, embers, lightShaft, glowSprite },
    materials: { asphalt, concrete, brushedMetal }
  };
})();
