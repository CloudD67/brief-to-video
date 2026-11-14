(function () {
  'use strict';

  const E = {
    linear: p => p,
    smooth: p => p * p * (3 - 2 * p),
    outCubic: p => 1 - Math.pow(1 - p, 3),
    inOutCubic: p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2,
    outQuint: p => 1 - Math.pow(1 - p, 5),
    inOutQuint: p => p < 0.5 ? 16 * p * p * p * p * p : 1 - Math.pow(-2 * p + 2, 5) / 2,
    outExpo: p => p >= 1 ? 1 : 1 - Math.pow(2, -10 * p),
    inOutExpo: p => p === 0 ? 0 : (p === 1 ? 1 : (p < 0.5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2)),
    backOut: p => 1 + 2.70158 * Math.pow(p - 1, 3) + 1.70158 * Math.pow(p - 1, 2),

    cubicPoint(u, p0, p1, p2, p3) {
      const v = 1 - u;
      return v * v * v * p0 + 3 * v * v * u * p1 + 3 * v * u * u * p2 + u * u * u * p3;
    },

    // CSS cubic-bezier(x1,y1,x2,y2) 的数值版本：给定 x(0..1) 求 y
    cubicBezier(x1, y1, x2, y2) {
      const ax = 3 * x1 - 3 * x2 + 1;
      const bx = -6 * x1 + 3 * x2;
      const cx = 3 * x1;
      const ay = 3 * y1 - 3 * y2 + 1;
      const by = -6 * y1 + 3 * y2;
      const cy = 3 * y1;

      function sampleX(t) { return ((ax * t + bx) * t + cx) * t; }
      function sampleY(t) { return ((ay * t + by) * t + cy) * t; }
      function dX(t) { return (3 * ax * t + 2 * bx) * t + cx; }

      return function (x) {
        x = Math.max(0, Math.min(1, x));
        let t = x;
        for (let i = 0; i < 6; i++) {
          const err = sampleX(t) - x;
          if (Math.abs(err) < 1e-5) break;
          const d = dX(t);
          if (Math.abs(d) < 1e-6) break;
          t -= err / d;
        }
        t = Math.max(0, Math.min(1, t));
        return sampleY(t);
      };
    }
  };

  window.E = E;
})();
