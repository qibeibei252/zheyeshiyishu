(function () {
  "use strict";

  var util = window.ImageEffectsUtil;

  function pixelDistance(a, b) {
    var red = a.r - b.r;
    var green = a.g - b.g;
    var blue = a.b - b.b;
    return red * red * 0.9 + green * green * 1.1 + blue * blue;
  }

  function samplePixels(source, maxSamples) {
    var size = util.imageSize(source);
    var scale = Math.min(1, 256 / Math.max(size.width, size.height));
    var width = Math.max(16, Math.round(size.width * scale));
    var height = Math.max(16, Math.round(size.height * scale));
    var canvas = util.createCanvas(width, height);
    var ctx = canvas.getContext("2d", { willReadFrequently: true });
    var image = source.image || source;
    ctx.drawImage(image, 0, 0, width, height);
    var imageData = ctx.getImageData(0, 0, width, height).data;
    var samples = [];
    var step = Math.max(1, Math.floor(Math.sqrt((width * height) / maxSamples)));

    for (var y = 0; y < height; y += step) {
      for (var x = 0; x < width; x += step) {
        var index = (y * width + x) * 4;
        var alpha = imageData[index + 3];
        if (alpha < 210) continue;
        samples.push({
          r: imageData[index],
          g: imageData[index + 1],
          b: imageData[index + 2],
        });
      }
    }
    return samples;
  }

  function reduceSamples(samples) {
    var bins = new Map();
    samples.forEach(function (sample) {
      var key =
        ((sample.r >> 3) << 10) |
        ((sample.g >> 3) << 5) |
        (sample.b >> 3);
      var bin = bins.get(key);
      if (!bin) {
        bin = { r: 0, g: 0, b: 0, count: 0 };
        bins.set(key, bin);
      }
      bin.r += sample.r;
      bin.g += sample.g;
      bin.b += sample.b;
      bin.count += 1;
    });
    return Array.from(bins.values())
      .map(function (bin) {
        return {
          r: bin.r / bin.count,
          g: bin.g / bin.count,
          b: bin.b / bin.count,
          count: bin.count,
        };
      })
      .sort(function (a, b) {
        return b.count - a.count;
      })
      .slice(0, Math.max(24, maxColorsForSamples(samples.length)));
  }

  function maxColorsForSamples(count) {
    return Math.min(120, Math.max(24, Math.round(count / 18)));
  }

  function initializeCenters(points, count) {
    var centers = [points[0]];
    while (centers.length < count) {
      var bestPoint = points[0];
      var bestDistance = -1;
      points.forEach(function (point) {
        var nearest = Infinity;
        centers.forEach(function (center) {
          nearest = Math.min(nearest, pixelDistance(point, center));
        });
        if (nearest > bestDistance) {
          bestDistance = nearest;
          bestPoint = point;
        }
      });
      centers.push(bestPoint);
    }
    return centers.map(function (center) {
      return { r: center.r, g: center.g, b: center.b };
    });
  }

  function kMeans(points, count) {
    if (points.length <= count) {
      return points.map(function (point) {
        return { r: point.r, g: point.g, b: point.b, weight: point.count };
      });
    }

    var centers = initializeCenters(points, count);
    var assignments = new Array(points.length).fill(0);

    for (var iteration = 0; iteration < 12; iteration += 1) {
      var totals = centers.map(function () {
        return { r: 0, g: 0, b: 0, weight: 0 };
      });
      var changed = false;

      for (var i = 0; i < points.length; i += 1) {
        var point = points[i];
        var nearest = 0;
        var nearestDistance = Infinity;
        for (var j = 0; j < centers.length; j += 1) {
          var distance = pixelDistance(point, centers[j]);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = j;
          }
        }
        if (assignments[i] !== nearest) changed = true;
        assignments[i] = nearest;
        totals[nearest].r += point.r * point.count;
        totals[nearest].g += point.g * point.count;
        totals[nearest].b += point.b * point.count;
        totals[nearest].weight += point.count;
      }

      centers = centers.map(function (center, index) {
        var total = totals[index];
        if (!total.weight) return center;
        return {
          r: total.r / total.weight,
          g: total.g / total.weight,
          b: total.b / total.weight,
        };
      });
      if (!changed && iteration > 1) break;
    }

    return centers
      .map(function (center, index) {
        return {
          r: center.r,
          g: center.g,
          b: center.b,
          weight: totalsWeight(points, assignments, index),
        };
      })
      .filter(function (color) {
        return color.weight > 0;
      });
  }

  function totalsWeight(points, assignments, target) {
    return points.reduce(function (total, point, index) {
      return total + (assignments[index] === target ? point.count : 0);
    }, 0);
  }

  function dedupeColors(colors, count) {
    var result = [];
    colors.forEach(function (color) {
      var duplicate = result.some(function (existing) {
        return pixelDistance(existing, color) < 400;
      });
      if (!duplicate) result.push(color);
    });

    var index = 0;
    while (result.length < count) {
      var source = colors[index % Math.max(1, colors.length)] || { r: 128, g: 128, b: 128 };
      var variation = (Math.floor(index / Math.max(1, colors.length)) + 1) * 4;
      result.push({
        r: util.clamp(source.r + variation, 0, 255),
        g: util.clamp(source.g + variation * 0.7, 0, 255),
        b: util.clamp(source.b - variation * 0.5, 0, 255),
      });
      index += 1;
    }
    return result.slice(0, count);
  }

  function extract(source, count) {
    var requested = util.clamp(Number(count) || 8, 4, 12);
    var samples = samplePixels(source, 4200);
    if (!samples.length) return ["#d9d9d6", "#b8b8b3", "#92928c", "#65655f"];
    var reduced = reduceSamples(samples);
    var centers = kMeans(reduced, requested);
    centers.sort(function (a, b) {
      return util.luminance(a.r, a.g, a.b) - util.luminance(b.r, b.g, b.b);
    });
    return dedupeColors(centers, Math.min(requested, 8)).map(function (color) {
      return util.rgbToHex(color.r, color.g, color.b);
    });
  }

  function averageSourceColor(source, x, y, radius) {
    var size = util.imageSize(source);
    var safeRadius = Math.max(0, radius || 3);
    var left = util.clamp(Math.round(x - safeRadius), 0, Math.max(0, size.width - 1));
    var top = util.clamp(Math.round(y - safeRadius), 0, Math.max(0, size.height - 1));
    var right = util.clamp(Math.round(x + safeRadius), 0, Math.max(0, size.width - 1));
    var bottom = util.clamp(Math.round(y + safeRadius), 0, Math.max(0, size.height - 1));
    var width = Math.max(1, right - left + 1);
    var height = Math.max(1, bottom - top + 1);
    var canvas = util.createCanvas(width, height);
    var ctx = canvas.getContext("2d", { willReadFrequently: true });
    var image = source.image || source;
    ctx.drawImage(image, left, top, width, height, 0, 0, width, height);
    var data = ctx.getImageData(0, 0, width, height).data;
    var totals = { r: 0, g: 0, b: 0, count: 0 };
    for (var i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 80) continue;
      totals.r += data[i];
      totals.g += data[i + 1];
      totals.b += data[i + 2];
      totals.count += 1;
    }
    if (!totals.count) return { r: 128, g: 128, b: 128 };
    return {
      r: totals.r / totals.count,
      g: totals.g / totals.count,
      b: totals.b / totals.count,
    };
  }

  function nearest(palette, rgb) {
    var best = palette[0] || "#808080";
    var nearestDistance = Infinity;
    palette.forEach(function (color) {
      var candidate = util.hexToRgb(color);
      var distance = pixelDistance(candidate, rgb);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        best = color;
      }
    });
    return best;
  }

  function colorFromTarget(source, x, y, palette, mode, rng, primaryColor) {
    mode = mode || "local";
    var local = averageSourceColor(source, x, y, 4);
    if (mode === "palette") {
      var paletteColor = primaryColor || palette[Math.floor(rng() * palette.length)];
      var nearbyColor = palette[Math.floor(rng() * palette.length)];
      var sourceColor = rng() < 0.78 ? paletteColor : nearbyColor;
      return util.adjustColor(sourceColor, {
        lightness: util.randomBetween(rng, -7, 7),
        saturation: util.randomBetween(rng, -5, 5),
      });
    }
    if (mode === "mixed") {
      var paletteColor = nearest(palette, local);
      var mixed = util.mixColors(paletteColor, util.rgbToHex(local.r, local.g, local.b), 0.38);
      return nearest(palette, util.hexToRgb(mixed));
    }
    return nearest(palette, local);
  }

  window.ImageEffectsPalette = {
    extract: extract,
    averageSourceColor: averageSourceColor,
    nearest: nearest,
    colorFromTarget: colorFromTarget,
  };
})();
