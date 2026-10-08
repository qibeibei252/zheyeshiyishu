(function () {
  "use strict";

  var util = window.ImageEffectsUtil;
  var paletteTools = window.ImageEffectsPalette;

  function parseRatio(value) {
    var parts = String(value || "4:3").split(":");
    var width = Number(parts[0]) || 4;
    var height = Number(parts[1]) || 3;
    return width / height;
  }

  function calculateLayout(projectState, options) {
    var targetSize = util.imageSize(projectState.targetImage);
    var mappingSize = projectState.mappingImage
      ? util.imageSize(projectState.mappingImage)
      : targetSize;
    var maxSide = (options && options.maxSide) || 2048;
    var composition = projectState.canvasConfig.composition || "sideBySide";
    var natural = null;

    if (composition === "targetOnly") {
      natural = {
        width: targetSize.width,
        height: targetSize.height,
        targetRect: { x: 0, y: 0, width: targetSize.width, height: targetSize.height },
        mappingRect: { x: 0, y: 0, width: targetSize.width, height: targetSize.height },
      };
    } else if (composition === "stacked") {
      var baseWidth = Math.min(1400, Math.max(targetSize.width, mappingSize.width));
      var targetHeight = baseWidth * (targetSize.height / targetSize.width);
      var mappingHeight = baseWidth * (mappingSize.height / mappingSize.width);
      var topIsTarget = projectState.canvasConfig.targetPosition !== "bottom";
      natural = {
        width: baseWidth,
        height: targetHeight + mappingHeight,
        targetRect: { x: 0, y: topIsTarget ? 0 : mappingHeight, width: baseWidth, height: targetHeight },
        mappingRect: { x: 0, y: topIsTarget ? targetHeight : 0, width: baseWidth, height: mappingHeight },
      };
    } else if (composition === "surround") {
      var ratio = parseRatio(projectState.canvasConfig.surroundRatio);
      var outputWidth = ratio < 1 ? 1100 : 1500;
      var outputHeight = outputWidth / ratio;
      var fit = util.fitContain(targetSize.width, targetSize.height, outputWidth * 0.7, outputHeight * 0.72);
      natural = {
        width: outputWidth,
        height: outputHeight,
        targetRect: {
          x: (outputWidth - fit.width) / 2,
          y: (outputHeight - fit.height) / 2,
          width: fit.width,
          height: fit.height,
        },
        mappingRect: { x: 0, y: 0, width: outputWidth, height: outputHeight },
      };
    } else {
      var baseHeight = Math.min(1400, Math.max(targetSize.height, mappingSize.height));
      var scaledTargetWidth = baseHeight * (targetSize.width / targetSize.height);
      var scaledMappingWidth = baseHeight * (mappingSize.width / mappingSize.height);
      var targetFirst = projectState.canvasConfig.targetPosition !== "right";
      natural = {
        width: scaledTargetWidth + scaledMappingWidth,
        height: baseHeight,
        targetRect: {
          x: targetFirst ? 0 : scaledMappingWidth,
          y: 0,
          width: scaledTargetWidth,
          height: baseHeight,
        },
        mappingRect: {
          x: targetFirst ? scaledTargetWidth : 0,
          y: 0,
          width: scaledMappingWidth,
          height: baseHeight,
        },
      };
    }

    var scale = Math.min(1, maxSide / Math.max(natural.width, natural.height));
    natural.width *= scale;
    natural.height *= scale;
    natural.targetRect = scaleRect(natural.targetRect, scale);
    natural.mappingRect = scaleRect(natural.mappingRect, scale);

    if (composition === "surround") {
      natural.safeRect = inflateRect(natural.targetRect, 18);
    } else {
      var safeWidth = natural.mappingRect.width * (projectState.arrangementConfig.centralSafeWidth / 100);
      var safeHeight = natural.mappingRect.height * (projectState.arrangementConfig.centralSafeHeight / 100);
      natural.safeRect = {
        x: natural.mappingRect.x + (natural.mappingRect.width - safeWidth) / 2,
        y: natural.mappingRect.y + (natural.mappingRect.height - safeHeight) / 2,
        width: safeWidth,
        height: safeHeight,
      };
    }

    natural.scale = scale;
    return natural;
  }

  function scaleRect(rect, scale) {
    return {
      x: rect.x * scale,
      y: rect.y * scale,
      width: rect.width * scale,
      height: rect.height * scale,
    };
  }

  function inflateRect(rect, amount) {
    return {
      x: rect.x - amount,
      y: rect.y - amount,
      width: rect.width + amount * 2,
      height: rect.height + amount * 2,
    };
  }

  function pickShapeSize(rng, shapes, region) {
    var minPercent = Math.min(shapes.minSize, shapes.maxSize);
    var maxPercent = Math.max(shapes.minSize, shapes.maxSize);
    return (util.randomBetween(rng, minPercent, maxPercent) / 100) * Math.min(region.width, region.height);
  }

  function shapeAspect(type, rng) {
    if (type === "bird") return util.randomBetween(rng, 0.88, 0.98);
    if (type === "circle") return 1;
    if (type === "square") return util.randomBetween(rng, 0.92, 1.08);
    if (type === "fiveStar") return util.randomBetween(rng, 0.9, 1.1);
    if (type === "fourStar") return util.randomBetween(rng, 0.94, 1.06);
    if (type === "cross" || type === "puzzle" || type === "eightFlower") return 1;
    return util.randomBetween(rng, 0.84, 1.16);
  }

  function randomPlacement(rng, region, radius) {
    return {
      x: util.randomBetween(rng, region.x + radius, region.x + region.width - radius),
      y: util.randomBetween(rng, region.y + radius, region.y + region.height - radius),
    };
  }

  function isOutsideSafeRect(point, radius, safeRect) {
    return (
      point.x + radius < safeRect.x ||
      point.x - radius > safeRect.x + safeRect.width ||
      point.y + radius < safeRect.y ||
      point.y - radius > safeRect.y + safeRect.height
    );
  }

  function aroundPlacement(rng, region, safeRect, radius) {
    for (var attempt = 0; attempt < 240; attempt += 1) {
      var point = randomPlacement(rng, region, radius);
      if (isOutsideSafeRect(point, radius, safeRect)) return point;
    }

    var centerX = safeRect.x + safeRect.width / 2;
    var centerY = safeRect.y + safeRect.height / 2;
    var angle = util.randomBetween(rng, -Math.PI, Math.PI);
    var distanceX = safeRect.width / 2 + radius + util.randomBetween(rng, 4, Math.max(8, region.width * 0.16));
    var distanceY = safeRect.height / 2 + radius + util.randomBetween(rng, 4, Math.max(8, region.height * 0.16));
    return {
      x: util.clamp(centerX + Math.cos(angle) * distanceX, region.x + radius, region.x + region.width - radius),
      y: util.clamp(centerY + Math.sin(angle) * distanceY, region.y + radius, region.y + region.height - radius),
    };
  }

  function gridPlacement(index, rng, region, radius, config) {
    var columns = util.clamp(Math.round(config.gridColumns || 6), 1, 20);
    var rows = util.clamp(Math.round(config.gridRows || 6), 1, 20);
    var cellWidth = region.width / columns;
    var cellHeight = region.height / rows;
    var column = index % columns;
    var row = Math.floor(index / columns) % rows;
    var jitter = util.clamp(Number(config.jitter) || 0, 0, 45) / 100;
    var centerX = region.x + cellWidth * (column + 0.5);
    var centerY = region.y + cellHeight * (row + 0.5);
    return {
      x: util.clamp(
        centerX + util.randomBetween(rng, -cellWidth * jitter, cellWidth * jitter),
        region.x + radius,
        region.x + region.width - radius,
      ),
      y: util.clamp(
        centerY + util.randomBetween(rng, -cellHeight * jitter, cellHeight * jitter),
        region.y + radius,
        region.y + region.height - radius,
      ),
    };
  }

  function buildCentralPlacements(plans, region, density) {
    var compactness = util.clamp(Number(density) || 0, 0, 100) / 100;
    var centralAreaScale = 0.42 + (1 - compactness) * 0.34;
    var availableWidth = region.width * centralAreaScale;
    var availableHeight = region.height * centralAreaScale;
    var averageWidth = plans.reduce(function (total, plan) {
      return total + plan.width;
    }, 0) / Math.max(1, plans.length);
    var averageHeight = plans.reduce(function (total, plan) {
      return total + plan.height;
    }, 0) / Math.max(1, plans.length);
    var columns = util.clamp(
      Math.round(Math.sqrt(plans.length * (averageWidth / Math.max(1, averageHeight)))),
      1,
      Math.max(1, plans.length),
    );
    var rows = [];
    for (var planIndex = 0; planIndex < plans.length; planIndex += columns) {
      var rowPlans = plans.slice(planIndex, planIndex + columns);
      rows.push({
        items: rowPlans,
        naturalWidth: rowPlans.reduce(function (total, plan) {
          return total + plan.width;
        }, 0),
        height: rowPlans.reduce(function (maximum, plan) {
          return Math.max(maximum, plan.height);
        }, 0),
      });
    }

    var averageSize = plans.reduce(function (total, plan) {
      return total + Math.max(plan.width, plan.height);
    }, 0) / Math.max(1, plans.length);
    var targetGap = averageSize * 0.82 * (1 - compactness);
    var rowWidths = rows.map(function (row) {
      var maximumGap = row.items.length > 1
        ? Math.max(0, (availableWidth - row.naturalWidth) / (row.items.length - 1))
        : 0;
      return row.naturalWidth + Math.min(targetGap, maximumGap) * (row.items.length - 1);
    });
    var naturalHeight = rows.reduce(function (total, row) {
      return total + row.height;
    }, 0);
    var maximumRowGap = rows.length > 1
      ? Math.max(0, (availableHeight - naturalHeight) / (rows.length - 1))
      : 0;
    var rowGap = Math.min(targetGap, maximumRowGap);
    var blockHeight = naturalHeight + rowGap * Math.max(0, rows.length - 1);
    var placements = new Array(plans.length);
    var currentY = region.y + (region.height - blockHeight) / 2;

    rows.forEach(function (row, rowIndex) {
      var rowWidth = rowWidths[rowIndex];
      var itemGap = row.items.length > 1
        ? (rowWidth - row.naturalWidth) / (row.items.length - 1)
        : 0;
      var currentX = region.x + (region.width - rowWidth) / 2;
      row.items.forEach(function (plan) {
        placements[plan.index] = {
          x: currentX + plan.width / 2,
          y: currentY + row.height / 2,
        };
        currentX += plan.width + itemGap;
      });
      currentY += row.height + (rowIndex < rows.length - 1 ? rowGap : 0);
    });

    return placements;
  }

  function trajectoryPlacement(index, count, region, strokes) {
    var segments = [];
    var totalLength = 0;
    (strokes || []).forEach(function (stroke) {
      var points = stroke.map(function (point) {
        return {
          x: region.x + util.clamp(point.x, 0, 1) * region.width,
          y: region.y + util.clamp(point.y, 0, 1) * region.height,
        };
      });
      for (var pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
        var previous = points[pointIndex - 1];
        var current = points[pointIndex];
        var length = Math.hypot(current.x - previous.x, current.y - previous.y);
        if (length < 0.5) continue;
        segments.push({ start: previous, end: current, length: length });
        totalLength += length;
      }
    });
    if (!segments.length || totalLength <= 0) return null;

    var targetDistance = ((index + 0.5) / count) * totalLength;
    var travelled = 0;
    for (var segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
      var segment = segments[segmentIndex];
      if (travelled + segment.length >= targetDistance) {
        var amount = (targetDistance - travelled) / segment.length;
        return {
          x: util.lerp(segment.start.x, segment.end.x, amount),
          y: util.lerp(segment.start.y, segment.end.y, amount),
        };
      }
      travelled += segment.length;
    }
    var lastSegment = segments[segments.length - 1];
    return { x: lastSegment.end.x, y: lastSegment.end.y };
  }

  function createShapeInstances(projectState, layout, palette) {
    var shapes = projectState.shapeConfig;
    var arrangement = projectState.arrangementConfig;
    var types = shapes.enabledTypes && shapes.enabledTypes.length
      ? shapes.enabledTypes
      : ["bird"];
    var count = util.clamp(Math.round(shapes.totalCount || 1), 1, 100);
    var rng = util.mulberry32(projectState.randomSeed + ":" + arrangement.mode + ":" + count);
    var targetSize = util.imageSize(projectState.targetImage);
    var region = layout.mappingRect;
    var instances = [];
    var sizePlanningRng = util.mulberry32(
      projectState.randomSeed + ":" + arrangement.mode + ":" + count,
    );
    var plans = [];
    for (var planIndex = 0; planIndex < count; planIndex += 1) {
      var planType = types[planIndex % types.length];
      var planSize = pickShapeSize(sizePlanningRng, shapes, region);
      var planAspect = shapeAspect(planType, sizePlanningRng);
      plans.push({
        index: planIndex,
        type: planType,
        width: planSize * planAspect,
        height: planSize,
      });
    }
    var mappingArrangement = projectState.mappingArrangementConfig || { mode: "correspond", density: 65 };
    var centralPoints = mappingArrangement.mode === "central" || mappingArrangement.mode === "manual"
      ? buildCentralPlacements(plans, region, mappingArrangement.mode === "central" ? mappingArrangement.density : 65)
      : [];

    for (var index = 0; index < count; index += 1) {
      var plan = plans[index];
      var type = plan.type;
      var width = plan.width;
      var height = plan.height;
      var radius = Math.max(width, height) / 2 + 2;
      var targetPoint;

      if (arrangement.mode === "grid") {
        targetPoint = gridPlacement(index, rng, region, radius, arrangement);
      } else if (arrangement.mode === "around") {
        targetPoint = aroundPlacement(rng, region, layout.safeRect, radius);
      } else {
        targetPoint = randomPlacement(rng, region, radius);
      }

      var instanceId = "shape-" + index + "-" + Math.round(projectState.randomSeed);
      var mappingPoint = targetPoint;
      if (projectState.canvasConfig.composition === "targetOnly") {
        mappingPoint = targetPoint;
      } else if (mappingArrangement.mode === "central") {
        mappingPoint = centralPoints[index] || targetPoint;
      } else if (mappingArrangement.mode === "trajectory") {
        mappingPoint = trajectoryPlacement(
          index,
          count,
          region,
          mappingArrangement.trajectoryStrokes,
        ) || targetPoint;
      } else if (mappingArrangement.mode === "manual") {
        mappingPoint = centralPoints[index] || targetPoint;
      }

      var manualPosition = projectState.manualShapePositions
        && projectState.manualShapePositions[instanceId];
      if (mappingArrangement.mode === "manual" && manualPosition) {
        mappingPoint = {
          x: util.clamp(
            region.x + manualPosition.x * region.width,
            region.x + radius,
            region.x + region.width - radius,
          ),
          y: util.clamp(
            region.y + manualPosition.y * region.height,
            region.y + radius,
            region.y + region.height - radius,
          ),
        };
      }

      var targetPositionFromTarget = false;
      if (
        projectState.colorConfig.samplingMode === "trajectory" &&
        projectState.targetTrajectoryStrokes &&
        projectState.targetTrajectoryStrokes.length
      ) {
        targetPoint = trajectoryPlacement(
          index,
          count,
          layout.targetRect,
          projectState.targetTrajectoryStrokes,
        ) || targetPoint;
        targetPositionFromTarget = true;
      } else if (projectState.colorConfig.samplingMode === "manual") {
        var targetManualPosition = projectState.targetManualPositions
          && projectState.targetManualPositions[instanceId];
        if (targetManualPosition) {
          targetPoint = {
            x: layout.targetRect.x + targetManualPosition.x * layout.targetRect.width,
            y: layout.targetRect.y + targetManualPosition.y * layout.targetRect.height,
          };
          targetPositionFromTarget = true;
        }
      }

      var targetNormalizedX = util.clamp(
        targetPositionFromTarget
          ? (targetPoint.x - layout.targetRect.x) / layout.targetRect.width
          : (targetPoint.x - region.x) / region.width,
        0,
        1,
      );
      var targetNormalizedY = util.clamp(
        targetPositionFromTarget
          ? (targetPoint.y - layout.targetRect.y) / layout.targetRect.height
          : (targetPoint.y - region.y) / region.height,
        0,
        1,
      );
      if (mappingArrangement.mode === "correspond") {
        mappingPoint = {
          x: region.x + targetNormalizedX * region.width,
          y: region.y + targetNormalizedY * region.height,
        };
      }
      var sourceX = targetNormalizedX * targetSize.width;
      var sourceY = targetNormalizedY * targetSize.height;
      var samplingX = sourceX;
      var samplingY = sourceY;
      var color = paletteTools.colorFromTarget(
        projectState.targetImage,
        samplingX,
        samplingY,
        palette,
        projectState.colorConfig.samplingMode,
        rng,
        projectState.mappingConfig.baseColor,
      );

      instances.push({
        id: instanceId,
        type: type,
        x: mappingPoint.x,
        y: mappingPoint.y,
        width: width,
        height: height,
        rotation: util.randomBetween(
          rng,
          Math.min(shapes.minRotation, shapes.maxRotation),
          Math.max(shapes.minRotation, shapes.maxRotation),
        ),
        opacity: util.clamp(Number(shapes.opacity) || 1, 0, 1),
        color: color,
        sourceX: sourceX,
        sourceY: sourceY,
        sampleX: samplingX,
        sampleY: samplingY,
        layer: shapes.defaultLayer || "above",
        isManual: false,
        zIndex: index,
      });
    }

    instances.sort(function (a, b) {
      return a.zIndex - b.zIndex;
    });
    return instances;
  }

  window.ImageEffectsComposition = {
    calculateLayout: calculateLayout,
    createShapeInstances: createShapeInstances,
  };
})();
