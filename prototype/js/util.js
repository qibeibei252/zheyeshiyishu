(function () {
  "use strict";

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function lerp(a, b, amount) {
    return a + (b - a) * amount;
  }

  function hashSeed(seed) {
    var value = String(seed);
    var hash = 2166136261;
    for (var i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function mulberry32(seed) {
    var value = hashSeed(seed);
    return function () {
      value += 0x6d2b79f5;
      var result = value;
      result = Math.imul(result ^ (result >>> 15), result | 1);
      result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
      return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randomBetween(rng, min, max) {
    return min + (max - min) * rng();
  }

  function pick(rng, values) {
    return values[Math.floor(rng() * values.length)];
  }

  function rgbToHex(red, green, blue) {
    return (
      "#" +
      [red, green, blue]
        .map(function (value) {
          return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
        })
        .join("")
    );
  }

  function hexToRgb(hex) {
    var value = String(hex || "").replace("#", "");
    if (value.length === 3) {
      value = value
        .split("")
        .map(function (part) {
          return part + part;
        })
        .join("");
    }
    if (!/^[0-9a-f]{6}$/i.test(value)) {
      return { r: 0, g: 0, b: 0 };
    }
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16),
    };
  }

  function rgbToHsl(red, green, blue) {
    red /= 255;
    green /= 255;
    blue /= 255;
    var max = Math.max(red, green, blue);
    var min = Math.min(red, green, blue);
    var hue = 0;
    var saturation = 0;
    var lightness = (max + min) / 2;
    var delta = max - min;

    if (delta !== 0) {
      saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
      if (max === red) {
        hue = (green - blue) / delta + (green < blue ? 6 : 0);
      } else if (max === green) {
        hue = (blue - red) / delta + 2;
      } else {
        hue = (red - green) / delta + 4;
      }
      hue /= 6;
    }

    return { h: hue * 360, s: saturation * 100, l: lightness * 100 };
  }

  function hueToRgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }

  function hslToRgb(hue, saturation, lightness) {
    hue = ((hue % 360) + 360) % 360 / 360;
    saturation = clamp(saturation, 0, 100) / 100;
    lightness = clamp(lightness, 0, 100) / 100;

    if (saturation === 0) {
      var neutral = Math.round(lightness * 255);
      return { r: neutral, g: neutral, b: neutral };
    }

    var q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
    var p = 2 * lightness - q;
    return {
      r: Math.round(hueToRgb(p, q, hue + 1 / 3) * 255),
      g: Math.round(hueToRgb(p, q, hue) * 255),
      b: Math.round(hueToRgb(p, q, hue - 1 / 3) * 255),
    };
  }

  function adjustColor(hex, adjustments) {
    var rgb = hexToRgb(hex);
    var hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    var next = hslToRgb(
      hsl.h + (adjustments.hue || 0),
      clamp(hsl.s + (adjustments.saturation || 0), 0, 100),
      clamp(hsl.l + (adjustments.lightness || 0), 0, 100),
    );
    return rgbToHex(next.r, next.g, next.b);
  }

  function mixColors(colorA, colorB, amount) {
    var a = hexToRgb(colorA);
    var b = hexToRgb(colorB);
    return rgbToHex(
      lerp(a.r, b.r, amount),
      lerp(a.g, b.g, amount),
      lerp(a.b, b.b, amount),
    );
  }

  function luminance(red, green, blue) {
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
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

  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () {
        resolve(image);
      };
      image.onerror = function () {
        reject(new Error("图片读取失败"));
      };
      image.src = url;
    });
  }

  function createCanvas(width, height) {
    var canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    return canvas;
  }

  function fitContain(sourceWidth, sourceHeight, boxWidth, boxHeight) {
    var scale = Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);
    return {
      width: sourceWidth * scale,
      height: sourceHeight * scale,
      x: (boxWidth - sourceWidth * scale) / 2,
      y: (boxHeight - sourceHeight * scale) / 2,
      scale: scale,
    };
  }

  function fitCover(sourceWidth, sourceHeight, boxWidth, boxHeight) {
    var scale = Math.max(boxWidth / sourceWidth, boxHeight / sourceHeight);
    return {
      width: sourceWidth * scale,
      height: sourceHeight * scale,
      x: (boxWidth - sourceWidth * scale) / 2,
      y: (boxHeight - sourceHeight * scale) / 2,
      scale: scale,
    };
  }

  function drawCover(ctx, source, x, y, width, height) {
    var size = imageSize(source);
    var fit = fitCover(size.width, size.height, width, height);
    var image = source.image || source;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    ctx.drawImage(image, x + fit.x, y + fit.y, fit.width, fit.height);
    ctx.restore();
  }

  function drawContain(ctx, source, x, y, width, height) {
    var size = imageSize(source);
    var fit = fitContain(size.width, size.height, width, height);
    var image = source.image || source;
    ctx.drawImage(image, x + fit.x, y + fit.y, fit.width, fit.height);
  }

  function createNoiseCanvas(size, opacity) {
    var canvas = createCanvas(size, size);
    var ctx = canvas.getContext("2d");
    var imageData = ctx.createImageData(size, size);
    var rng = mulberry32("prototype-noise");
    for (var i = 0; i < imageData.data.length; i += 4) {
      var value = Math.floor(randomBetween(rng, 0, 255));
      imageData.data[i] = value;
      imageData.data[i + 1] = value;
      imageData.data[i + 2] = value;
      imageData.data[i + 3] = Math.floor(255 * opacity);
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  window.ImageEffectsUtil = {
    clamp: clamp,
    lerp: lerp,
    mulberry32: mulberry32,
    randomBetween: randomBetween,
    pick: pick,
    rgbToHex: rgbToHex,
    hexToRgb: hexToRgb,
    adjustColor: adjustColor,
    mixColors: mixColors,
    luminance: luminance,
    imageSize: imageSize,
    loadImage: loadImage,
    createCanvas: createCanvas,
    fitContain: fitContain,
    fitCover: fitCover,
    drawCover: drawCover,
    drawContain: drawContain,
    createNoiseCanvas: createNoiseCanvas,
  };
})();
