(function () {
  "use strict";

  var util = window.ImageEffectsUtil;

  var availableTypes = [
    "square",
    "circle",
    "bird",
    "puzzle",
    "fiveStar",
    "fourStar",
    "cross",
    "eightFlower",
  ];

  function buildSquare(ctx, width, height) {
    ctx.rect(-width / 2, -height / 2, width, height);
  }

  function buildCircle(ctx, width, height) {
    var radius = Math.min(width, height) / 2;
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
  }

  function buildFiveStar(ctx, width, height) {
    var outerX = width * 0.5;
    var outerY = height * 0.5;
    var innerX = width * 0.21;
    var innerY = height * 0.21;
    for (var i = 0; i < 10; i += 1) {
      var angle = -Math.PI / 2 + (Math.PI * 2 * i) / 10;
      var radiusX = i % 2 === 0 ? outerX : innerX;
      var radiusY = i % 2 === 0 ? outerY : innerY;
      var x = Math.cos(angle) * radiusX;
      var y = Math.sin(angle) * radiusY;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function buildFourStar(ctx, width, height) {
    var halfWidth = width / 2;
    var halfHeight = height / 2;
    ctx.moveTo(0, -halfHeight);
    ctx.bezierCurveTo(
      halfWidth * 0.15,
      -halfHeight * 0.32,
      halfWidth * 0.32,
      -halfHeight * 0.15,
      halfWidth,
      0,
    );
    ctx.bezierCurveTo(
      halfWidth * 0.32,
      halfHeight * 0.15,
      halfWidth * 0.15,
      halfHeight * 0.32,
      0,
      halfHeight,
    );
    ctx.bezierCurveTo(
      -halfWidth * 0.15,
      halfHeight * 0.32,
      -halfWidth * 0.32,
      halfHeight * 0.15,
      -halfWidth,
      0,
    );
    ctx.bezierCurveTo(
      -halfWidth * 0.32,
      -halfHeight * 0.15,
      -halfWidth * 0.15,
      -halfHeight * 0.32,
      0,
      -halfHeight,
    );
    ctx.closePath();
  }

  function buildCross(ctx, width, height) {
    var halfWidth = width / 2;
    var halfHeight = height / 2;
    var verticalArmX = halfWidth * 0.2;
    var horizontalArmY = halfHeight * 0.17;
    var horizontalArmX = halfWidth * 0.42;
    ctx.moveTo(-verticalArmX, -halfHeight);
    ctx.lineTo(verticalArmX, -halfHeight);
    ctx.lineTo(verticalArmX, -horizontalArmY);
    ctx.lineTo(horizontalArmX, -horizontalArmY);
    ctx.lineTo(horizontalArmX, horizontalArmY);
    ctx.lineTo(verticalArmX, horizontalArmY);
    ctx.lineTo(verticalArmX, halfHeight);
    ctx.lineTo(-verticalArmX, halfHeight);
    ctx.lineTo(-verticalArmX, horizontalArmY);
    ctx.lineTo(-horizontalArmX, horizontalArmY);
    ctx.lineTo(-horizontalArmX, -horizontalArmY);
    ctx.lineTo(-verticalArmX, -horizontalArmY);
    ctx.closePath();
  }

  function buildPuzzle(ctx, width, height) {
    var halfWidth = width / 2;
    var halfHeight = height / 2;
    var baseX = halfWidth * 0.68;
    var baseY = halfHeight * 0.68;
    var knobX = baseX * 0.34;
    var knobY = baseY * 0.34;
    ctx.moveTo(-baseX, -baseY);
    ctx.lineTo(-knobX, -baseY);
    ctx.bezierCurveTo(
      -knobX,
      -halfHeight,
      knobX,
      -halfHeight,
      knobX,
      -baseY,
    );
    ctx.lineTo(baseX, -baseY);
    ctx.lineTo(baseX, -knobY);
    ctx.bezierCurveTo(
      halfWidth,
      -knobY,
      halfWidth,
      knobY,
      baseX,
      knobY,
    );
    ctx.lineTo(baseX, baseY);
    ctx.lineTo(knobX, baseY);
    ctx.bezierCurveTo(
      knobX,
      baseY * 0.63,
      -knobX,
      baseY * 0.63,
      -knobX,
      baseY,
    );
    ctx.lineTo(-baseX, baseY);
    ctx.lineTo(-baseX, knobY);
    ctx.bezierCurveTo(
      -baseX * 0.63,
      knobY,
      -baseX * 0.63,
      -knobY,
      -baseX,
      -knobY,
    );
    ctx.closePath();
  }

  function buildEightFlower(ctx, width, height) {
    var outerX = width / 2;
    var outerY = height / 2;
    var innerX = width * 0.17;
    var innerY = height * 0.17;
    for (var i = 0; i < 16; i += 1) {
      var angle = -Math.PI / 2 + (Math.PI * 2 * i) / 16;
      var radiusX = i % 2 === 0 ? outerX : innerX;
      var radiusY = i % 2 === 0 ? outerY : innerY;
      var x = Math.cos(angle) * radiusX;
      var y = Math.sin(angle) * radiusY;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function buildBird(ctx, width, height) {
    var points = [
      [-0.0256, -1.0],
      [-0.5897, -0.814],
      [-0.6923, -0.6512],
      [-0.9487, -0.6512],
      [-1.0, -0.5349],
      [-0.8718, -0.3488],
      [-0.9231, 0.0698],
      [-0.8205, 0.3023],
      [-0.5897, 0.5814],
      [0.0256, 1.0],
      [-0.2821, 0.4186],
      [-0.2821, 0.0233],
      [-0.0256, 0.0],
      [0.7436, 0.4419],
      [0.8205, 0.4186],
      [0.3846, 0.0698],
      [1.0, 0.1163],
      [-0.0256, -0.3023],
      [0.0513, -0.5349],
      [0.9487, -0.7674],
    ];
    var halfWidth = width * 0.5;
    var halfHeight = height * 0.5;
    var scaled = points.map(function (point) {
      return [point[0] * halfWidth, point[1] * halfHeight];
    });
    var sharp = new Set([4, 5, 9, 10, 11, 12, 13, 15, 16, 17, 18]);

    ctx.moveTo(scaled[0][0], scaled[0][1]);
    for (var index = 0; index < scaled.length; index += 1) {
      var nextIndex = (index + 1) % scaled.length;
      var current = scaled[index];
      var next = scaled[nextIndex];
      if (sharp.has(index) || sharp.has(nextIndex)) {
        ctx.lineTo(next[0], next[1]);
        continue;
      }
      var before = scaled[(index - 1 + scaled.length) % scaled.length];
      var after = scaled[(nextIndex + 1) % scaled.length];
      ctx.bezierCurveTo(
        current[0] + (next[0] - before[0]) / 6,
        current[1] + (next[1] - before[1]) / 6,
        next[0] - (after[0] - current[0]) / 6,
        next[1] - (after[1] - current[1]) / 6,
        next[0],
        next[1],
      );
    }
    ctx.closePath();
  }

  function buildPath(ctx, type, width, height) {
    ctx.beginPath();
    if (type === "circle") buildCircle(ctx, width, height);
    else if (type === "square") buildSquare(ctx, width, height);
    else if (type === "fiveStar") buildFiveStar(ctx, width, height);
    else if (type === "fourStar") buildFourStar(ctx, width, height);
    else if (type === "cross") buildCross(ctx, width, height);
    else if (type === "puzzle") buildPuzzle(ctx, width, height);
    else if (type === "eightFlower") buildEightFlower(ctx, width, height);
    else buildBird(ctx, width, height);
  }

  function draw(ctx, instance, colorOverride) {
    var width = instance.width;
    var height = instance.height;
    ctx.save();
    ctx.translate(instance.x, instance.y);
    ctx.rotate(((instance.rotation || 0) * Math.PI) / 180);
    ctx.globalAlpha = util.clamp(instance.opacity == null ? 1 : instance.opacity, 0, 1);
    buildPath(ctx, instance.type, width, height);
    ctx.fillStyle = colorOverride || instance.color || "#ffffff";
    ctx.fill();
    ctx.restore();
  }

  function drawAt(ctx, type, x, y, width, height, rotation, color, opacity) {
    draw(ctx, {
      type: type,
      x: x,
      y: y,
      width: width,
      height: height,
      rotation: rotation || 0,
      color: color,
      opacity: opacity == null ? 1 : opacity,
    });
  }

  window.ImageEffectsShapes = {
    availableTypes: availableTypes,
    draw: draw,
    drawAt: drawAt,
    buildPath: buildPath,
  };
})();
