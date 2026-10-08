(function () {
  "use strict";

  var util = window.ImageEffectsUtil;
  var paletteTools = window.ImageEffectsPalette;
  var paperNoiseCanvas = util.createNoiseCanvas(128, 0.14);

  function effectiveStrength(config) {
    return util.clamp(Number(config.effectStrength) || 0, 0, 100) / 100;
  }

  function renderNotebookTexture(ctx, area, strength) {
    var spacing = util.lerp(13, 4.5, strength);
    var lineAlpha = 0.1 + strength * 0.42;
    ctx.save();
    ctx.beginPath();
    ctx.rect(area.x, area.y, area.width, area.height);
    ctx.clip();
    ctx.strokeStyle = "rgba(47, 66, 83, " + lineAlpha.toFixed(3) + ")";
    ctx.lineWidth = 1;
    for (var y = area.y + spacing; y < area.y + area.height; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(area.x, y);
      ctx.lineTo(area.x + area.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function renderXuanPaperTexture(ctx, area, strength) {
    var rng = util.mulberry32("xuan-paper-texture");
    var minimumSide = Math.min(area.width, area.height);
    var fiberCount = Math.round(75 + strength * 85);
    var mottleCount = Math.round(32 + strength * 46);
    ctx.save();
    ctx.beginPath();
    ctx.rect(area.x, area.y, area.width, area.height);
    ctx.clip();

    ctx.globalAlpha = 0.05 + strength * 0.12;
    ctx.fillStyle = "#f3ead7";
    ctx.fillRect(area.x, area.y, area.width, area.height);

    ctx.globalCompositeOperation = "source-over";
    ctx.lineCap = "round";
    for (var fiber = 0; fiber < fiberCount; fiber += 1) {
      var fiberX = util.randomBetween(rng, area.x, area.x + area.width);
      var fiberY = util.randomBetween(rng, area.y, area.y + area.height);
      var fiberLength = util.randomBetween(rng, minimumSide * 0.015, minimumSide * 0.13);
      var fiberAngle = util.randomBetween(rng, -0.18, 0.18);
      var fiberAlpha = util.randomBetween(rng, 0.055, 0.17) * (0.65 + strength * 0.8);
      var fiberColor = rng() < 0.78
        ? "rgba(79, 62, 40, " + fiberAlpha.toFixed(3) + ")"
        : "rgba(255, 249, 231, " + (fiberAlpha * 0.85).toFixed(3) + ")";
      ctx.strokeStyle = fiberColor;
      ctx.lineWidth = util.randomBetween(rng, 0.5, 1.35);
      ctx.beginPath();
      ctx.moveTo(fiberX, fiberY);
      ctx.lineTo(
        fiberX + Math.cos(fiberAngle) * fiberLength,
        fiberY + Math.sin(fiberAngle) * fiberLength,
      );
      ctx.stroke();
    }

    ctx.globalCompositeOperation = "soft-light";
    for (var mottle = 0; mottle < mottleCount; mottle += 1) {
      var mottleX = util.randomBetween(rng, area.x, area.x + area.width);
      var mottleY = util.randomBetween(rng, area.y, area.y + area.height);
      var radius = util.randomBetween(rng, minimumSide * 0.02, minimumSide * 0.16);
      var alpha = util.randomBetween(rng, 0.05, 0.15) * (0.65 + strength * 0.7);
      var gradient = ctx.createRadialGradient(mottleX, mottleY, 0, mottleX, mottleY, radius);
      gradient.addColorStop(0, "rgba(255, 251, 238, " + alpha.toFixed(3) + ")");
      gradient.addColorStop(0.55, "rgba(150, 132, 101, " + (alpha * 0.35).toFixed(3) + ")");
      gradient.addColorStop(1, "rgba(150, 132, 101, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(mottleX - radius, mottleY - radius, radius * 2, radius * 2);
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 0.1 + strength * 0.18;
    ctx.fillStyle = ctx.createPattern(paperNoiseCanvas, "repeat");
    ctx.fillRect(area.x, area.y, area.width, area.height);
    ctx.restore();
  }

  function renderTexture(ctx, area, config, strength) {
    if (config.textureType === "xuanPaper") {
      renderXuanPaperTexture(ctx, area, strength);
    } else {
      renderNotebookTexture(ctx, area, strength);
    }
  }

  function renderUploaded(ctx, area, config, sourceAsset, options) {
    var source = sourceAsset.image ? sourceAsset.image : sourceAsset;
    var strength = effectiveStrength(config);
    var mode = config.mode || "gradient";
    var quality = options.previewQuality === "low" ? 0.5 : 1;
    var maxSourceSide = options.purpose === "export" ? 1600 : 720;
    var size = util.imageSize(source);
    var sourceScale = Math.min(1, maxSourceSide / Math.max(size.width, size.height));
    var tempWidth = Math.max(1, Math.round(area.width * sourceScale * quality));
    var tempHeight = Math.max(1, Math.round(area.height * sourceScale * quality));

    if (mode === "solid") {
      var solidColor = getSourcePalette(sourceAsset, 4, options)[1] || "#7f8790";
      ctx.fillStyle = solidColor;
      ctx.fillRect(area.x, area.y, area.width, area.height);
      if (config.textureEnabled) renderTexture(ctx, area, config, strength);
      return;
    }

    if (mode === "blur") {
      var blurCanvas = util.createCanvas(tempWidth, tempHeight);
      var blurCtx = blurCanvas.getContext("2d");
      var blurAmount = 1 + strength * (18 * sourceScale);
      blurCtx.filter = "blur(" + blurAmount.toFixed(2) + "px)";
      util.drawCover(blurCtx, sourceAsset, -blurAmount, -blurAmount, tempWidth + blurAmount * 2, tempHeight + blurAmount * 2);
      ctx.drawImage(blurCanvas, area.x, area.y, area.width, area.height);
      ctx.save();
      ctx.globalAlpha = 0.18 + strength * 0.16;
      ctx.fillStyle = getSourcePalette(sourceAsset, 5, options)[3] || "#ffffff";
      ctx.fillRect(area.x, area.y, area.width, area.height);
      ctx.restore();
      if (config.textureEnabled) renderTexture(ctx, area, config, strength);
      return;
    }

    drawMappingSource(ctx, area, sourceAsset, config);
    var colors = getSourcePalette(sourceAsset, 5, options);
    var direction = config.gradientDirection || "diagonal";
    var gradient = createLinearGradient(ctx, area, direction);
    colors.forEach(function (color, index) {
      var adjusted = util.adjustColor(color, {
        lightness: (index - 2) * 4,
      });
      gradient.addColorStop(index / Math.max(1, colors.length - 1), adjusted);
    });
    ctx.save();
    ctx.globalAlpha = 0.2 + strength * 0.48;
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = gradient;
    ctx.fillRect(area.x, area.y, area.width, area.height);
    ctx.restore();
    if (config.textureEnabled) renderTexture(ctx, area, config, strength);
  }

  function getSourcePalette(sourceAsset, size, options) {
    if (!sourceAsset._mappingPalette || sourceAsset._mappingPalette.length !== size) {
      sourceAsset._mappingPalette = paletteTools.extract(sourceAsset, size);
    }
    return sourceAsset._mappingPalette;
  }

  function drawMappingSource(ctx, area, sourceAsset, config) {
    if (config.mappingFit === "contain") {
      ctx.fillStyle = config.background || "#eef0f2";
      ctx.fillRect(area.x, area.y, area.width, area.height);
      util.drawContain(ctx, sourceAsset, area.x, area.y, area.width, area.height);
      return;
    }
    util.drawCover(ctx, sourceAsset, area.x, area.y, area.width, area.height);
  }

  function createLinearGradient(ctx, area, direction) {
    if (direction === "horizontal") {
      return ctx.createLinearGradient(area.x, area.y, area.x + area.width, area.y);
    }
    if (direction === "vertical") {
      return ctx.createLinearGradient(area.x, area.y, area.x, area.y + area.height);
    }
    return ctx.createLinearGradient(area.x, area.y, area.x + area.width, area.y + area.height);
  }

  function buildPrimaryColors(baseColor, palette) {
    var color = baseColor || palette[Math.floor(palette.length / 2)] || "#77808a";
    return [
      util.adjustColor(color, { lightness: 18, saturation: -5 }),
      util.adjustColor(color, { lightness: 8, saturation: -2 }),
      color,
      util.adjustColor(color, { lightness: -12, saturation: -2 }),
      util.adjustColor(color, { lightness: -22, saturation: -6 }),
    ];
  }

  function buildGeneratedGradient(ctx, area, palette, direction, baseColor) {
    var colors = buildPrimaryColors(baseColor, palette);
    var gradient = createLinearGradient(ctx, area, direction || "diagonal");
    colors.forEach(function (color, index) {
      gradient.addColorStop(index / Math.max(1, colors.length - 1), color);
    });
    return gradient;
  }

  function renderGeneratedBlur(ctx, area, palette, baseColor, strength) {
    var shortSide = Math.min(area.width, area.height);
    var temporaryWidth = Math.max(36, Math.round(area.width / 8));
    var temporaryHeight = Math.max(36, Math.round(area.height / 8));
    var temporary = util.createCanvas(temporaryWidth, temporaryHeight);
    var temporaryContext = temporary.getContext("2d");
    var rng = util.mulberry32("generated-blur-diffusion");
    var colors = buildPrimaryColors(baseColor, palette);

    temporaryContext.fillStyle = baseColor;
    temporaryContext.fillRect(0, 0, temporaryWidth, temporaryHeight);
    for (var index = 0; index < 18; index += 1) {
      var x = util.randomBetween(rng, 0, temporaryWidth);
      var y = util.randomBetween(rng, 0, temporaryHeight);
      var radius = util.randomBetween(
        rng,
        Math.min(temporaryWidth, temporaryHeight) * 0.16,
        Math.max(temporaryWidth, temporaryHeight) * 0.5,
      );
      var color = colors[Math.floor(rng() * colors.length)] || baseColor;
      var rgb = util.hexToRgb(color);
      var alpha = util.randomBetween(rng, 0.22, 0.52) * (0.55 + strength * 0.75);
      var gradient = temporaryContext.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + "," + alpha.toFixed(3) + ")");
      gradient.addColorStop(0.55, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + "," + (alpha * 0.48).toFixed(3) + ")");
      gradient.addColorStop(1, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0)");
      temporaryContext.fillStyle = gradient;
      temporaryContext.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }

    ctx.save();
    ctx.filter = "blur(" + (Math.max(2, shortSide * 0.018) + strength * Math.max(4, shortSide * 0.035)).toFixed(2) + "px)";
    ctx.drawImage(temporary, area.x, area.y, area.width, area.height);
    ctx.restore();
  }

  function renderGenerated(ctx, area, config, targetPalette, options) {
    var palette = targetPalette && targetPalette.length ? targetPalette : ["#e6e2db", "#a9b0b7", "#5a626b"];
    var strength = effectiveStrength(config);
    var mode = config.mode || "gradient";
    var rng = util.mulberry32("mapping-" + (config.mode || "") + "-" + Math.round(strength * 100));
    var baseColor = config.baseColor || palette[Math.floor(palette.length / 2)] || "#77808a";
    var primaryColors = buildPrimaryColors(baseColor, palette);

    ctx.fillStyle = baseColor;
    ctx.fillRect(area.x, area.y, area.width, area.height);

    if (mode === "solid") {
      if (config.textureEnabled) renderTexture(ctx, area, config, strength);
      return;
    }

    if (mode === "gradient") {
      ctx.fillStyle = buildGeneratedGradient(ctx, area, palette, config.gradientDirection, baseColor);
      ctx.fillRect(area.x, area.y, area.width, area.height);
      addSoftColorVeils(ctx, area, primaryColors, rng, 0.22 + strength * 0.2);
      if (config.textureEnabled) renderTexture(ctx, area, config, strength);
      return;
    }

    renderGeneratedBlur(ctx, area, palette, baseColor, strength);
    if (config.textureEnabled) renderTexture(ctx, area, config, strength);
  }

  function addSoftColorVeils(ctx, area, palette, rng, opacity) {
    var count = Math.max(9, palette.length * 3);
    ctx.save();
    ctx.globalCompositeOperation = "soft-light";
    for (var i = 0; i < count; i += 1) {
      var x = util.randomBetween(rng, area.x - area.width * 0.15, area.x + area.width * 1.15);
      var y = util.randomBetween(rng, area.y - area.height * 0.15, area.y + area.height * 1.15);
      var radius = util.randomBetween(rng, Math.min(area.width, area.height) * 0.16, Math.max(area.width, area.height) * 0.58);
      var color = palette[Math.floor(rng() * palette.length)] || "#ffffff";
      var gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      var rgb = util.hexToRgb(color);
      gradient.addColorStop(0, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + "," + opacity.toFixed(3) + ")");
      gradient.addColorStop(1, "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + ",0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(area.x, area.y, area.width, area.height);
    }
    ctx.restore();
  }

  function render(ctx, area, config, targetPalette, sourceAsset, options) {
    options = options || {};
    ctx.save();
    ctx.beginPath();
    ctx.rect(area.x, area.y, area.width, area.height);
    ctx.clip();
    if (sourceAsset && options.sourceType === "uploaded") {
      renderUploaded(ctx, area, config, sourceAsset, options);
    } else {
      renderGenerated(ctx, area, config, targetPalette, options);
    }
    ctx.restore();
  }

  function renderPreview(canvas, config, targetPalette, sourceAsset, options) {
    options = options || {};
    var size = util.imageSize(sourceAsset || { width: 4, height: 3 });
    var aspect = size.width && size.height ? size.width / size.height : 4 / 3;
    var width = options.width || 320;
    var height = Math.round(width / aspect);
    canvas.width = width;
    canvas.height = util.clamp(height, 120, 240);
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    render(
      ctx,
      { x: 0, y: 0, width: canvas.width, height: canvas.height },
      config,
      targetPalette,
      sourceAsset,
      {
        sourceType: options.sourceType,
        purpose: "preview",
        previewQuality: "low",
      },
    );
  }

  window.ImageEffectsMapping = {
    render: render,
    renderPreview: renderPreview,
  };
})();
