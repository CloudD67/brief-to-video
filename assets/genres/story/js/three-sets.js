/* 霓虹雨巷布景：湿沥青、砖墙、窗、招牌、面摊、雨/蒸汽/水花、人物剪影。
   只负责搭景与道具；镜头、分镜与对白在 shot.js / film.js 里。 */
(function () {
  'use strict';
  const T = window.THREE;
  if (!T || !window.THREEKIT) {
    console.error('three-sets: 需要 three.min.js 与 three-kit.js');
    return;
  }
  const K = window.THREEKIT;
  const TAU = Math.PI * 2;

  function personTexture(kind) {
    const w = 640;
    const h = 1024;
    return K.canvasTexture(w, h, (ctx) => {
      ctx.clearRect(0, 0, w, h);
      const warm = 'rgba(255,176,108,';
      const cool = 'rgba(96,170,255,';
      const isOwner = kind === 'owner';
      const isMan = kind === 'man';
      const cx = w * 0.5;
      const headY = isOwner ? h * 0.25 : h * 0.29;
      const shoulderY = headY + h * 0.085;
      const hemY = h * 0.94;

      if (!isOwner) {
        const uw = w * 0.43;
        const uy = headY - h * 0.04;
        const canopy = ctx.createLinearGradient(cx - uw, 0, cx + uw, 0);
        canopy.addColorStop(0, isMan ? '#252b37' : '#2a1720');
        canopy.addColorStop(0.55, isMan ? '#171b23' : '#180c11');
        canopy.addColorStop(1, isMan ? '#333b47' : '#42202b');
        ctx.fillStyle = canopy;
        ctx.beginPath();
        ctx.moveTo(cx - uw, uy);
        ctx.quadraticCurveTo(cx - uw * 0.55, uy - h * 0.14, cx, uy - h * 0.15);
        ctx.quadraticCurveTo(cx + uw * 0.55, uy - h * 0.14, cx + uw, uy);
        ctx.quadraticCurveTo(cx, uy + h * 0.045, cx - uw, uy);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,188,130,0.34)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(cx + uw * 0.18, uy - h * 0.061);
        ctx.quadraticCurveTo(cx + uw * 0.63, uy - h * 0.105, cx + uw, uy);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(120,180,255,0.22)';
        ctx.beginPath();
        ctx.moveTo(cx - uw * 0.2, uy - h * 0.05);
        ctx.quadraticCurveTo(cx - uw * 0.6, uy - h * 0.1, cx - uw, uy);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(160,170,185,0.25)';
        ctx.lineWidth = 1.4;
        for (let i = -3; i <= 3; i++) {
          ctx.beginPath();
          ctx.moveTo(cx + i * uw * 0.22, uy - h * 0.13 + Math.abs(i) * 8);
          ctx.quadraticCurveTo(cx + i * uw * 0.25, uy - h * 0.03, cx + i * uw * 0.28, uy + h * 0.02);
          ctx.stroke();
        }
        ctx.strokeStyle = '#252b33';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(cx, uy + h * 0.03);
        ctx.lineTo(cx, shoulderY + h * 0.05);
        ctx.stroke();
      }

      const bodyTop = shoulderY;
      const shoulderW = w * (isOwner ? 0.185 : 0.2);
      const waistW = w * 0.17;
      const hemW = w * 0.255;
      const grad = ctx.createLinearGradient(cx - hemW, 0, cx + hemW, 0);
      grad.addColorStop(0, isMan ? '#2a3140' : isOwner ? '#333941' : '#2b3140');
      grad.addColorStop(0.52, isMan ? '#1d222c' : isOwner ? '#272c33' : '#1e232d');
      grad.addColorStop(1, isMan ? '#333c4a' : isOwner ? '#40464e' : '#3b2430');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(cx - shoulderW, bodyTop + h * 0.01);
      ctx.quadraticCurveTo(cx - shoulderW * 0.9, bodyTop - h * 0.006, cx - shoulderW * 0.46, bodyTop - h * 0.006);
      ctx.lineTo(cx + shoulderW * 0.46, bodyTop - h * 0.006);
      ctx.quadraticCurveTo(cx + shoulderW * 0.9, bodyTop - h * 0.006, cx + shoulderW, bodyTop + h * 0.01);
      ctx.quadraticCurveTo(cx + shoulderW * 1.18, bodyTop + h * 0.05, cx + waistW * 1.12, bodyTop + h * 0.2);
      ctx.quadraticCurveTo(cx + waistW * 1.08, bodyTop + h * 0.46, cx + hemW, hemY);
      ctx.lineTo(cx - hemW, hemY);
      ctx.quadraticCurveTo(cx - waistW * 1.08, bodyTop + h * 0.46, cx - waistW * 1.16, bodyTop + h * 0.2);
      ctx.quadraticCurveTo(cx - shoulderW * 1.18, bodyTop + h * 0.05, cx - shoulderW, bodyTop + h * 0.01);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = isOwner ? '#2a3037' : '#1a2029';
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.052, bodyTop + h * 0.002);
      ctx.lineTo(cx, bodyTop + h * 0.034);
      ctx.lineTo(cx + w * 0.052, bodyTop + h * 0.002);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, bodyTop + h * 0.1);
      ctx.lineTo(cx, hemY - h * 0.02);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.045)';
      ctx.lineWidth = 2;
      [-0.55, -0.25, 0.3, 0.6].forEach((p, i) => {
        ctx.beginPath();
        ctx.moveTo(cx + shoulderW * p, bodyTop + h * 0.14);
        ctx.quadraticCurveTo(cx + waistW * p * 1.1, bodyTop + h * 0.5, cx + hemW * p * 0.9, hemY - h * 0.01);
        ctx.stroke();
      });
      ctx.strokeStyle = 'rgba(6,8,12,0.5)';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(cx - waistW * 1.12, bodyTop + h * 0.3);
      ctx.quadraticCurveTo(cx, bodyTop + h * 0.33, cx + waistW * 1.1, bodyTop + h * 0.3);
      ctx.stroke();
      if (!isOwner) {
        ctx.fillStyle = isMan ? 'rgba(92,112,142,0.45)' : 'rgba(156,98,82,0.5)';
        ctx.beginPath();
        ctx.ellipse(cx, shoulderY + h * 0.012, w * 0.072, h * 0.017, 0, 0, TAU);
        ctx.fill();
      }

      if (isOwner) {
        ctx.fillStyle = 'rgba(200,189,170,0.3)';
        ctx.beginPath();
        ctx.moveTo(cx + shoulderW * 0.36, bodyTop + h * 0.004);
        ctx.quadraticCurveTo(cx + shoulderW * 0.64, bodyTop + h * 0.1, cx + shoulderW * 0.5, bodyTop + h * 0.2);
        ctx.lineTo(cx + shoulderW * 0.22, bodyTop + h * 0.19);
        ctx.quadraticCurveTo(cx + shoulderW * 0.36, bodyTop + h * 0.1, cx + shoulderW * 0.18, bodyTop + h * 0.006);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(222,211,192,0.26)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx + shoulderW * 0.52, bodyTop + h * 0.1);
        ctx.quadraticCurveTo(cx + shoulderW * 0.56, bodyTop + h * 0.15, cx + shoulderW * 0.48, bodyTop + h * 0.19);
        ctx.stroke();
      }

      ctx.strokeStyle = isOwner ? '#2c3138' : '#1c222c';
      ctx.lineWidth = 22;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - shoulderW * 0.92, shoulderY + h * 0.055);
      ctx.quadraticCurveTo(cx - waistW * 1.28, shoulderY + h * 0.2, cx - waistW * 1.05, hemY - h * 0.07);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + shoulderW * 0.92, shoulderY + h * 0.055);
      ctx.quadraticCurveTo(cx + waistW * 1.24, shoulderY + h * 0.2, cx + waistW * 1.02, hemY - h * 0.07);
      ctx.stroke();

      if (!isOwner) {
        ctx.fillStyle = isMan ? '#131822' : '#141017';
        ctx.beginPath();
        ctx.ellipse(cx, headY + h * 0.038, w * 0.082, h * 0.058, 0, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = isOwner ? '#4a3b2a' : isMan ? '#2c231c' : '#281c17';
      ctx.fillRect(cx - w * 0.026, headY + h * 0.036, w * 0.052, h * 0.046);
      ctx.fillStyle = isOwner ? '#54432f' : isMan ? '#332a22' : '#2e211b';
      ctx.beginPath();
      ctx.ellipse(cx, headY, w * 0.062, h * 0.054, 0, 0, TAU);
      ctx.fill();
      const cheek = ctx.createRadialGradient(cx + w * 0.012, headY - h * 0.012, 2, cx, headY, w * 0.06);
      cheek.addColorStop(0, isOwner ? 'rgba(255,206,158,0.3)' : 'rgba(255,188,140,0.14)');
      cheek.addColorStop(1, 'rgba(255,180,130,0)');
      ctx.fillStyle = cheek;
      ctx.beginPath();
      ctx.ellipse(cx, headY, w * 0.062, h * 0.054, 0, 0, TAU);
      ctx.fill();
      const eyeY = headY - h * 0.004;
      ctx.fillStyle = 'rgba(14,10,9,0.8)';
      ctx.beginPath();
      ctx.ellipse(cx - w * 0.017, eyeY, w * 0.0055, h * 0.0042, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + w * 0.017, eyeY, w * 0.0055, h * 0.0042, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(14,10,9,0.4)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.026, eyeY - h * 0.012);
      ctx.quadraticCurveTo(cx - w * 0.017, eyeY - h * 0.016, cx - w * 0.008, eyeY - h * 0.012);
      ctx.moveTo(cx + w * 0.008, eyeY - h * 0.012);
      ctx.quadraticCurveTo(cx + w * 0.017, eyeY - h * 0.016, cx + w * 0.026, eyeY - h * 0.012);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(18,12,10,0.28)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + w * 0.002, eyeY + h * 0.006);
      ctx.quadraticCurveTo(cx - w * 0.004, headY + h * 0.016, cx, headY + h * 0.019);
      ctx.stroke();
      ctx.strokeStyle = isOwner ? 'rgba(52,30,22,0.45)' : 'rgba(60,30,26,0.4)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.012, headY + h * 0.031);
      ctx.quadraticCurveTo(cx, headY + h * 0.035, cx + w * 0.012, headY + h * 0.031);
      ctx.stroke();
      if (isOwner) {
        ctx.fillStyle = 'rgba(70,58,44,0.22)';
        ctx.beginPath();
        ctx.ellipse(cx, headY + h * 0.036, w * 0.044, h * 0.02, 0, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = isOwner ? '#241f1a' : '#171219';
      ctx.beginPath();
      ctx.ellipse(cx, headY - h * 0.015, w * 0.072, h * 0.05, 0, Math.PI, TAU);
      ctx.fill();
      if (isOwner) {
        ctx.fillStyle = 'rgba(216,207,190,0.5)';
        ctx.beginPath();
        ctx.ellipse(cx, headY - h * 0.04, w * 0.064, h * 0.012, 0, Math.PI, TAU);
        ctx.fill();
      }

      ctx.fillStyle = '#12161d';
      ctx.fillRect(cx - hemW * 0.52, hemY - h * 0.008, hemW * 0.36, h * 0.065);
      ctx.fillRect(cx + hemW * 0.16, hemY - h * 0.008, hemW * 0.38, h * 0.065);

      ctx.globalCompositeOperation = 'source-atop';
      const keyLight = ctx.createLinearGradient(0, headY - h * 0.14, 0, hemY);
      keyLight.addColorStop(0, 'rgba(255,214,176,0.1)');
      keyLight.addColorStop(0.42, 'rgba(255,190,142,0.03)');
      keyLight.addColorStop(1, 'rgba(4,6,10,0.18)');
      ctx.fillStyle = keyLight;
      ctx.fillRect(0, 0, w, h);
      const coatShade = ctx.createLinearGradient(cx - hemW, 0, cx + hemW, 0);
      coatShade.addColorStop(0, 'rgba(0,0,0,0.3)');
      coatShade.addColorStop(0.38, 'rgba(0,0,0,0)');
      coatShade.addColorStop(0.72, 'rgba(255,206,164,0.05)');
      coatShade.addColorStop(1, 'rgba(255,196,148,0.13)');
      ctx.fillStyle = coatShade;
      ctx.fillRect(0, 0, w, h);
      const edgeWarm = ctx.createLinearGradient(cx + hemW * 0.7, 0, cx + hemW, 0);
      edgeWarm.addColorStop(0, warm + '0)');
      edgeWarm.addColorStop(0.55, warm + '0.04)');
      edgeWarm.addColorStop(1, warm + '0.22)');
      ctx.fillStyle = edgeWarm;
      ctx.fillRect(0, 0, w, h);
      const edgeCool = ctx.createLinearGradient(cx - hemW, 0, cx - hemW * 0.72, 0);
      edgeCool.addColorStop(0, cool + '0.16)');
      edgeCool.addColorStop(0.5, cool + '0.02)');
      edgeCool.addColorStop(1, cool + '0)');
      ctx.fillStyle = edgeCool;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(255,196,140,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + shoulderW * 1.02, bodyTop + h * 0.02);
      ctx.quadraticCurveTo(cx + waistW * 1.12, bodyTop + h * 0.3, cx + hemW * 0.96, hemY - h * 0.02);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(140,190,255,0.18)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(cx - shoulderW * 1.0, bodyTop + h * 0.03);
      ctx.quadraticCurveTo(cx - waistW * 1.14, bodyTop + h * 0.34, cx - hemW * 0.94, hemY - h * 0.03);
      ctx.stroke();
    }, { clamp: true });
  }

  function neonMaterial(text, color, opts) {
    const o = opts || {};
    const chars = Array.from(String(text));
    const isAscii = /^[\x00-\x7F]+$/.test(text);
    const size = isAscii ? 132 : 150;
    const w = 256;
    const h = 860;
    const tex = K.canvasTexture(w, h, (ctx) => {
      ctx.clearRect(0, 0, w, h);
      ctx.font = '800 ' + size + 'px "PingFang SC","Noto Sans SC","Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lh = size * 1.14;
      const y0 = h / 2 - (chars.length - 1) * lh / 2;
      const hex = '#' + new T.Color(color).getHexString();
      ctx.shadowColor = hex;
      ctx.shadowBlur = o.glowBlur || 26;
      ctx.fillStyle = hex;
      ctx.globalAlpha = 0.9;
      chars.forEach((c, i) => ctx.fillText(c, w / 2, y0 + i * lh));
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      chars.forEach((c, i) => ctx.fillText(c, w / 2, y0 + i * lh));
    }, { clamp: true });
    const mat = new T.MeshBasicMaterial({
      map: tex,
      transparent: true,
      blending: T.AdditiveBlending,
      depthWrite: false,
      side: T.DoubleSide,
      toneMapped: false
    });
    mat.userData.baseColor = new T.Color(0xffffff);
    return mat;
  }

  function windowTexture(seed, color) {
    const r = K.rng(seed);
    return K.canvasTexture(128, 192, (ctx, w, h) => {
      ctx.fillStyle = '#07090d';
      ctx.fillRect(0, 0, w, h);
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(12,16,22,0.9)');
      ctx.fillStyle = g;
      ctx.fillRect(4, 4, w - 8, h - 8);
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 5;
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.beginPath();
      ctx.moveTo(w / 2, 4);
      ctx.lineTo(w / 2, h - 4);
      ctx.stroke();
      ctx.fillStyle = 'rgba(5,7,10,0.72)';
      for (let i = 0; i < 3 + Math.floor(r() * 4); i++) {
        const bw = 12 + r() * 24;
        ctx.fillRect(8 + r() * (w - bw - 16), 8 + r() * 40, bw, 30 + r() * 80);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(4, 12, w - 8, 2);
    }, { clamp: true });
  }

  function buildNeonAlley(stage, opts) {
    const o = Object.assign({
      stall: true,
      characters: true,
      rain: true,
      fog: 0.019,
      background: 0x05070c,
      exposure: 1.08
    }, opts || {});

    stage.scene.fog.color.set(o.background);
    stage.scene.fog.density = o.fog;
    stage.renderer.setClearColor(o.background, 1);
    stage.scene.background = new T.Color(o.background);
    stage.post.exposure = o.exposure;
    stage.makeEnvironment({ top: 0x05080e, bottom: 0x0c0808, neonA: 0xff3f6d, neonB: 0x3fc8ff, intensity: 0.7 });

    stage.addHemisphere({ sky: 0x3a4f6b, ground: 0x1a100b, intensity: 0.95 });
    const key = stage.addDirectional({
      color: 0xa9c2ff,
      intensity: 1.85,
      position: [-5.5, 9, 5],
      range: 13,
      mapSize: 2048
    });
    key.target.position.set(0, 1.2, -5);
    stage.addDirectional({ color: 0xff9a6a, intensity: 0.8, position: [6, 4, -6], shadow: false });
    stage.addPoint({ color: 0xffc08a, intensity: 4.5, distance: 9, position: [0, 3.2, -6] });
    stage.addPoint({ color: 0x6fb8ff, intensity: 3.2, distance: 8, position: [1.5, 3.0, -11] });

    const asphalt = K.materials.asphalt({ seed: 17, repeat: [3, 6], size: 512 });
    const concrete = K.materials.concrete({ seed: 23, repeat: [2, 4], size: 512 });
    const metal = K.materials.brushedMetal({ seed: 29, repeat: [2, 2], size: 256 });

    const ground = new T.Mesh(
      new T.PlaneGeometry(11, 34),
      new T.MeshStandardMaterial({
        color: 0x17181c,
        map: asphalt.map,
        normalMap: asphalt.normalMap,
        normalScale: new T.Vector2(0.42, 0.42),
        roughnessMap: asphalt.roughnessMap,
        roughness: 0.55,
        metalness: 0.3,
        envMapIntensity: 1.0
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, -7);
    ground.receiveShadow = true;
    stage.scene.add(ground);

    const wallMat = new T.MeshStandardMaterial({
      color: 0x35353c,
      map: concrete.map,
      normalMap: concrete.normalMap,
      normalScale: new T.Vector2(0.55, 0.55),
      roughness: 0.82,
      metalness: 0.08,
      envMapIntensity: 0.9
    });
    const wallGeo = new T.BoxGeometry(0.55, 11, 32);
    const leftWall = new T.Mesh(wallGeo, wallMat);
    leftWall.position.set(-4.05, 5.5, -7);
    leftWall.receiveShadow = true;
    stage.scene.add(leftWall);
    const rightWall = new T.Mesh(wallGeo, wallMat);
    rightWall.position.set(4.05, 5.5, -7);
    rightWall.receiveShadow = true;
    stage.scene.add(rightWall);

    const back = new T.Mesh(new T.BoxGeometry(9, 11, 0.7), wallMat);
    back.position.set(0, 5.5, -18);
    back.receiveShadow = true;
    stage.scene.add(back);

    const doorTex = K.canvasTexture(256, 512, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(255,196,132,0.95)');
      g.addColorStop(0.45, 'rgba(255,156,92,0.65)');
      g.addColorStop(1, 'rgba(30,16,12,0.95)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(10,8,7,0.85)';
      ctx.fillRect(0, 0, 22, h);
      ctx.fillRect(w - 22, 0, 22, h);
      ctx.fillRect(0, 0, w, 18);
      ctx.fillStyle = 'rgba(12,9,7,0.55)';
      ctx.fillRect(w * 0.48, h * 0.1, 8, h * 0.8);
    }, { clamp: true });
    const door = new T.Mesh(new T.PlaneGeometry(1.45, 2.75), new T.MeshBasicMaterial({
      map: doorTex, toneMapped: false, color: new T.Color(0xffffff)
    }));
    door.position.set(-0.55, 1.38, -17.62);
    stage.scene.add(door);
    stage.addPoint({ color: 0xff9a55, intensity: 5, distance: 7, position: [-0.55, 1.8, -16.6] });

    const darkMetal = new T.MeshStandardMaterial({
      color: 0x15181d,
      map: metal.map,
      normalMap: metal.normalMap,
      roughness: 0.52,
      metalness: 0.75,
      envMapIntensity: 1.2
    });

    const lampGroup = new T.Group();
    const arm = new T.Mesh(new T.CylinderGeometry(0.032, 0.032, 1.55, 8), darkMetal);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(3.15, 4.42, -0.2);
    lampGroup.add(arm);
    const shade = new T.Mesh(new T.ConeGeometry(0.24, 0.22, 20, 1, true), new T.MeshStandardMaterial({
      color: 0x20242b, roughness: 0.45, metalness: 0.7, side: T.DoubleSide
    }));
    shade.position.set(2.4, 4.28, -0.2);
    lampGroup.add(shade);
    const bulb = new T.Mesh(new T.SphereGeometry(0.075, 12, 8), new T.MeshBasicMaterial({
      color: new T.Color(0xffd9a0).multiplyScalar(4), toneMapped: false
    }));
    bulb.position.set(2.4, 4.19, -0.2);
    lampGroup.add(bulb);
    stage.scene.add(lampGroup);
    stage.addPoint({ color: 0xffc188, intensity: 11, distance: 9, position: [2.4, 4.15, -0.2] });

    const winColors = ['rgba(255,186,110,0.95)', 'rgba(120,190,255,0.85)', 'rgba(255,120,150,0.8)', 'rgba(30,42,56,0.9)'];
    const winGeo = new T.PlaneGeometry(0.72, 1.05);
    [ -3.74, 3.74 ].forEach((x, side) => {
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 4; col++) {
          const color = winColors[Math.floor(K.rng(side * 70 + row * 11 + col)() * winColors.length)];
          const tex = windowTexture(side * 50 + row * 9 + col, color);
          const mat = new T.MeshBasicMaterial({ map: tex, color: new T.Color(0xb8b8b8), toneMapped: false });
          const win = new T.Mesh(winGeo, mat);
          win.position.set(x, 2.7 + row * 1.55, -1.5 - col * 3.6);
          win.rotation.y = side ? -Math.PI / 2 : Math.PI / 2;
          stage.scene.add(win);
          const sill = new T.Mesh(new T.BoxGeometry(0.1, 0.06, 0.9), darkMetal);
          sill.position.set(x + (side ? -0.03 : 0.03), win.position.y - 0.58, win.position.z);
          stage.scene.add(sill);
        }
      }
    });

    const acGeo = new T.BoxGeometry(0.62, 0.55, 0.42);
    const fanGeo = new T.CircleGeometry(0.17, 20);
    for (let i = 0; i < 7; i++) {
      const side = i % 2 ? 1 : -1;
      const ac = new T.Mesh(acGeo, darkMetal);
      ac.position.set(side * 3.6, 3.1 + (i % 3) * 1.4, -2 - Math.floor(i / 2) * 4.2);
      ac.castShadow = true;
      stage.scene.add(ac);
      const fan = new T.Mesh(fanGeo, new T.MeshStandardMaterial({ color: 0x0b0d11, roughness: 0.7, metalness: 0.6 }));
      fan.position.copy(ac.position);
      fan.position.x += side * -0.32;
      fan.rotation.y = side ? -Math.PI / 2 : Math.PI / 2;
      stage.scene.add(fan);
      const pipe = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 1.7, 8), darkMetal);
      pipe.position.set(side * 3.7, ac.position.y - 1.1, ac.position.z);
      stage.scene.add(pipe);
    }

    const cableMat = new T.MeshStandardMaterial({ color: 0x07080a, roughness: 0.9, metalness: 0 });
    for (let i = 0; i < 4; i++) {
      const z = -2 - i * 4.3;
      const curve = new T.CatmullRomCurve3([
        new T.Vector3(-4, 6.1 + i * 0.09, z),
        new T.Vector3(-1.4, 5.6 + i * 0.05, z + 0.35),
        new T.Vector3(1.3, 5.8 + i * 0.03, z - 0.2),
        new T.Vector3(4, 6.2 + i * 0.08, z)
      ]);
      const tube = new T.Mesh(new T.TubeGeometry(curve, 36, 0.018, 5, false), cableMat);
      stage.scene.add(tube);
    }

    const signSpecs = [
      { text: '夜面', color: 0xff3158, x: -3.68, y: 3.4, z: -3.2, rot: Math.PI / 2, w: 0.95, h: 3.1 },
      { text: '雨', color: 0x41d6ff, x: 3.68, y: 4.6, z: -6.2, rot: -Math.PI / 2, w: 0.85, h: 2.4 },
      { text: '24H', color: 0xffd25e, x: 3.68, y: 2.9, z: -10.5, rot: -Math.PI / 2, w: 0.8, h: 1.8 },
      { text: '酒', color: 0xb46bff, x: -3.68, y: 3.1, z: -11.3, rot: Math.PI / 2, w: 0.75, h: 2.0 },
      { text: '一碗热汤', color: 0xff7a3c, x: -3.68, y: 2.6, z: 2.0, rot: Math.PI / 2, w: 0.9, h: 2.8 }
    ];
    const neonMats = [];
    signSpecs.forEach((s, i) => {
      const mat = neonMaterial(s.text, s.color);
      const sign = new T.Mesh(new T.PlaneGeometry(s.w, s.h), mat);
      sign.position.set(s.x, s.y, s.z);
      sign.rotation.y = s.rot;
      stage.scene.add(sign);
      const back = new T.Mesh(new T.PlaneGeometry(s.w * 1.16, s.h * 1.08), new T.MeshStandardMaterial({
        color: 0x08090c, roughness: 0.85, metalness: 0.2
      }));
      back.position.set(s.x + (s.x > 0 ? 0.03 : -0.03), s.y, s.z);
      back.rotation.y = s.rot;
      stage.scene.add(back);
      neonMats.push(mat);
      stage.addPoint({ color: s.color, intensity: 4 + i * 0.6, distance: 6, position: [s.x + (s.x > 0 ? -0.5 : 0.5), s.y, s.z] });
      K.fx.glowSprite(stage, { color: s.color, position: [s.x + (s.x > 0 ? -0.18 : 0.18), s.y, s.z], size: s.w * 1.3, opacity: 0.08 });
    });

    const reflectionTex = K.canvasTexture(160, 320, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h * 0.38, 0, w / 2, h * 0.38, w * 0.56);
      g.addColorStop(0, 'rgba(255,255,255,0.72)');
      g.addColorStop(0.38, 'rgba(255,255,255,0.2)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }, { clamp: true });
    signSpecs.forEach(s => {
      const mat = new T.MeshBasicMaterial({
        map: reflectionTex,
        color: new T.Color(s.color).multiplyScalar(1.3),
        transparent: true,
        opacity: 0.11,
        blending: T.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      });
      const strip = new T.Mesh(new T.PlaneGeometry(s.w * 1.5, 5.5), mat);
      strip.rotation.x = -Math.PI / 2;
      strip.rotation.z = s.x > 0 ? -0.06 : 0.06;
      strip.position.set(s.x * 0.62, 0.012, s.z + 1.8);
      stage.scene.add(strip);
    });

    const puddleMat = new T.MeshPhysicalMaterial({
      color: 0x020305,
      roughness: 0.16,
      metalness: 0.55,
      clearcoat: 0.55,
      clearcoatRoughness: 0.12,
      envMapIntensity: 0.55,
      normalMap: asphalt.normalMap,
      normalScale: new T.Vector2(0.1, 0.1),
      transparent: true,
      opacity: 0.94
    });
    const puddles = [];
    [
      [2.0, 0.018, 0.4, 0.55], [-1.9, 0.017, -1.2, 0.7], [0.2, 0.016, -6.5, 1.15],
      [-2.5, 0.015, -9.5, 0.85], [2.4, 0.015, -4.2, 0.75], [0.8, 0.014, -13.5, 1.0]
    ].forEach(([x, y, z, r], i) => {
      const p = new T.Mesh(new T.CircleGeometry(r, 40), puddleMat);
      p.rotation.x = -Math.PI / 2;
      p.position.set(x, y, z);
      p.scale.set(1, 0.55, 1);
      p.userData.seed = i;
      stage.scene.add(p);
      puddles.push(p);
    });

    const poolTex = K.canvasTexture(192, 192, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,190,130,0.55)');
      g.addColorStop(0.5, 'rgba(255,150,90,0.16)');
      g.addColorStop(1, 'rgba(255,150,90,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }, { clamp: true });
    const pool = new T.Mesh(new T.PlaneGeometry(4.6, 3.2), new T.MeshBasicMaterial({
      map: poolTex, transparent: true, opacity: 0.3, blending: T.AdditiveBlending,
      depthWrite: false, toneMapped: false
    }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0.9, 0.011, -1.7);
    stage.scene.add(pool);

    const crates = new T.Group();
    for (let i = 0; i < 4; i++) {
      const c = new T.Mesh(new T.BoxGeometry(0.55, 0.42, 0.55), darkMetal);
      c.position.set(-3.2 + (i % 2) * 0.5, 0.21 + Math.floor(i / 2) * 0.42, 1.2 - Math.floor(i / 2) * 0.1);
      c.rotation.y = i * 0.2;
      c.castShadow = true;
      c.receiveShadow = true;
      crates.add(c);
    }
    stage.scene.add(crates);

    const bin = new T.Mesh(new T.CylinderGeometry(0.32, 0.28, 0.85, 14), darkMetal);
    bin.position.set(3.1, 0.43, 0.4);
    bin.castShadow = true;
    stage.scene.add(bin);

    let stall = null;
    if (o.stall) {
      stall = new T.Group();
      const wood = new T.MeshStandardMaterial({
        color: 0x2c1c12,
        map: metal.map,
        normalMap: metal.normalMap,
        roughness: 0.62,
        metalness: 0.12,
        envMapIntensity: 0.6
      });
      const counter = new T.Mesh(new T.BoxGeometry(2.5, 0.92, 0.82), wood);
      counter.position.set(0.9, 0.46, -2.55);
      counter.castShadow = true;
      counter.receiveShadow = true;
      stall.add(counter);
      const top = new T.Mesh(new T.BoxGeometry(2.7, 0.07, 0.95), new T.MeshStandardMaterial({
        color: 0x5a3f2e, map: metal.map, normalMap: metal.normalMap, roughness: 0.66, metalness: 0.1, envMapIntensity: 0.4
      }));
      top.position.set(0.9, 0.955, -2.55);
      top.castShadow = true;
      top.receiveShadow = true;
      stall.add(top);

      const poleMat = new T.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.6, metalness: 0.65 });
      [-0.35, 2.15].forEach(x => {
        const pole = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 2.9, 10), poleMat);
        pole.position.set(x, 1.45, -2.15);
        stall.add(pole);
      });
      const awning = new T.Mesh(new T.BoxGeometry(3.0, 0.06, 1.9), new T.MeshStandardMaterial({
        color: 0x5d1d22, roughness: 0.82, metalness: 0.02
      }));
      awning.position.set(0.9, 2.72, -2.15);
      awning.rotation.x = 0.12;
      awning.castShadow = true;
      stall.add(awning);

      const lanternMat = new T.MeshStandardMaterial({
        color: 0xff9a55, emissive: 0xff6a28, emissiveIntensity: 1.6, roughness: 0.5
      });
      for (let i = 0; i < 3; i++) {
        const lantern = new T.Mesh(new T.SphereGeometry(0.105, 16, 12), lanternMat);
        lantern.scale.y = 1.25;
        lantern.position.set(0.0 + i * 0.9, 2.46, -1.9);
        stall.add(lantern);
        const cord = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 0.3, 6), poleMat);
        cord.position.set(lantern.position.x, lantern.position.y + 0.25, lantern.position.z);
        stall.add(cord);
      }
      const backPanel = new T.Mesh(new T.BoxGeometry(4.6, 2.6, 0.08), new T.MeshStandardMaterial({
        color: 0x181b20, roughness: 0.92, metalness: 0.05
      }));
      backPanel.position.set(0.9, 1.5, -4.15);
      stall.add(backPanel);
      const shelfMat = new T.MeshStandardMaterial({
        color: 0x3a2a1e, map: metal.map, normalMap: metal.normalMap, roughness: 0.7, metalness: 0.1
      });
      [1.32, 1.78].forEach((y) => {
        const shelf = new T.Mesh(new T.BoxGeometry(2.7, 0.055, 0.3), shelfMat);
        shelf.position.set(0.9, y, -4.0);
        shelf.castShadow = true;
        stall.add(shelf);
      });
      const jarGeo = new T.CylinderGeometry(0.085, 0.075, 0.24, 12);
      const jarMats = [
        new T.MeshStandardMaterial({ color: 0x8a5a2c, roughness: 0.3, metalness: 0.05 }),
        new T.MeshStandardMaterial({ color: 0xb8b0a2, roughness: 0.42, metalness: 0.02 }),
        new T.MeshStandardMaterial({ color: 0x5a6a52, roughness: 0.35, metalness: 0.05 })
      ];
      for (let i = 0; i < 7; i++) {
        const jar = new T.Mesh(jarGeo, jarMats[i % 3]);
        jar.position.set(-0.15 + i * 0.36, (i % 2 ? 1.9 : 1.44), -3.98);
        jar.castShadow = true;
        stall.add(jar);
      }
      const strip = new T.Mesh(new T.BoxGeometry(2.4, 0.035, 0.035), new T.MeshBasicMaterial({
        color: 0xffb070, toneMapped: false
      }));
      strip.position.set(0.9, 2.08, -3.94);
      stall.add(strip);
      stage.addPoint({ color: 0xffab68, intensity: 3.2, distance: 4.2, position: [0.9, 2.0, -3.8] });
      stage.addPoint({ color: 0xff9a55, intensity: 3.6, distance: 5.5, position: [0.9, 2.3, -1.9] });
      stage.addSpot({
        color: 0xffc089, intensity: 20, position: [0.9, 4.2, -1.2],
        target: [0.9, 0.8, -2.7], angle: 0.68, penumbra: 0.85, distance: 11, decay: 2,
        shadow: true
      });

      const bowlMat = new T.MeshStandardMaterial({ color: 0xb4aea2, roughness: 0.5, metalness: 0.03 });
      const noodleTex = K.canvasTexture(256, 256, (ctx, w, h) => {
        const g = ctx.createRadialGradient(w * 0.42, h * 0.36, 10, w * 0.5, h * 0.5, w * 0.56);
        g.addColorStop(0, '#8a4a20');
        g.addColorStop(0.62, '#55280f');
        g.addColorStop(1, '#2f1408');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.lineCap = 'round';
        for (let i = 0; i < 22; i++) {
          const y = 42 + (i / 21) * 172 + Math.sin(i * 1.7) * 6;
          ctx.strokeStyle = 'rgba(230,199,148,' + (0.5 + (i % 3) * 0.13).toFixed(2) + ')';
          ctx.lineWidth = 4.5 + (i % 4);
          ctx.beginPath();
          ctx.moveTo(26 + (i % 5) * 6, y);
          ctx.bezierCurveTo(w * 0.35, y - 18, w * 0.62, y + 20, w - 30 - (i % 4) * 8, y + Math.sin(i) * 8);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(244,231,199,0.92)';
        ctx.beginPath();
        ctx.ellipse(84, 122, 26, 20, -0.3, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(242,186,70,0.95)';
        ctx.beginPath();
        ctx.ellipse(84, 122, 13, 10, -0.3, 0, TAU);
        ctx.fill();
        [[168, 92], [196, 124], [150, 152], [184, 170]].forEach(([x, y]) => {
          ctx.fillStyle = 'rgba(126,176,92,0.9)';
          ctx.beginPath();
          ctx.ellipse(x, y, 7, 4, 0.6, 0, TAU);
          ctx.fill();
        });
      }, { clamp: true });
      const soupMat = new T.MeshStandardMaterial({
        map: noodleTex, roughness: 0.34, metalness: 0.05,
        emissive: 0x2c1206, emissiveIntensity: 0.45
      });
      [0.95, 1.42].forEach((x, i) => {
        const bowl = new T.Mesh(new T.CylinderGeometry(0.16, 0.11, 0.09, 20), bowlMat);
        bowl.position.set(x, 1.04, -2.55);
        stall.add(bowl);
        const soup = new T.Mesh(new T.CircleGeometry(0.13, 20), soupMat);
        soup.rotation.x = -Math.PI / 2;
        soup.rotation.z = i * 1.9;
        soup.position.set(bowl.position.x, 1.088, bowl.position.z);
        stall.add(soup);
        const steam = K.fx.steam(stage, {
          count: 26, origin: [bowl.position.x, 1.1, bowl.position.z],
          spread: [0.12, 0.12], height: 1.0, size: 0.11, opacity: 0.08, seed: 90 + i
        });
        stall.add(steam.mesh);
      });

      const stickMat = new T.MeshStandardMaterial({ color: 0x8a7258, roughness: 0.66, metalness: 0.05 });
      [0.95, 1.42].forEach((x, i) => {
        for (let k = 0; k < 2; k++) {
          const stick = new T.Mesh(new T.CylinderGeometry(0.007, 0.006, 0.3, 6), stickMat);
          stick.rotation.z = Math.PI / 2;
          stick.rotation.y = -0.2 + k * 0.06;
          stick.position.set(x + 0.2, 1.012, -2.44 + k * 0.018 + i * 0.001);
          stall.add(stick);
        }
      });

      const stoolMat = new T.MeshStandardMaterial({ color: 0x3a2116, roughness: 0.7, metalness: 0.05 });
      [0.1, 1.55].forEach((x, i) => {
        const seat = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 0.06, 18), stoolMat);
        seat.position.set(x, 0.52, -1.55);
        seat.castShadow = true;
        seat.receiveShadow = true;
        stall.add(seat);
        for (let k = 0; k < 3; k++) {
          const a = k / 3 * TAU + 0.4;
          const leg = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, 0.52, 6), poleMat);
          leg.position.set(x + Math.cos(a) * 0.14, 0.26, -1.55 + Math.sin(a) * 0.14);
          stall.add(leg);
        }
      });

      stage.scene.add(stall);
    }

    let characters = null;
    if (o.characters) {
      characters = {};
      const mkPerson = (kind, planeW, planeH) => {
        const tex = personTexture(kind);
        const mat = new T.MeshBasicMaterial({
          map: tex, transparent: true, alphaTest: 0.04, depthWrite: true, toneMapped: false
        });
        const mesh = new T.Mesh(new T.PlaneGeometry(planeW, planeH), mat);
        mesh.rotation.y = 0;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        stage.scene.add(mesh);
        return mesh;
      };
      characters.her = mkPerson('her', 1.08, 1.84);
      characters.her.position.set(0.25, 0.92, -1.55);
      characters.owner = mkPerson('owner', 0.84, 1.74);
      characters.owner.position.set(-0.15, 1.0, -3.25);
      characters.man = mkPerson('man', 1.08, 1.78);
      characters.man.position.set(0.55, 0.89, -11.4);
      characters.man.visible = false;
    }

    let phone = null;
    if (o.stall) {
      const phoneTex = K.canvasTexture(512, 320, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(8,12,18,0.92)';
        ctx.beginPath();
        ctx.roundRect(20, 18, w - 40, h - 36, 26);
        ctx.fill();
        ctx.strokeStyle = 'rgba(120,190,255,0.35)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#9fb4c9';
        ctx.font = '600 28px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillText('21:59', 44, 66);
        ctx.fillStyle = 'rgba(80,160,255,0.26)';
        ctx.beginPath();
        ctx.roundRect(190, 96, 280, 104, 20);
        ctx.fill();
        ctx.fillStyle = '#dcecff';
        ctx.font = '700 46px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillText('我到了。', 218, 164);
        ctx.fillStyle = 'rgba(150,170,190,0.5)';
        ctx.font = '500 22px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillText('对方正在输入…', 44, 270);
      }, { clamp: true });
      const mat = new T.MeshBasicMaterial({
        map: phoneTex, transparent: true, depthWrite: false, toneMapped: false, opacity: 0
      });
      phone = new T.Mesh(new T.PlaneGeometry(0.72, 0.45), mat);
      phone.position.set(0.9, 1.55, 0.1);
      phone.visible = false;
      stage.scene.add(phone);
    }

    K.fx.lightShaft(stage, { position: [2.4, 4.4, -0.2], scale: [1.5, 5.6], opacity: 0.13, color: 0xffd2a0, rotation: -0.18 });
    K.fx.lightShaft(stage, { position: [-2.2, 4.8, -5.5], scale: [1.8, 6.2], opacity: 0.09, color: 0x7ec8ff, rotation: 0.2 });

    if (o.rain) {
      const rain = K.fx.rain(stage, {
        count: 3400, area: [8.4, 12, 28], opacity: 0.2, speed: [10, 19], length: [0.35, 0.95], slant: [0.09, 0.17]
      });
      stage.scene.add(rain.mesh);
      const splash = K.fx.splashes(stage, {
        count: 180, area: [8, 26], opacity: 0.26, size: 0.14, y: 0.02
      });
      stage.scene.add(splash.mesh);
      const dust = K.fx.dust(stage, {
        count: 150, area: [7, 7, 24], opacity: 0.12, size: 0.018, rise: 0.06
      });
      stage.scene.add(dust.mesh);
    }

    const anchorList = {
      wide: { pos: [0.4, 2.1, 6.2], look: [0.3, 1.25, -7], fov: 40 },
      stall: { pos: [3.3, 1.55, 2.7], look: [0.5, 1.1, -2.6], fov: 38 },
      herBack: { pos: [1.68, 1.52, 1.0], look: [0.3, 1.24, -1.8], fov: 34 },
      herSide: { pos: [1.88, 1.5, 0.95], look: [0.3, 1.26, -1.65], fov: 33 },
      bowl: { pos: [1.2, 2.55, -0.75], look: [1.2, 1.02, -2.55], fov: 50 },
      counter: { pos: [-0.1, 1.5, -1.5], look: [-0.12, 1.4, -3.3], fov: 32 },
      overShoulder: { pos: [1.35, 1.72, 0.35], look: [0.05, 1.2, -2.3], fov: 36 },
      phone: { pos: [0.9, 1.4, 1.0], look: [0.9, 1.42, 0.1], fov: 28 },
      alley: { pos: [-1.55, 1.58, 2.35], look: [-2.35, 1.2, -11.4], fov: 38 },
      far: { pos: [-1.4, 1.35, 1.5], look: [0.2, 1.25, -3.4], fov: 36 },
      end: { pos: [1.0, 1.45, 4.8], look: [0.2, 1.25, -3.8], fov: 38 },
      arrival: { pos: [-1.72, 1.6, 0.9], look: [-2.45, 1.22, -11.4], fov: 30 },
      two: { pos: [2.3, 1.6, 1.9], look: [0.35, 1.15, -2.4], fov: 40 }
    };

    return {
      group: stage.scene,
      anchors: anchorList,
      stall,
      characters,
      phone,
      neonMats,
      puddles,
      update(t) {
        neonMats.forEach((m, i) => {
          const f = 0.9 + 0.1 * Math.sin(t * (2.1 + i * 0.37) + i * 2.4);
          if (m.userData.baseColor) m.color.copy(m.userData.baseColor).multiplyScalar(f);
        });
        puddles.forEach((p, i) => {
          p.material.normalMap.offset.y = t * (0.006 + i * 0.0012);
        });
        if (characters) {
          const breath = 1 + Math.sin(t * 1.6) * 0.0025;
          characters.her.scale.y = breath;
          characters.owner.scale.y = 1 + Math.sin(t * 1.2 + 1.4) * 0.002;
          characters.her.position.y = 0.92 + Math.sin(t * 1.1) * 0.004;
        }
        if (phone && phone.visible) {
          phone.position.y = 1.55 + Math.sin(t * 0.8) * 0.01;
        }
      }
    };
  }

  window.THREE_SETS = { buildNeonAlley, personTexture };
})();
