(function () {
  'use strict';

  const E = {
    smooth: p => p * p * (3 - 2 * p),
    outCubic: p => 1 - Math.pow(1 - p, 3),
    inOutCubic: p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2,
    outExpo: p => p >= 1 ? 1 : 1 - Math.pow(2, -10 * p),
    backOut: p => 1 + 2.70158 * Math.pow(p - 1, 3) + 1.70158 * Math.pow(p - 1, 2),

    cubicPoint(u, p0, p1, p2, p3) {
      const v = 1 - u;
      return v * v * v * p0 + 3 * v * v * u * p1 + 3 * v * u * u * p2 + u * u * u * p3;
    }
  };

  window.E = E;
})();
