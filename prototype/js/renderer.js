(function () {
  "use strict";

  var util = window.ImageEffectsUtil;
  var paletteTools = window.ImageEffectsPalette;
  var shapes = window.ImageEffectsShapes;
  var mapping = window.ImageEffectsMapping;
  var composition = window.ImageEffectsComposition;
  var assetCounter = 0;

  function createInterfaceError(code, message) {
    var error = new Error(message);
    error.code = code;
    return error;
  }

  function assertNotAborted(signal) {
    if (signal && signal.aborted) {
      throw createInterfaceError("RENDER_ABORTED", "渲染已取消");
    }
  }

  function cloneShapeInstance(instance) {
    return Object.assign({}, instance);
  }

  function orientationFor(width, height) {
    if (width > height * 1.04) return "landscape";
    if (height > width * 1.04) return "portrait";
    return "square";
  }

  async function prepareAsset(file) {
    if (!file) throw new Error("没有可读取的图片文件");
    var previewUrl = URL.createObjectURL(file);
    var image = await util.loadImage(previewUrl);
    var width = image.naturalWidth || image.width;
    var height = image.naturalHeight || image.height;
    return {
      id: "asset-" + Date.now() + "-" + (assetCounter += 1),
      sourceType: "uploaded",
      fileName: file.name || "local-image",
      width: width,
      height: height,
      aspectRatio: width / height,
      orientation: orientationFor(width, height),
      previewUrl: previewUrl,
      assetRef: file,
      image: image,
    };
  }

  function ensurePalette(projectState) {
    var requested = util.clamp(Math.round(projectState.colorConfig.paletteSize || 8), 4, 8);
    var palette = projectState.colorConfig.palette;
    if (!palette || palette.length < 4) {
      palette = paletteTools.extract(projectState.targetImage, requested);
    }
    return palette;
  }

  function patchRect(centerX, centerY, width, height, boundsWidth, boundsHeight) {
    var safeWidth = util.clamp(width, 1, boundsWidth);
    var safeHeight = util.clamp(height, 1, boundsHeight);
    return {
      x: util.clamp(centerX - safeWidth / 2, 0, Math.max(0, boundsWidth - safeWidth)),
      y: util.clamp(centerY - safeHeight / 2, 0, Math.max(0, boundsHeight - safeHeight)),
      width: safeWidth,
      height: safeHeight,
    };
  }

  function buildTargetWithHoles(projectState, layout, instances, holeSourceCanvas, sourceMode) {
    var targetSize = util.imageSize(projectState.targetImage);
    var maxSide = 2048;
    var scale = Math.min(1, maxSide / Math.max(targetSize.width, targetSize.height));
    var canvas = util.createCanvas(targetSize.width * scale, targetSize.height * scale);
    var ctx = canvas.getContext("2d");
    ctx.drawImage(projectState.targetImage.image, 0, 0, canvas.width, canvas.height);

    instances.forEach(function (instance) {
      var targetNormalizedX = util.clamp(
        instance.sourceX / Math.max(1, targetSize.width),
        0,
        1,
      );
      var targetNormalizedY = util.clamp(
        instance.sourceY / Math.max(1, targetSize.height),
        0,
        1,
      );
      var mappingNormalizedX = util.clamp(
        (instance.x - layout.mappingRect.x) / layout.mappingRect.width,
        0,
        1,
      );
      var mappingNormalizedY = util.clamp(
        (instance.y - layout.mappingRect.y) / layout.mappingRect.height,
        0,
        1,
      );
      var sourceX = targetNormalizedX * canvas.width;
      var sourceY = targetNormalizedY * canvas.height;
      var holeWidth = instance.width * (canvas.width / layout.mappingRect.width);
      var holeHeight = instance.height * (canvas.height / layout.mappingRect.height);
      if (instance.type === "circle") {
        var holeDiameter = Math.min(holeWidth, holeHeight);
        holeWidth = holeDiameter;
        holeHeight = holeDiameter;
      }
      var sourcePatch;
      var sourceImage;
      if (sourceMode === "target") {
        sourcePatch = patchRect(
          (1 - targetNormalizedX) * targetSize.width,
          (1 - targetNormalizedY) * targetSize.height,
          holeWidth * (targetSize.width / canvas.width),
          holeHeight * (targetSize.height / canvas.height),
          targetSize.width,
          targetSize.height,
        );
        sourceImage = projectState.targetImage.image;
      } else {
        sourcePatch = patchRect(
          mappingNormalizedX * holeSourceCanvas.width,
          mappingNormalizedY * holeSourceCanvas.height,
          holeWidth * (holeSourceCanvas.width / canvas.width),
          holeHeight * (holeSourceCanvas.height / canvas.height),
          holeSourceCanvas.width,
          holeSourceCanvas.height,
        );
        sourceImage = holeSourceCanvas;
      }

      ctx.save();
      ctx.translate(sourceX, sourceY);
      ctx.rotate(((instance.rotation || 0) * Math.PI) / 180);
      shapes.buildPath(ctx, instance.type, holeWidth, holeHeight);
      ctx.save();
      ctx.clip();
      ctx.globalAlpha = instance.opacity == null ? 1 : instance.opacity;
      ctx.drawImage(
        sourceImage,
        sourcePatch.x,
        sourcePatch.y,
        sourcePatch.width,
        sourcePatch.height,
        -holeWidth / 2,
        -holeHeight / 2,
        holeWidth,
        holeHeight,
      );
      ctx.restore();
      ctx.restore();
    });

    return canvas;
  }

  function drawMappingShapes(ctx, instances, layer, clipRect, projectState, layout) {
    var selected = instances.filter(function (instance) {
      return (instance.layer || "above") === layer;
    });
    if (!selected.length) return;
    var targetSize = util.imageSize(projectState.targetImage);
    var scaleX = targetSize.width / layout.mappingRect.width;
    var scaleY = targetSize.height / layout.mappingRect.height;
    ctx.save();
    ctx.beginPath();
    ctx.rect(clipRect.x, clipRect.y, clipRect.width, clipRect.height);
    ctx.clip();
    selected.forEach(function (instance) {
      var samplingMode = projectState.colorConfig.samplingMode || "local";
      var sampleX = instance.sourceX;
      var sampleY = instance.sourceY;
      if (samplingMode === "trajectory" || samplingMode === "manual") {
        sampleX = instance.sampleX == null ? instance.sourceX : instance.sampleX;
        sampleY = instance.sampleY == null ? instance.sourceY : instance.sampleY;
      }
      var sourcePatch = patchRect(
        sampleX,
        sampleY,
        instance.width * scaleX,
        instance.height * scaleY,
        targetSize.width,
        targetSize.height,
      );
      ctx.save();
      ctx.translate(instance.x, instance.y);
      ctx.rotate(((instance.rotation || 0) * Math.PI) / 180);
      var opacity = instance.opacity == null ? 1 : instance.opacity;
      ctx.globalAlpha = opacity;
      shapes.buildPath(ctx, instance.type, instance.width, instance.height);
      ctx.clip();
      if (samplingMode === "palette") {
        ctx.fillStyle = instance.color || "#77808a";
        ctx.fillRect(-instance.width, -instance.height, instance.width * 2, instance.height * 2);
      } else {
        ctx.drawImage(
          projectState.targetImage.image,
          sourcePatch.x,
          sourcePatch.y,
          sourcePatch.width,
          sourcePatch.height,
          -instance.width / 2,
          -instance.height / 2,
          instance.width,
          instance.height,
        );
        if (samplingMode === "mixed") {
          ctx.globalAlpha = opacity * 0.28;
          ctx.fillStyle = instance.color || "#77808a";
          ctx.fillRect(-instance.width, -instance.height, instance.width * 2, instance.height * 2);
        }
      }
      ctx.restore();
    });
    ctx.restore();
  }

  function resolveSourceType(projectState) {
    return projectState.mappingImage && projectState.mappingImage.sourceType === "uploaded"
      ? "uploaded"
      : "generated";
  }

  function renderScene(projectState, options) {
    if (!projectState.targetImage) {
      throw new Error("请先选择目标图片");
    }
    options = options || {};
    var palette = ensurePalette(projectState);
    var layout = composition.calculateLayout(projectState, {
      maxSide: options.purpose === "export" ? options.maxSide || 2048 : options.maxSide || 1200,
    });
    var useProvidedShapes =
      options.useProvidedShapes === true &&
      Array.isArray(projectState.shapeInstances);
    var shapeInstances = useProvidedShapes
      ? projectState.shapeInstances.map(cloneShapeInstance)
      : composition.createShapeInstances(projectState, layout, palette);
    var targetOnly = projectState.canvasConfig.composition === "targetOnly";
    var mappingSourceType = resolveSourceType(projectState);
    var mappingAsset = mappingSourceType === "uploaded" ? projectState.mappingImage : null;
    var mappingCanvas = null;
    if (!targetOnly) {
      mappingCanvas = util.createCanvas(layout.mappingRect.width, layout.mappingRect.height);
      var mappingContext = mappingCanvas.getContext("2d");
      mapping.render(
        mappingContext,
        { x: 0, y: 0, width: mappingCanvas.width, height: mappingCanvas.height },
        {
          mode: projectState.mappingConfig.mode,
          baseColor: projectState.mappingConfig.baseColor,
          gradientDirection: projectState.mappingConfig.gradientDirection,
          effectStrength: projectState.mappingConfig.effectStrength,
          textureType: projectState.mappingConfig.textureType,
          textureEnabled: projectState.mappingConfig.textureEnabled,
          mappingFit: projectState.canvasConfig.mappingFit,
          background: projectState.canvasConfig.background,
        },
        palette,
        mappingAsset,
        {
          sourceType: mappingSourceType,
          purpose: options.purpose || "preview",
          previewQuality: options.previewQuality || "high",
        },
      );
    }
    var targetWithHoles = buildTargetWithHoles(
      projectState,
      layout,
      shapeInstances,
      mappingCanvas,
      targetOnly ? "target" : "mapping",
    );
    var output = util.createCanvas(layout.width, layout.height);
    var ctx = output.getContext("2d");

    ctx.fillStyle = projectState.canvasConfig.background || "#eef0f2";
    ctx.fillRect(0, 0, output.width, output.height);

    if (!targetOnly) {
      drawMappingShapes(ctx, shapeInstances, "below", layout.mappingRect, projectState, layout);
      ctx.drawImage(mappingCanvas, layout.mappingRect.x, layout.mappingRect.y);
      drawMappingShapes(ctx, shapeInstances, "above", layout.mappingRect, projectState, layout);
    }

    ctx.drawImage(
      targetWithHoles,
      layout.targetRect.x,
      layout.targetRect.y,
      layout.targetRect.width,
      layout.targetRect.height,
    );

    return {
      canvas: output,
      palette: palette,
      shapeInstances: shapeInstances,
      mappingPreview: mappingCanvas,
      canvasWidth: output.width,
      canvasHeight: output.height,
      layout: layout,
      diagnostics: [],
    };
  }

  function render(canvas, projectState, options) {
    var result = renderScene(projectState, options);
    canvas.width = result.canvas.width;
    canvas.height = result.canvas.height;
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(result.canvas, 0, 0);
    return {
      palette: result.palette,
      shapeInstances: result.shapeInstances,
      canvasWidth: result.canvasWidth,
      canvasHeight: result.canvasHeight,
      layout: result.layout,
      diagnostics: result.diagnostics,
    };
  }

  function renderMappingPreview(canvas, mappingAsset, mappingConfig, targetPalette, options) {
    options = options || {};
    mapping.renderPreview(
      canvas,
      mappingConfig,
      targetPalette,
      mappingAsset,
      {
        sourceType: options.sourceType,
        width: options.width || 320,
      },
    );
    var previewLayout = {
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height,
    };
    return {
      palette: (targetPalette || []).slice(),
      targetShapes: [],
      mappingShapes: [],
      mappingPreview: canvas,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      layout: {
        composition: "targetOnly",
        targetRect: previewLayout,
        mappingRect: previewLayout,
      },
      diagnostics: [],
    };
  }

  function buildV1RenderResult(result, projectState) {
    var targetSize = util.imageSize(projectState.targetImage);
    var scaleX = targetSize.width / result.layout.mappingRect.width;
    var scaleY = targetSize.height / result.layout.mappingRect.height;
    var targetShapes = result.shapeInstances.map(function (instance) {
      var targetShape = cloneShapeInstance(instance);
      targetShape.x = instance.sourceX;
      targetShape.y = instance.sourceY;
      targetShape.width = instance.width * scaleX;
      targetShape.height = instance.height * scaleY;
      if (instance.type === "circle") {
        var diameter = Math.min(targetShape.width, targetShape.height);
        targetShape.width = diameter;
        targetShape.height = diameter;
      }
      return targetShape;
    });
    var mappingShapes = result.shapeInstances.map(cloneShapeInstance);
    return {
      palette: result.palette.slice(),
      targetShapes: targetShapes,
      mappingShapes: mappingShapes,
      mappingPreview: result.mappingPreview || null,
      canvasWidth: result.canvasWidth,
      canvasHeight: result.canvasHeight,
      layout: {
        composition: projectState.canvasConfig.composition || "sideBySide",
        targetRect: Object.assign({}, result.layout.targetRect),
        mappingRect: Object.assign({}, result.layout.mappingRect),
      },
      diagnostics: result.diagnostics.slice(),
    };
  }

  function cloneStateWithSeed(projectState, seed) {
    return Object.assign({}, projectState, {
      randomSeed: seed,
      mappingConfig: Object.assign({}, projectState.mappingConfig),
      canvasConfig: Object.assign({}, projectState.canvasConfig),
      colorConfig: Object.assign({}, projectState.colorConfig, {
        palette: (projectState.colorConfig.palette || []).slice(),
      }),
      shapeConfig: Object.assign({}, projectState.shapeConfig, {
        enabledTypes: (projectState.shapeConfig.enabledTypes || []).slice(),
      }),
      arrangementConfig: Object.assign({}, projectState.arrangementConfig),
      exportConfig: Object.assign({}, projectState.exportConfig),
    });
  }

  function regenerate(canvasOrState, stateOrSeed, maybeSeed) {
    var canvas = null;
    var projectState;
    var seed;
    var options = {};
    if (canvasOrState && typeof canvasOrState.getContext === "function") {
      canvas = canvasOrState;
      projectState = stateOrSeed;
      seed = maybeSeed;
      options = arguments[3] || {};
    } else {
      projectState = canvasOrState;
      seed = stateOrSeed;
    }
    var nextState = cloneStateWithSeed(projectState, seed);
    return canvas ? render(canvas, nextState, options) : nextState;
  }

  function shapeIndexFromId(id) {
    var match = String(id || "").match(/^shape-(\d+)-/);
    return match ? Number(match[1]) : null;
  }

  function nextRandomSeed() {
    return (
      Date.now() ^
      Math.floor(Math.random() * 2147483647)
    ) >>> 0;
  }

  function createRegeneratedState(projectState) {
    var seed = nextRandomSeed();
    var suppliedInstances = Array.isArray(projectState.shapeInstances)
      ? projectState.shapeInstances.map(cloneShapeInstance)
      : [];
    var nextState = cloneStateWithSeed(projectState, seed);
    if (!suppliedInstances.length) return nextState;

    var layout = composition.calculateLayout(projectState, {
      maxSide: 2048,
    });
    var palette = ensurePalette(projectState);
    var generationState = cloneStateWithSeed(projectState, seed);
    generationState.shapeConfig = Object.assign({}, projectState.shapeConfig, {
      totalCount: suppliedInstances.length,
    });
    generationState.shapeInstances = [];
    var freshInstances = composition.createShapeInstances(generationState, layout, palette);
    var suppliedByIndex = {};
    suppliedInstances.forEach(function (instance) {
      suppliedByIndex[shapeIndexFromId(instance.id)] = instance;
    });
    nextState.shapeInstances = freshInstances.map(function (instance, index) {
      var supplied =
        suppliedByIndex[shapeIndexFromId(instance.id)] ||
        suppliedInstances[index];
      return supplied && supplied.isManual
        ? cloneShapeInstance(supplied)
        : instance;
    });
    return nextState;
  }

  async function renderV1(canvas, projectState, options) {
    options = options || {};
    assertNotAborted(options.signal);
    if (!canvas || typeof canvas.getContext !== "function") {
      throw createInterfaceError("CANVAS_UNAVAILABLE", "没有可用的画布");
    }
    var result = renderScene(projectState, Object.assign({}, options, {
      useProvidedShapes: true,
    }));
    canvas.width = result.canvas.width;
    canvas.height = result.canvas.height;
    var context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(result.canvas, 0, 0);
    assertNotAborted(options.signal);
    return buildV1RenderResult(result, projectState);
  }

  async function regenerateV1(canvas, projectState, options) {
    assertNotAborted(options && options.signal);
    var nextState = createRegeneratedState(projectState);
    return renderV1(canvas, nextState, options);
  }

  async function renderMappingPreviewV1(canvas, mappingAsset, mappingConfig, palette, options) {
    options = options || {};
    assertNotAborted(options.signal);
    var result = renderMappingPreview(
      canvas,
      mappingAsset,
      mappingConfig,
      palette,
      options,
    );
    assertNotAborted(options.signal);
    return result;
  }

  async function extractPaletteV1(imageAsset, paletteSize) {
    var requested = util.clamp(Number(paletteSize) || 8, 4, 12);
    return paletteTools.extract(imageAsset, requested);
  }

  function exportPng(projectState, options) {
    var result = renderScene(projectState, {
      purpose: "export",
      maxSide: (options && options.maxSide) || 2048,
      previewQuality: "high",
    });
    return new Promise(function (resolve, reject) {
      result.canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error("PNG 导出失败"));
      }, "image/png");
    });
  }

  function exportBlobV1(projectState, options) {
    options = options || {};
    return new Promise(function (resolve, reject) {
      try {
        assertNotAborted(options.signal);
        var format = String(
          (projectState.exportConfig && projectState.exportConfig.format) ||
          options.format ||
          "png",
        ).toLowerCase();
        var mimeType = format === "jpg" || format === "jpeg"
          ? "image/jpeg"
          : "image/png";
        var extension = mimeType === "image/jpeg" ? "jpg" : "png";
        var quality = projectState.exportConfig && Number.isFinite(projectState.exportConfig.quality)
          ? util.clamp(projectState.exportConfig.quality, 0, 1)
          : 0.94;
        var result = renderScene(projectState, {
          purpose: "export",
          maxSide: options.maxSide || 2048,
          previewQuality: "high",
          useProvidedShapes: true,
          signal: options.signal,
        });
        result.canvas.toBlob(
          function (blob) {
            try {
              assertNotAborted(options.signal);
              if (!blob) {
                reject(createInterfaceError("EXPORT_FAILED", "导出失败"));
                return;
              }
              resolve({
                blob: blob,
                fileName:
                  (projectState.projectId || "这也艺术") +
                  "-" +
                  Date.now() +
                  "." +
                  extension,
                mimeType: mimeType,
                width: result.canvas.width,
                height: result.canvas.height,
              });
            } catch (error) {
              reject(error);
            }
          },
          mimeType,
          mimeType === "image/jpeg" ? quality : undefined,
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  function createAssetFromCanvas(canvas, fileName) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(async function (blob) {
        if (!blob) {
          reject(new Error("演示素材生成失败"));
          return;
        }
        var file = new File([blob], fileName || "generated.png", { type: "image/png" });
        var asset = await prepareAsset(file);
        asset.sourceType = "generated";
        resolve(asset);
      }, "image/png");
    });
  }

  window.ImageEffects = {
    prepareAsset: prepareAsset,
    createAssetFromCanvas: createAssetFromCanvas,
    extractPalette: function (asset, count) {
      return paletteTools.extract(asset, count);
    },
    renderMappingPreview: renderMappingPreview,
    render: render,
    regenerate: regenerate,
    exportPng: exportPng,
  };

  window.ImageEffectsV1 = {
    prepareAsset: prepareAsset,
    createAssetFromCanvas: createAssetFromCanvas,
    extractPalette: extractPaletteV1,
    renderMappingPreview: renderMappingPreviewV1,
    render: renderV1,
    regenerate: regenerateV1,
    exportBlob: exportBlobV1,
  };
})();
