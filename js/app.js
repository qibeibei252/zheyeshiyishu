(function () {
  "use strict";

  var effects = window.ImageEffectsV1;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function createCanvas(width, height) {
    var canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    return canvas;
  }

  function imageSize(source) {
    if (!source) return { width: 0, height: 0 };
    if (source.image) {
      return {
        width: source.image.naturalWidth || source.image.width,
        height: source.image.naturalHeight || source.image.height,
      };
    }
    return {
      width: source.naturalWidth || source.width,
      height: source.naturalHeight || source.height,
    };
  }

  var state = {
    projectId: "这也是艺术",
    targetImage: null,
    mappingImage: null,
    _uploadedMappingAsset: null,
    mappingConfig: {
      mode: "gradient",
      baseColor: null,
      gradientDirection: "diagonal",
      effectStrength: 45,
      previewEnabled: true,
      previewQuality: "low",
      sourceTargetImage: true,
      textureType: "notebook",
      textureEnabled: false,
    },
    canvasConfig: {
      composition: "sideBySide",
      targetPosition: "left",
      mappingPosition: "right",
      mappingSizeMode: "matchTarget",
      mappingFit: "cover",
      surroundRatio: "3:4",
      canvasWidth: 0,
      canvasHeight: 0,
      background: "#eef0f2",
    },
    colorConfig: {
      palette: [],
      paletteSize: 8,
      paletteSource: "targetImageOnly",
      samplingMode: "local",
      holeFillMode: "gradientTexture",
      holeFillStrength: 62,
    },
    shapeConfig: {
      enabledTypes: ["bird"],
      totalCount: 36,
      renderStyle: "flat",
      minSize: 3,
      maxSize: 8,
      minRotation: -25,
      maxRotation: 25,
      opacity: 0.92,
      spacing: 4,
      defaultLayer: "above",
    },
    arrangementConfig: {
      mode: "around",
      gridColumns: 6,
      gridRows: 6,
      centralSafeWidth: 40,
      centralSafeHeight: 40,
      jitter: 8,
      seed: 1,
    },
    mappingArrangementConfig: {
      mode: "correspond",
      density: 65,
      trajectoryStrokes: [],
    },
    manualShapePositions: {},
    targetTrajectoryStrokes: [],
    targetManualPositions: {},
    shapeInstances: null,
    exportConfig: {
      format: "png",
      quality: 1,
      composition: "sideBySide",
      surroundRatio: "3:4",
      outputWidth: 0,
      outputHeight: 0,
    },
    randomSeed: 20260930,
  };

  var elements = {};
  var renderTimer = 0;
  var mappingSourceMode = "generated";
  var selectedPaletteIndex = 0;
  var lastLayout = null;
  var lastShapeInstances = [];
  var trajectoryDraftStrokes = [];
  var targetTrajectoryDraftStrokes = [];
  var preferredInteractionOwner = null;
  var activePointerId = null;
  var draggingShapeId = null;
  var dragOffset = { x: 0, y: 0 };
  var selectedShapeId = null;
  var shapeEditInteraction = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function cacheElements() {
    [
      "status",
      "demoButton",
      "brandButton",
      "startView",
      "editorView",
      "startEditingButton",
      "canvasStage",
      "previewCanvas",
      "interactionCanvas",
      "canvasMeta",
      "shapeMeta",
      "selectionBar",
      "selectionTitle",
      "selectionMeta",
      "copyShapeButton",
      "moveUpButton",
      "moveDownButton",
      "deleteShapeButton",
      "targetInput",
      "mappingInput",
      "mappingSourceGroup",
      "sourceNote",
      "paletteStrip",
      "paletteCount",
      "mappingPreview",
      "mappingModeGroup",
      "mappingModeLabel",
      "textureOptions",
      "textureTypeGroup",
      "textureEnabledInput",
      "strengthInput",
      "strengthOutput",
      "gradientDirection",
      "shapeTypeGroup",
      "countInput",
      "countOutput",
      "shapeCountLabel",
      "minSizeInput",
      "minSizeOutput",
      "maxSizeInput",
      "maxSizeOutput",
      "minRotationInput",
      "minRotationOutput",
      "maxRotationInput",
      "maxRotationOutput",
      "opacityInput",
      "opacityOutput",
      "samplingModeGroup",
      "targetSamplingTooltip",
      "targetTrajectoryActions",
      "clearTargetTrajectoryButton",
      "confirmTargetTrajectoryButton",
      "arrangementGroup",
      "arrangementLabel",
      "gridColumnsInput",
      "gridRowsInput",
      "safeWidthInput",
      "safeWidthOutput",
      "safeHeightInput",
      "safeHeightOutput",
      "mappingArrangementGroup",
      "mappingArrangementLabel",
      "mappingDensityInput",
      "mappingDensityOutput",
      "trajectoryTooltip",
      "trajectoryActions",
      "clearTrajectoryButton",
      "confirmTrajectoryButton",
      "compositionGroup",
      "compositionLabel",
      "targetPosition",
      "surroundRatio",
      "mappingFit",
      "exportFormatGroup",
      "regenerateButton",
      "exportButton",
      "mobileRegenerateButton",
      "mobileExportButton",
    ].forEach(function (id) {
      elements[id] = byId(id);
    });
  }

  function setStatus(message) {
    elements.status.textContent = message;
  }

  function setGroupValue(group, value) {
    Array.from(group.querySelectorAll(".segment")).forEach(function (button) {
      button.classList.toggle("is-active", button.dataset.value === value);
    });
  }

  function setShapeGroups() {
    Array.from(elements.shapeTypeGroup.querySelectorAll(".shape-option")).forEach(function (button) {
      button.classList.toggle(
        "is-active",
        state.shapeConfig.enabledTypes.indexOf(button.dataset.value) !== -1,
      );
    });
  }

  function syncPositionSelect() {
    var composition = state.canvasConfig.composition;
    var select = elements.targetPosition;
    var options = composition === "stacked" ? ["top", "bottom"] : ["left", "right"];
    select.innerHTML = "";
    options.forEach(function (value) {
      var option = document.createElement("option");
      option.value = value;
      option.textContent = value === "left" ? "左侧" : value === "right" ? "右侧" : value === "top" ? "上方" : "下方";
      select.appendChild(option);
    });
    if (options.indexOf(state.canvasConfig.targetPosition) === -1) {
      state.canvasConfig.targetPosition = options[0];
    }
    select.value = state.canvasConfig.targetPosition;
    select.disabled = composition === "surround" || composition === "targetOnly";
    elements.surroundRatio.disabled = composition !== "surround";
  }

  function updateMappingPositions() {
    var composition = state.canvasConfig.composition;
    if (composition === "sideBySide") {
      state.canvasConfig.mappingPosition = state.canvasConfig.targetPosition === "left" ? "right" : "left";
    } else if (composition === "stacked") {
      state.canvasConfig.mappingPosition = state.canvasConfig.targetPosition === "top" ? "bottom" : "top";
    } else if (composition === "targetOnly") {
      state.canvasConfig.mappingPosition = "none";
    } else {
      state.canvasConfig.mappingPosition = "surround";
    }
  }

  function syncStartView() {
    elements.startEditingButton.disabled = false;
  }

  function openEditor() {
    elements.startView.classList.add("is-hidden");
    elements.editorView.classList.remove("is-hidden");
    window.scrollTo(0, 0);
    schedulePreview();
  }

  function goToStart() {
    elements.editorView.classList.add("is-hidden");
    elements.startView.classList.remove("is-hidden");
    window.scrollTo(0, 0);
    syncStartView();
  }

  function updatePaletteUI() {
    elements.paletteStrip.innerHTML = "";
    state.colorConfig.palette.forEach(function (color, index) {
      var swatch = document.createElement("button");
      swatch.className = "palette-swatch";
      swatch.classList.toggle("is-active", index === selectedPaletteIndex);
      swatch.type = "button";
      swatch.dataset.index = String(index);
      swatch.setAttribute("aria-pressed", index === selectedPaletteIndex ? "true" : "false");
      swatch.setAttribute("aria-label", "选择目标主色 " + (index + 1) + " " + color);
      swatch.style.background = color;
      swatch.title = color + " · 点击切换目标主色";
      elements.paletteStrip.appendChild(swatch);
    });
    elements.paletteCount.textContent = state.colorConfig.palette.length
      ? state.colorConfig.palette.length + " 色 · 已选 " + (selectedPaletteIndex + 1)
      : "0 / 8";
  }

  function selectPaletteColor(index) {
    if (!state.colorConfig.palette.length) return;
    selectedPaletteIndex = clamp(index, 0, state.colorConfig.palette.length - 1);
    state.mappingConfig.baseColor = state.colorConfig.palette[selectedPaletteIndex];
    updatePaletteUI();
    updateMappingPreview();
    schedulePreview();
  }

  function sourceType() {
    return state.mappingImage && state.mappingImage.sourceType === "uploaded"
      ? "uploaded"
      : "generated";
  }

  function getInteractionLayout() {
    if (lastLayout) return lastLayout;
    return null;
  }

  function getInteractionKind() {
    if (preferredInteractionOwner === "target") {
      if (state.colorConfig.samplingMode === "trajectory") return "targetTrajectory";
      if (state.colorConfig.samplingMode === "manual") return "targetManual";
    }
    if (preferredInteractionOwner === "mapping") {
      if (state.mappingArrangementConfig.mode === "trajectory") return "mappingTrajectory";
      if (state.mappingArrangementConfig.mode === "manual") return "mappingManual";
    }
    if (state.colorConfig.samplingMode === "trajectory") return "targetTrajectory";
    if (state.colorConfig.samplingMode === "manual") return "targetManual";
    if (state.mappingArrangementConfig.mode === "trajectory") return "mappingTrajectory";
    if (state.mappingArrangementConfig.mode === "manual") return "mappingManual";
    return null;
  }

  function hasTargetTrajectoryDraft() {
    return targetTrajectoryDraftStrokes.some(function (stroke) {
      return stroke.length > 1;
    });
  }

  function drawTrajectoryOverlay() {
    var overlay = elements.interactionCanvas;
    var ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    var layout = getInteractionLayout();
    if (!layout) return;
    var interaction = getInteractionKind();
    if (!interaction) {
      drawSelectionOverlay(ctx);
      return;
    }
    var strokes;
    var region;
    if (interaction === "targetTrajectory") {
      strokes = targetTrajectoryDraftStrokes;
      region = layout.targetRect;
    } else if (interaction === "mappingTrajectory") {
      strokes = trajectoryDraftStrokes;
      region = layout.mappingRect;
    } else {
      return;
    }
    if (!strokes.length) return;

    strokes.forEach(function (stroke) {
      if (stroke.length < 2) return;
      ctx.beginPath();
      stroke.forEach(function (point, index) {
        var x = region.x + point.x * region.width;
        var y = region.y + point.y * region.height;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(255,255,255,0.92)";
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.strokeStyle = "#2f718c";
      ctx.lineWidth = 3;
      ctx.stroke();
    });
  }

  function syncInteractionCanvas() {
    var preview = elements.previewCanvas;
    var overlay = elements.interactionCanvas;
    if (overlay.width !== preview.width || overlay.height !== preview.height) {
      overlay.width = preview.width;
      overlay.height = preview.height;
    }
    drawTrajectoryOverlay();
  }

  function getSelectedShape() {
    if (!Array.isArray(lastShapeInstances)) return null;
    return (
      lastShapeInstances.find(function (shape) {
        return shape.id === selectedShapeId;
      }) || null
    );
  }

  function rotateLocalPoint(shape, localX, localY) {
    var angle = ((shape.rotation || 0) * Math.PI) / 180;
    return {
      x: shape.x + localX * Math.cos(angle) - localY * Math.sin(angle),
      y: shape.y + localX * Math.sin(angle) + localY * Math.cos(angle),
    };
  }

  function drawSelectionOverlay(ctx) {
    var shape = getSelectedShape();
    if (!shape) return;
    var canvas = elements.interactionCanvas;
    var rect = canvas.getBoundingClientRect();
    var scale = rect.width ? canvas.width / rect.width : 1;
    var radius = Math.max(7, 10 * scale);
    var corners = [
      rotateLocalPoint(shape, -shape.width / 2, -shape.height / 2),
      rotateLocalPoint(shape, shape.width / 2, -shape.height / 2),
      rotateLocalPoint(shape, shape.width / 2, shape.height / 2),
      rotateLocalPoint(shape, -shape.width / 2, shape.height / 2),
    ];
    var topCenter = rotateLocalPoint(shape, 0, -shape.height / 2);
    var rotateHandle = rotateLocalPoint(shape, 0, -shape.height / 2 - 24 * scale);

    ctx.save();
    ctx.setLineDash([6 * scale, 4 * scale]);
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = Math.max(1.5, 1.5 * scale);
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    corners.slice(1).forEach(function (point) {
      ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.strokeStyle = "#2f718c";
    ctx.lineWidth = Math.max(1, scale);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(topCenter.x, topCenter.y);
    ctx.lineTo(rotateHandle.x, rotateHandle.y);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(rotateHandle.x, rotateHandle.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#c65b3b";
    ctx.beginPath();
    ctx.arc(corners[2].x, corners[2].y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function updateSelectionUI() {
    var shape = getSelectedShape();
    elements.selectionBar.classList.toggle("is-hidden", !shape);
    if (!shape) {
      drawTrajectoryOverlay();
      return;
    }
    elements.selectionTitle.textContent = shape.type + " · 已选择";
    elements.selectionMeta.textContent =
      "尺寸 " +
      Math.round(shape.width) +
      " × " +
      Math.round(shape.height) +
      "，旋转 " +
      Math.round(shape.rotation || 0) +
      "°";
  }

  function eventCanvasPoint(event) {
    var canvas = elements.interactionCanvas;
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
      scale: canvas.width / rect.width,
    };
  }

  function distance(pointA, pointB) {
    return Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y);
  }

  function handleGeneralEditPointerDown(event) {
    if (!Array.isArray(lastShapeInstances) || !lastShapeInstances.length) return;
    var point = eventCanvasPoint(event);
    if (!point) return;
    var selected = getSelectedShape();
    if (selected) {
      var rotateHandle = rotateLocalPoint(
        selected,
        0,
        -selected.height / 2 - 24 * point.scale,
      );
      var resizeHandle = rotateLocalPoint(
        selected,
        selected.width / 2,
        selected.height / 2,
      );
      var hitRadius = Math.max(14, 17 * point.scale);
      if (distance(point, rotateHandle) <= hitRadius) {
        shapeEditInteraction = {
          mode: "rotate",
          shape: selected,
          pointerId: event.pointerId,
        };
        elements.interactionCanvas.setPointerCapture(event.pointerId);
        event.preventDefault();
        return;
      }
      if (distance(point, resizeHandle) <= hitRadius) {
        shapeEditInteraction = {
          mode: "resize",
          shape: selected,
          pointerId: event.pointerId,
          anchor: rotateLocalPoint(selected, -selected.width / 2, -selected.height / 2),
        };
        elements.interactionCanvas.setPointerCapture(event.pointerId);
        event.preventDefault();
        return;
      }
    }

    var raw = { canvasX: point.x, canvasY: point.y };
    var shape = findShapeAt(raw);
    if (!shape) {
      selectedShapeId = null;
      updateSelectionUI();
      return;
    }
    selectedShapeId = shape.id;
    shapeEditInteraction = {
      mode: "move",
      shape: shape,
      pointerId: event.pointerId,
      offsetX: point.x - shape.x,
      offsetY: point.y - shape.y,
    };
    elements.interactionCanvas.setPointerCapture(event.pointerId);
    updateSelectionUI();
    event.preventDefault();
  }

  function handleGeneralEditPointerMove(event) {
    if (!shapeEditInteraction || shapeEditInteraction.pointerId !== event.pointerId) return;
    var point = eventCanvasPoint(event);
    if (!point) return;
    var shape = shapeEditInteraction.shape;
    if (shapeEditInteraction.mode === "move") {
      shape.x = point.x - shapeEditInteraction.offsetX;
      shape.y = point.y - shapeEditInteraction.offsetY;
    } else if (shapeEditInteraction.mode === "rotate") {
      shape.rotation =
        (Math.atan2(point.y - shape.y, point.x - shape.x) * 180) / Math.PI + 90;
    } else if (shapeEditInteraction.mode === "resize") {
      var angle = (-(shape.rotation || 0) * Math.PI) / 180;
      var dx = point.x - shapeEditInteraction.anchor.x;
      var dy = point.y - shapeEditInteraction.anchor.y;
      var localX = dx * Math.cos(angle) - dy * Math.sin(angle);
      var localY = dx * Math.sin(angle) + dy * Math.cos(angle);
      var signX = localX >= 0 ? 1 : -1;
      var signY = localY >= 0 ? 1 : -1;
      shape.width = Math.max(16, Math.abs(localX));
      shape.height = Math.max(16, Math.abs(localY));
      var rotation = ((shape.rotation || 0) * Math.PI) / 180;
      shape.x =
        shapeEditInteraction.anchor.x +
        ((signX * shape.width) / 2) * Math.cos(rotation) -
        ((signY * shape.height) / 2) * Math.sin(rotation);
      shape.y =
        shapeEditInteraction.anchor.y +
        ((signX * shape.width) / 2) * Math.sin(rotation) +
        ((signY * shape.height) / 2) * Math.cos(rotation);
    }
    shape.isManual = true;
    state.shapeInstances = lastShapeInstances;
    updateSelectionUI();
    drawSelectionOverlay(elements.interactionCanvas.getContext("2d"));
    schedulePreview();
    event.preventDefault();
  }

  function finishGeneralEdit(event) {
    if (!shapeEditInteraction || shapeEditInteraction.pointerId !== event.pointerId) return false;
    if (elements.interactionCanvas.hasPointerCapture(event.pointerId)) {
      elements.interactionCanvas.releasePointerCapture(event.pointerId);
    }
    shapeEditInteraction = null;
    schedulePreview();
    return true;
  }

  function hasTrajectoryDraft() {
    return trajectoryDraftStrokes.some(function (stroke) {
      return stroke.length > 1;
    });
  }

  function updateMappingArrangementControls() {
    var mode = state.mappingArrangementConfig.mode;
    var interaction = getInteractionKind();
    elements.mappingArrangementLabel.textContent =
      mode === "central"
        ? "中央整齐"
        : mode === "trajectory"
          ? "轨迹排列"
          : mode === "manual"
            ? "手动排列"
            : "一一对应";
    elements.mappingDensityInput.disabled = mode !== "central";
    elements.trajectoryActions.hidden =
      mode !== "trajectory" || interaction !== "mappingTrajectory";
    elements.confirmTrajectoryButton.disabled = !hasTrajectoryDraft();
    elements.targetTrajectoryActions.hidden =
      state.colorConfig.samplingMode !== "trajectory" || interaction !== "targetTrajectory";
    elements.confirmTargetTrajectoryButton.disabled = !hasTargetTrajectoryDraft();
    elements.canvasStage.classList.toggle(
      "is-trajectory",
      interaction === "targetTrajectory" || interaction === "mappingTrajectory",
    );
    elements.canvasStage.classList.toggle(
      "is-manual",
      interaction === "targetManual" || interaction === "mappingManual",
    );
    if (interaction !== "targetManual" && interaction !== "mappingManual") {
      elements.canvasStage.classList.remove("is-dragging");
      draggingShapeId = null;
    }
    drawTrajectoryOverlay();
  }

  function pointerToCanvasPoint(event, region) {
    var canvas = elements.interactionCanvas;
    var layout = getInteractionLayout();
    if (!layout || !region) return null;
    var rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    var canvasX = ((event.clientX - rect.left) / rect.width) * canvas.width;
    var canvasY = ((event.clientY - rect.top) / rect.height) * canvas.height;
    return {
      canvasX: canvasX,
      canvasY: canvasY,
      normalizedX: (canvasX - region.x) / region.width,
      normalizedY: (canvasY - region.y) / region.height,
      inside:
        canvasX >= region.x &&
        canvasX <= region.x + region.width &&
        canvasY >= region.y &&
        canvasY <= region.y + region.height,
    };
  }

  function isPointInShape(point, instance) {
    var rotation = ((instance.rotation || 0) * Math.PI) / 180;
    var dx = point.canvasX - instance.x;
    var dy = point.canvasY - instance.y;
    var localX = dx * Math.cos(rotation) + dy * Math.sin(rotation);
    var localY = -dx * Math.sin(rotation) + dy * Math.cos(rotation);
    return (
      Math.abs(localX) <= instance.width / 2 + 5 &&
      Math.abs(localY) <= instance.height / 2 + 5
    );
  }

  function findShapeAt(point) {
    for (var index = lastShapeInstances.length - 1; index >= 0; index -= 1) {
      if (isPointInShape(point, lastShapeInstances[index])) {
        return lastShapeInstances[index];
      }
    }
    return null;
  }

  function targetShapeGeometry(instance, layout) {
    var targetSize = imageSize(state.targetImage);
    var scaleX = layout.targetRect.width / layout.mappingRect.width;
    var scaleY = layout.targetRect.height / layout.mappingRect.height;
    var width = instance.width * scaleX;
    var height = instance.height * scaleY;
    if (instance.type === "circle") {
      var diameter = Math.min(width, height);
      width = diameter;
      height = diameter;
    }
    return {
      x: layout.targetRect.x + (instance.sourceX / targetSize.width) * layout.targetRect.width,
      y: layout.targetRect.y + (instance.sourceY / targetSize.height) * layout.targetRect.height,
      width: width,
      height: height,
    };
  }

  function isPointInTargetShape(point, instance, layout) {
    var geometry = targetShapeGeometry(instance, layout);
    var rotation = ((instance.rotation || 0) * Math.PI) / 180;
    var dx = point.canvasX - geometry.x;
    var dy = point.canvasY - geometry.y;
    var localX = dx * Math.cos(rotation) + dy * Math.sin(rotation);
    var localY = -dx * Math.sin(rotation) + dy * Math.cos(rotation);
    return (
      Math.abs(localX) <= geometry.width / 2 + 5 &&
      Math.abs(localY) <= geometry.height / 2 + 5
    );
  }

  function findTargetShapeAt(point, layout) {
    for (var index = lastShapeInstances.length - 1; index >= 0; index -= 1) {
      if (isPointInTargetShape(point, lastShapeInstances[index], layout)) {
        return {
          instance: lastShapeInstances[index],
          geometry: targetShapeGeometry(lastShapeInstances[index], layout),
        };
      }
    }
    return null;
  }

  function handleInteractionPointerDown(event) {
    var interaction = getInteractionKind();
    if (!interaction) {
      handleGeneralEditPointerDown(event);
      return;
    }
    var layout = getInteractionLayout();
    if (!layout) return;
    var region = interaction.indexOf("target") === 0 ? layout.targetRect : layout.mappingRect;
    var point = pointerToCanvasPoint(event, region);
    if (!point || !point.inside) return;
    event.preventDefault();
    elements.interactionCanvas.setPointerCapture(event.pointerId);

    if (interaction === "targetTrajectory" || interaction === "mappingTrajectory") {
      activePointerId = event.pointerId;
      var strokes = interaction === "targetTrajectory"
        ? targetTrajectoryDraftStrokes
        : trajectoryDraftStrokes;
      strokes.push([
        {
          x: clamp(point.normalizedX, 0, 1),
          y: clamp(point.normalizedY, 0, 1),
        },
      ]);
      updateMappingArrangementControls();
      return;
    }

    var shapeSelection = interaction === "targetManual"
      ? findTargetShapeAt(point, layout)
      : null;
    var shapeInstance = shapeSelection ? shapeSelection.instance : findShapeAt(point);
    if (!shapeInstance) return;
    activePointerId = event.pointerId;
    draggingShapeId = shapeInstance.id;
    dragOffset = {
      x: point.canvasX - (interaction === "targetManual"
        ? shapeSelection.geometry.x
        : shapeInstance.x),
      y: point.canvasY - (interaction === "targetManual"
        ? shapeSelection.geometry.y
        : shapeInstance.y),
    };
    elements.canvasStage.classList.add("is-dragging");
  }

  function handleInteractionPointerMove(event) {
    if (shapeEditInteraction) {
      handleGeneralEditPointerMove(event);
      return;
    }
    if (activePointerId !== event.pointerId) return;
    var interaction = getInteractionKind();
    var layout = getInteractionLayout();
    if (!layout) return;
    var region = interaction && interaction.indexOf("target") === 0
      ? layout.targetRect
      : layout.mappingRect;
    var point = pointerToCanvasPoint(event, region);
    if (!point) return;
    event.preventDefault();

    if (interaction === "targetTrajectory" || interaction === "mappingTrajectory") {
      var strokes = interaction === "targetTrajectory"
        ? targetTrajectoryDraftStrokes
        : trajectoryDraftStrokes;
      var stroke = strokes[strokes.length - 1];
      if (!stroke) return;
      var nextPoint = {
        x: clamp(point.normalizedX, 0, 1),
        y: clamp(point.normalizedY, 0, 1),
      };
      var previous = stroke[stroke.length - 1];
      if (Math.hypot(nextPoint.x - previous.x, nextPoint.y - previous.y) > 0.0025) {
        stroke.push(nextPoint);
        drawTrajectoryOverlay();
      }
      return;
    }

    if (!draggingShapeId) return;
    var instance = lastShapeInstances.find(function (candidate) {
      return candidate.id === draggingShapeId;
    });
    if (!instance) return;
    if (interaction === "targetManual") {
      var targetSize = imageSize(state.targetImage);
      instance.sourceX = ((point.canvasX - dragOffset.x - layout.targetRect.x) / layout.targetRect.width) * targetSize.width;
      instance.sourceY = ((point.canvasY - dragOffset.y - layout.targetRect.y) / layout.targetRect.height) * targetSize.height;
      state.targetManualPositions[instance.id] = {
        x: clamp((instance.sourceX / targetSize.width), 0, 1),
        y: clamp((instance.sourceY / targetSize.height), 0, 1),
      };
      schedulePreview();
      return;
    }

    var radius = Math.max(instance.width, instance.height) / 2 + 2;
    var mappingRect = layout.mappingRect;
    instance.x = clamp(
      point.canvasX - dragOffset.x,
      mappingRect.x + radius,
      mappingRect.x + mappingRect.width - radius,
    );
    instance.y = clamp(
      point.canvasY - dragOffset.y,
      mappingRect.y + radius,
      mappingRect.y + mappingRect.height - radius,
    );
    state.manualShapePositions[instance.id] = {
      x: (instance.x - mappingRect.x) / mappingRect.width,
      y: (instance.y - mappingRect.y) / mappingRect.height,
    };
    schedulePreview();
  }

  function finishInteraction(event) {
    if (finishGeneralEdit(event)) return;
    if (activePointerId !== event.pointerId) return;
    var interaction = getInteractionKind();
    if (interaction === "targetTrajectory" || interaction === "mappingTrajectory") {
      var strokes = interaction === "targetTrajectory"
        ? targetTrajectoryDraftStrokes
        : trajectoryDraftStrokes;
      var stroke = strokes[strokes.length - 1];
      if (stroke && stroke.length < 2) strokes.pop();
      updateMappingArrangementControls();
    } else {
      elements.canvasStage.classList.remove("is-dragging");
      draggingShapeId = null;
      schedulePreview();
    }
    if (elements.interactionCanvas.hasPointerCapture(event.pointerId)) {
      elements.interactionCanvas.releasePointerCapture(event.pointerId);
    }
    activePointerId = null;
  }

  function duplicateSelectedShape() {
    var shape = getSelectedShape();
    if (!shape) return;
    var copy = Object.assign({}, shape, {
      id: "manual-copy-" + Date.now(),
      x: shape.x + 18,
      y: shape.y + 18,
      isManual: true,
      zIndex: lastShapeInstances.length,
    });
    lastShapeInstances.push(copy);
    state.shapeInstances = lastShapeInstances;
    selectedShapeId = copy.id;
    updateSelectionUI();
    schedulePreview();
  }

  function deleteSelectedShape() {
    if (!selectedShapeId) return;
    state.shapeInstances = lastShapeInstances.filter(function (shape) {
      return shape.id !== selectedShapeId;
    });
    lastShapeInstances = state.shapeInstances;
    selectedShapeId = null;
    updateSelectionUI();
    schedulePreview();
  }

  function moveSelectedLayer(direction) {
    var shape = getSelectedShape();
    if (!shape) return;
    var index = lastShapeInstances.indexOf(shape);
    var nextIndex = clamp(index + direction, 0, lastShapeInstances.length - 1);
    if (index === nextIndex) return;
    lastShapeInstances.splice(index, 1);
    lastShapeInstances.splice(nextIndex, 0, shape);
    lastShapeInstances.forEach(function (item, itemIndex) {
      item.zIndex = itemIndex;
    });
    state.shapeInstances = lastShapeInstances;
    schedulePreview();
  }

  function clearTrajectory() {
    trajectoryDraftStrokes = [];
    state.mappingArrangementConfig.trajectoryStrokes = [];
    invalidateShapeInstances();
    updateMappingArrangementControls();
    schedulePreview();
  }

  function confirmTrajectory() {
    if (!hasTrajectoryDraft()) {
      setStatus("请先在映射图上绘制轨迹");
      return;
    }
    state.mappingArrangementConfig.trajectoryStrokes = trajectoryDraftStrokes.map(function (stroke) {
      return stroke.map(function (point) {
        return { x: point.x, y: point.y };
      });
    });
    trajectoryDraftStrokes = [];
    invalidateShapeInstances();
    updateMappingArrangementControls();
    setStatus("轨迹已确认");
    schedulePreview();
  }

  function clearTargetTrajectory() {
    targetTrajectoryDraftStrokes = [];
    state.targetTrajectoryStrokes = [];
    state.targetManualPositions = {};
    invalidateShapeInstances();
    updateMappingArrangementControls();
    schedulePreview();
  }

  function confirmTargetTrajectory() {
    if (!hasTargetTrajectoryDraft()) {
      setStatus("请先在目标图片上绘制轨迹");
      return;
    }
    state.targetTrajectoryStrokes = targetTrajectoryDraftStrokes.map(function (stroke) {
      return stroke.map(function (point) {
        return { x: point.x, y: point.y };
      });
    });
    targetTrajectoryDraftStrokes = [];
    invalidateShapeInstances();
    updateMappingArrangementControls();
    setStatus("目标轨迹已确认");
    schedulePreview();
  }

  function updateMappingPreview() {
    if (!state.targetImage) {
      var emptyCanvas = elements.mappingPreview;
      emptyCanvas.width = 320;
      emptyCanvas.height = 160;
      var emptyContext = emptyCanvas.getContext("2d");
      emptyContext.clearRect(0, 0, emptyCanvas.width, emptyCanvas.height);
      return;
    }
    effects
      .renderMappingPreview(
        elements.mappingPreview,
        sourceType() === "uploaded" ? state.mappingImage : null,
        state.mappingConfig,
        state.colorConfig.palette,
        {
          sourceType: sourceType(),
          width: 420,
        },
      )
      .catch(function (error) {
        setStatus(error.message || "映射预览失败");
      });
  }

  function renderPreview() {
    if (renderTimer) {
      window.cancelAnimationFrame(renderTimer);
      renderTimer = 0;
    }
    renderTimer = window.requestAnimationFrame(function () {
      if (!state.targetImage) {
        var canvas = elements.previewCanvas;
        canvas.width = 1000;
        canvas.height = 700;
        lastLayout = null;
        lastShapeInstances = [];
        var ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#eef0f2";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        elements.canvasMeta.textContent = "画布未生成";
        elements.shapeMeta.textContent = "形状 0";
        syncInteractionCanvas();
        return;
      }
      updateMappingPreview();
      effects
        .render(elements.previewCanvas, state, {
          purpose: "preview",
          maxSide: 1200,
          previewQuality: "high",
          signal: null,
        })
        .then(function (result) {
          state.canvasConfig.canvasWidth = result.canvasWidth;
          state.canvasConfig.canvasHeight = result.canvasHeight;
          state.exportConfig.outputWidth = result.canvasWidth;
          state.exportConfig.outputHeight = result.canvasHeight;
          lastLayout = result.layout;
          lastShapeInstances = result.mappingShapes;
          state.shapeInstances = result.mappingShapes;
          if (
            selectedShapeId &&
            !state.shapeInstances.some(function (shape) {
              return shape.id === selectedShapeId;
            })
          ) {
            selectedShapeId = null;
          }
          elements.canvasMeta.textContent = result.canvasWidth + " × " + result.canvasHeight;
          elements.shapeMeta.textContent = "形状 " + result.mappingShapes.length;
          syncInteractionCanvas();
          updateSelectionUI();
          setStatus("预览已更新");
        })
        .catch(function (error) {
          setStatus(error.message || "生成失败");
        });
    });
  }

  function schedulePreview() {
    renderPreview();
  }

  function invalidateShapeInstances() {
    state.shapeInstances = null;
    lastShapeInstances = [];
    selectedShapeId = null;
    updateSelectionUI();
  }

  function bindSegments(element, onSelect) {
    element.addEventListener("click", function (event) {
      var button = event.target.closest("[data-value]");
      if (!button) return;
      setGroupValue(element, button.dataset.value);
      onSelect(button.dataset.value);
    });
  }

  function bindRange(input, output, formatter, setter, fastPreview) {
    input.addEventListener("input", function () {
      var value = Number(input.value);
      output.textContent = formatter(value);
      setter(value);
      if (fastPreview) updateMappingPreview();
      schedulePreview();
    });
  }

  async function loadTarget(file) {
    if (!file) return;
    setStatus("正在读取目标图片");
    try {
      var asset = await effects.prepareAsset(file);
      var palette = await effects.extractPalette(asset, 8);
      state.targetImage = asset;
      state.colorConfig.palette = palette;
      selectedPaletteIndex = 0;
      state.mappingConfig.baseColor = state.colorConfig.palette[0] || null;
      state.mappingImage = null;
      state._uploadedMappingAsset = null;
      mappingSourceMode = "generated";
      state.mappingArrangementConfig.trajectoryStrokes = [];
      state.manualShapePositions = {};
      state.targetTrajectoryStrokes = [];
      state.targetManualPositions = {};
      trajectoryDraftStrokes = [];
      targetTrajectoryDraftStrokes = [];
      state.mappingConfig.sourceTargetImage = true;
      state.randomSeed = Date.now();
      state.shapeInstances = null;
      updatePaletteUI();
      setGroupValue(elements.mappingSourceGroup, "generated");
      elements.sourceNote.textContent = "使用目标图片色系生成映射图。";
      syncStartView();
      schedulePreview();
      setStatus("目标图片已就绪");
    } catch (error) {
      setStatus(error.message || "目标图片读取失败");
    }
  }

  async function loadMapping(file) {
    if (!file) return;
    setStatus("正在读取映射图片");
    try {
      var asset = await effects.prepareAsset(file);
      state._uploadedMappingAsset = asset;
      state.mappingImage = asset;
      mappingSourceMode = "uploaded";
      state.mappingImage.sourceType = "uploaded";
      state.mappingConfig.sourceTargetImage = false;
      setGroupValue(elements.mappingSourceGroup, "uploaded");
      elements.sourceNote.textContent = "映射图保持自身色系，形状仍从目标图片相近色取色。";
      syncStartView();
      schedulePreview();
      setStatus("映射图片已就绪");
    } catch (error) {
      setStatus(error.message || "映射图片读取失败");
    }
  }

  function useGeneratedMapping() {
    state.mappingImage = null;
    mappingSourceMode = "generated";
    state.mappingConfig.sourceTargetImage = true;
    elements.sourceNote.textContent = "使用目标图片色系生成映射图。";
    setGroupValue(elements.mappingSourceGroup, "generated");
    syncStartView();
  }

  function useUploadedMapping() {
    mappingSourceMode = "uploaded";
    if (state._uploadedMappingAsset) {
      state.mappingImage = state._uploadedMappingAsset;
      state.mappingImage.sourceType = "uploaded";
      state.mappingConfig.sourceTargetImage = false;
      elements.sourceNote.textContent = "映射图保持自身色系，形状仍从目标图片相近色取色。";
      setGroupValue(elements.mappingSourceGroup, "uploaded");
      syncStartView();
    } else {
      state.mappingImage = null;
      state.mappingConfig.sourceTargetImage = false;
      setGroupValue(elements.mappingSourceGroup, "uploaded");
      elements.sourceNote.textContent = "请选择映射图片。";
      syncStartView();
      setStatus("请先选择映射图片");
    }
  }

  function toggleShapeType(type) {
    var enabled = state.shapeConfig.enabledTypes.slice();
    var index = enabled.indexOf(type);
    if (index === -1) enabled.push(type);
    else if (enabled.length > 1) enabled.splice(index, 1);
    state.shapeConfig.enabledTypes = enabled;
    invalidateShapeInstances();
    setShapeGroups();
    schedulePreview();
  }

  function readNumber(input, fallback) {
    var value = Number(input.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function bindControls() {
    elements.startEditingButton.addEventListener("click", openEditor);
    elements.brandButton.addEventListener("click", function (event) {
      if (event.target.closest("button")) return;
      goToStart();
    });

    elements.targetInput.addEventListener("change", function () {
      loadTarget(elements.targetInput.files[0]);
    });

    elements.mappingInput.addEventListener("change", function () {
      loadMapping(elements.mappingInput.files[0]);
    });

    bindSegments(elements.mappingSourceGroup, function (value) {
      if (value === "uploaded") useUploadedMapping();
      else useGeneratedMapping();
      schedulePreview();
    });

    elements.paletteStrip.addEventListener("click", function (event) {
      var swatch = event.target.closest(".palette-swatch");
      if (!swatch) return;
      selectPaletteColor(Number(swatch.dataset.index));
    });

    bindSegments(elements.mappingModeGroup, function (value) {
      state.mappingConfig.mode = value;
      elements.mappingModeLabel.textContent =
        value === "solid" ? "纯色" : value === "gradient" ? "渐变" : "晕染";
      updateMappingPreview();
      schedulePreview();
    });

    elements.textureEnabledInput.addEventListener("change", function () {
      state.mappingConfig.textureEnabled = elements.textureEnabledInput.checked;
      elements.textureOptions.hidden = !elements.textureEnabledInput.checked;
      updateMappingPreview();
      schedulePreview();
    });

    bindSegments(elements.textureTypeGroup, function (value) {
      state.mappingConfig.textureType = value;
      updateMappingPreview();
      schedulePreview();
    });

    bindRange(
      elements.strengthInput,
      elements.strengthOutput,
      function (value) {
        return value + "%";
      },
      function (value) {
        state.mappingConfig.effectStrength = value;
      },
      true,
    );

    elements.gradientDirection.addEventListener("change", function () {
      state.mappingConfig.gradientDirection = elements.gradientDirection.value;
      updateMappingPreview();
      schedulePreview();
    });

    elements.shapeTypeGroup.addEventListener("click", function (event) {
      var button = event.target.closest("[data-value]");
      if (button) toggleShapeType(button.dataset.value);
    });

    bindRange(
      elements.countInput,
      elements.countOutput,
      function (value) {
        elements.shapeCountLabel.textContent = value + " 个";
        return value;
      },
      function (value) {
        state.shapeConfig.totalCount = value;
        invalidateShapeInstances();
      },
    );

    bindRange(
      elements.minSizeInput,
      elements.minSizeOutput,
      function (value) {
        return value + "%";
      },
      function (value) {
        state.shapeConfig.minSize = value;
        invalidateShapeInstances();
      },
    );

    bindRange(
      elements.maxSizeInput,
      elements.maxSizeOutput,
      function (value) {
        return value + "%";
      },
      function (value) {
        state.shapeConfig.maxSize = value;
        invalidateShapeInstances();
      },
    );

    bindRange(
      elements.minRotationInput,
      elements.minRotationOutput,
      function (value) {
        return value + "°";
      },
      function (value) {
        state.shapeConfig.minRotation = value;
        invalidateShapeInstances();
      },
    );

    bindRange(
      elements.maxRotationInput,
      elements.maxRotationOutput,
      function (value) {
        return value + "°";
      },
      function (value) {
        state.shapeConfig.maxRotation = value;
        invalidateShapeInstances();
      },
    );

    bindRange(
      elements.opacityInput,
      elements.opacityOutput,
      function (value) {
        return value + "%";
      },
      function (value) {
        state.shapeConfig.opacity = value / 100;
        invalidateShapeInstances();
      },
    );

    bindSegments(elements.samplingModeGroup, function (value) {
      state.colorConfig.samplingMode = value;
      invalidateShapeInstances();
      if (value === "trajectory" && !state.targetTrajectoryStrokes.length) {
        preferredInteractionOwner = "target";
        setStatus("请在目标图片上绘制并确认轨迹");
      } else if (value === "manual") {
        preferredInteractionOwner = "target";
        setStatus("请点击目标图片上的形状并拖动位置");
      } else if (
        state.mappingArrangementConfig.mode === "trajectory" ||
        state.mappingArrangementConfig.mode === "manual"
      ) {
        preferredInteractionOwner = "mapping";
      }
      updateMappingArrangementControls();
      schedulePreview();
    });

    var targetSamplingButton = elements.samplingModeGroup.querySelector('[data-value="trajectory"]');
    ["mouseenter", "focus"].forEach(function (eventName) {
      targetSamplingButton.addEventListener(eventName, function () {
        elements.targetSamplingTooltip.classList.add("is-visible");
      });
    });
    ["mouseleave", "blur"].forEach(function (eventName) {
      targetSamplingButton.addEventListener(eventName, function () {
        elements.targetSamplingTooltip.classList.remove("is-visible");
      });
    });

    elements.clearTargetTrajectoryButton.addEventListener("click", clearTargetTrajectory);
    elements.confirmTargetTrajectoryButton.addEventListener("click", confirmTargetTrajectory);

    bindSegments(elements.arrangementGroup, function (value) {
      state.arrangementConfig.mode = value;
      invalidateShapeInstances();
      elements.arrangementLabel.textContent =
        value === "random" ? "随机散布" : value === "grid" ? "网格" : "围绕中央";
      schedulePreview();
    });

    bindSegments(elements.mappingArrangementGroup, function (value) {
      state.mappingArrangementConfig.mode = value;
      invalidateShapeInstances();
      if (value === "trajectory") {
        preferredInteractionOwner = "mapping";
        setStatus("请在映射图上绘制轨迹");
      } else if (value === "manual") {
        preferredInteractionOwner = "mapping";
        setStatus("请点击映射图上的形状并拖动位置");
      } else if (
        state.colorConfig.samplingMode === "trajectory" ||
        state.colorConfig.samplingMode === "manual"
      ) {
        preferredInteractionOwner = "target";
      }
      updateMappingArrangementControls();
      schedulePreview();
    });

    bindRange(
      elements.mappingDensityInput,
      elements.mappingDensityOutput,
      function (value) {
        return value + "%";
      },
      function (value) {
        state.mappingArrangementConfig.density = value;
        invalidateShapeInstances();
      },
    );

    var trajectoryButton = elements.mappingArrangementGroup.querySelector('[data-value="trajectory"]');
    ["mouseenter", "focus"].forEach(function (eventName) {
      trajectoryButton.addEventListener(eventName, function () {
        elements.trajectoryTooltip.classList.add("is-visible");
      });
    });
    ["mouseleave", "blur"].forEach(function (eventName) {
      trajectoryButton.addEventListener(eventName, function () {
        elements.trajectoryTooltip.classList.remove("is-visible");
      });
    });

    elements.clearTrajectoryButton.addEventListener("click", clearTrajectory);
    elements.confirmTrajectoryButton.addEventListener("click", confirmTrajectory);
    elements.interactionCanvas.addEventListener("pointerdown", handleInteractionPointerDown);
    elements.interactionCanvas.addEventListener("pointermove", handleInteractionPointerMove);
    elements.interactionCanvas.addEventListener("pointerup", finishInteraction);
    elements.interactionCanvas.addEventListener("pointercancel", finishInteraction);
    elements.copyShapeButton.addEventListener("click", duplicateSelectedShape);
    elements.deleteShapeButton.addEventListener("click", deleteSelectedShape);
    elements.moveUpButton.addEventListener("click", function () {
      moveSelectedLayer(1);
    });
    elements.moveDownButton.addEventListener("click", function () {
      moveSelectedLayer(-1);
    });

    elements.gridColumnsInput.addEventListener("input", function () {
      state.arrangementConfig.gridColumns = clamp(readNumber(elements.gridColumnsInput, 6), 1, 20);
      invalidateShapeInstances();
      schedulePreview();
    });

    elements.gridRowsInput.addEventListener("input", function () {
      state.arrangementConfig.gridRows = clamp(readNumber(elements.gridRowsInput, 6), 1, 20);
      invalidateShapeInstances();
      schedulePreview();
    });

    bindRange(
      elements.safeWidthInput,
      elements.safeWidthOutput,
      function (value) {
        return value + "%";
      },
      function (value) {
        state.arrangementConfig.centralSafeWidth = value;
        invalidateShapeInstances();
      },
    );

    bindRange(
      elements.safeHeightInput,
      elements.safeHeightOutput,
      function (value) {
        return value + "%";
      },
      function (value) {
        state.arrangementConfig.centralSafeHeight = value;
        invalidateShapeInstances();
      },
    );

    bindSegments(elements.compositionGroup, function (value) {
      state.canvasConfig.composition = value;
      invalidateShapeInstances();
      elements.compositionLabel.textContent =
        value === "sideBySide"
          ? "左右拼接"
          : value === "stacked"
            ? "上下拼接"
            : value === "surround"
              ? "环绕"
              : "无映射";
      syncPositionSelect();
      updateMappingPositions();
      schedulePreview();
    });

    elements.targetPosition.addEventListener("change", function () {
      state.canvasConfig.targetPosition = elements.targetPosition.value;
      invalidateShapeInstances();
      updateMappingPositions();
      schedulePreview();
    });

    elements.surroundRatio.addEventListener("change", function () {
      state.canvasConfig.surroundRatio = elements.surroundRatio.value;
      state.exportConfig.surroundRatio = elements.surroundRatio.value;
      invalidateShapeInstances();
      schedulePreview();
    });

    elements.mappingFit.addEventListener("change", function () {
      state.canvasConfig.mappingFit = elements.mappingFit.value;
      schedulePreview();
    });

    bindSegments(elements.exportFormatGroup, function (value) {
      state.exportConfig.format = value;
    });

    elements.regenerateButton.addEventListener("click", regenerateWorkspace);

    elements.exportButton.addEventListener("click", exportImage);
    elements.mobileRegenerateButton.addEventListener("click", regenerateWorkspace);
    elements.mobileExportButton.addEventListener("click", exportImage);
    elements.demoButton.addEventListener("click", loadDemo);
  }

  function regenerateWorkspace() {
    if (!state.targetImage) return;
    state.randomSeed = Date.now() % 2147483647;
    setStatus("正在重新生成");
    effects
      .regenerate(elements.previewCanvas, state, {
        purpose: "preview",
        maxSide: 1200,
        previewQuality: "high",
        signal: null,
      })
      .then(function (result) {
        lastLayout = result.layout;
        lastShapeInstances = result.mappingShapes;
        state.shapeInstances = result.mappingShapes;
        state.canvasConfig.canvasWidth = result.canvasWidth;
        state.canvasConfig.canvasHeight = result.canvasHeight;
        elements.canvasMeta.textContent = result.canvasWidth + " × " + result.canvasHeight;
        elements.shapeMeta.textContent = "形状 " + result.mappingShapes.length;
        syncInteractionCanvas();
        setStatus("已重新生成，手动形状保持不变");
      })
      .catch(function (error) {
        setStatus(error.message || "重新生成失败");
      });
  }

  function createDemoTargetCanvas() {
    var canvas = createCanvas(1200, 900);
    var ctx = canvas.getContext("2d");
    var sky = ctx.createLinearGradient(0, 0, 0, 900);
    sky.addColorStop(0, "#2c78b8");
    sky.addColorStop(0.52, "#79b7d9");
    sky.addColorStop(1, "#f0c777");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 1200, 900);

    ctx.fillStyle = "#f3e7c8";
    ctx.beginPath();
    ctx.arc(910, 190, 80, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    [
      [240, 210, 120],
      [380, 180, 86],
      [590, 260, 140],
      [820, 320, 92],
    ].forEach(function (cloud) {
      ctx.beginPath();
      ctx.arc(cloud[0], cloud[1], cloud[2], 0, Math.PI * 2);
      ctx.arc(cloud[0] + cloud[2] * 0.7, cloud[1] + 16, cloud[2] * 0.72, 0, Math.PI * 2);
      ctx.arc(cloud[0] - cloud[2] * 0.65, cloud[1] + 20, cloud[2] * 0.58, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = "#315f3d";
    ctx.beginPath();
    ctx.moveTo(0, 720);
    ctx.bezierCurveTo(240, 560, 410, 760, 620, 640);
    ctx.bezierCurveTo(820, 520, 1010, 670, 1200, 590);
    ctx.lineTo(1200, 900);
    ctx.lineTo(0, 900);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#1f3d2b";
    ctx.beginPath();
    ctx.moveTo(0, 790);
    ctx.bezierCurveTo(300, 680, 490, 840, 760, 700);
    ctx.bezierCurveTo(940, 610, 1060, 760, 1200, 710);
    ctx.lineTo(1200, 900);
    ctx.lineTo(0, 900);
    ctx.closePath();
    ctx.fill();

    var flowerColors = ["#d74b57", "#b62f45", "#f08a56", "#f4c84e", "#e9d6c7"];
    flowerColors.forEach(function (color, index) {
      var x = 150 + index * 210;
      var y = 610 + (index % 2) * 90;
      ctx.fillStyle = color;
      for (var petal = 0; petal < 6; petal += 1) {
        var angle = (Math.PI * 2 * petal) / 6;
        ctx.beginPath();
        ctx.ellipse(
          x + Math.cos(angle) * 17,
          y + Math.sin(angle) * 17,
          21,
          12,
          angle,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.fillStyle = "#f1b83e";
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
    });

    return canvas;
  }

  async function loadDemo() {
    setStatus("正在生成演示素材");
    try {
      var asset = await effects.createAssetFromCanvas(createDemoTargetCanvas(), "prototype-demo.png");
      var palette = await effects.extractPalette(asset, 8);
      state.targetImage = asset;
      state.colorConfig.palette = palette;
      selectedPaletteIndex = 0;
      state.mappingConfig.baseColor = state.colorConfig.palette[0] || null;
      state.mappingImage = null;
      state._uploadedMappingAsset = null;
      mappingSourceMode = "generated";
      state.mappingArrangementConfig.trajectoryStrokes = [];
      state.manualShapePositions = {};
      state.targetTrajectoryStrokes = [];
      state.targetManualPositions = {};
      trajectoryDraftStrokes = [];
      targetTrajectoryDraftStrokes = [];
      state.mappingConfig.sourceTargetImage = true;
      state.randomSeed = Date.now();
      state.shapeInstances = null;
      updatePaletteUI();
      setGroupValue(elements.mappingSourceGroup, "generated");
      elements.sourceNote.textContent = "使用目标图片色系生成映射图。";
      syncStartView();
      schedulePreview();
      setStatus("示例素材已就绪");
    } catch (error) {
      setStatus(error.message || "演示素材生成失败");
    }
  }

  async function exportImage() {
    if (!state.targetImage) {
      setStatus("请先选择目标图片");
      return;
    }
    elements.exportButton.disabled = true;
    setStatus("正在导出图片");
    try {
      var result = await effects.exportBlob(state, {
        purpose: "export",
        maxSide: 2048,
        previewQuality: "high",
        signal: null,
      });
      var url = URL.createObjectURL(result.blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = result.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 8000);
      setStatus(result.mimeType === "image/jpeg" ? "JPG 已导出" : "PNG 已导出");
    } catch (error) {
      setStatus(error.message || "导出失败");
    } finally {
      elements.exportButton.disabled = false;
    }
  }

  function initialize() {
    cacheElements();
    if (!effects) {
      elements.status.textContent = "ImageEffectsV1 未加载";
      return;
    }
    updatePaletteUI();
    syncPositionSelect();
    updateMappingPositions();
    updateMappingArrangementControls();
    bindControls();
    syncInteractionCanvas();
    syncStartView();
  }

  document.addEventListener("DOMContentLoaded", initialize);
})();
