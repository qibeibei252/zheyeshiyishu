(function () {
  "use strict";

  var effects = window.ImageEffectsV1;
  if (!effects) return;

  var toPrototypeType = {
    octagonalFlower: "eightFlower",
  };
  var toContractType = {
    eightFlower: "octagonalFlower",
  };

  function mapType(type, table) {
    return table[type] || type;
  }

  function mapShape(shape, table) {
    if (!shape) return shape;
    return Object.assign({}, shape, {
      type: mapType(shape.type, table),
    });
  }

  function mapProjectState(projectState) {
    return Object.assign({}, projectState, {
      shapeConfig: Object.assign({}, projectState.shapeConfig, {
        enabledTypes: (projectState.shapeConfig.enabledTypes || []).map(function (type) {
          return mapType(type, toPrototypeType);
        }),
      }),
      shapeInstances:
        projectState.shapeInstances === null
          ? null
          : (projectState.shapeInstances || []).map(function (shape) {
              return mapShape(shape, toPrototypeType);
            }),
    });
  }

  function mapRenderResult(result) {
    return Object.assign({}, result, {
      targetShapes: (result.targetShapes || []).map(function (shape) {
        return mapShape(shape, toContractType);
      }),
      mappingShapes: (result.mappingShapes || []).map(function (shape) {
        return mapShape(shape, toContractType);
      }),
    });
  }

  window.ImageEffectsV1 = {
    prepareAsset: function (file) {
      return effects.prepareAsset(file);
    },
    createAssetFromCanvas: function (canvas, fileName) {
      return effects.createAssetFromCanvas(canvas, fileName);
    },
    extractPalette: function (imageAsset, paletteSize) {
      return effects.extractPalette(imageAsset, paletteSize);
    },
    renderMappingPreview: function (canvas, mappingAsset, mappingConfig, palette, options) {
      return effects.renderMappingPreview(
        canvas,
        mappingAsset,
        mappingConfig,
        palette,
        Object.assign({}, options || {}, {
          sourceType: mappingAsset ? "uploaded" : "generated",
        }),
      );
    },
    render: function (canvas, projectState, options) {
      return effects
        .render(canvas, mapProjectState(projectState), options)
        .then(mapRenderResult);
    },
    regenerate: function (canvas, projectState, options) {
      return effects
        .regenerate(canvas, mapProjectState(projectState), options)
        .then(mapRenderResult);
    },
    exportBlob: function (projectState, options) {
      return effects.exportBlob(mapProjectState(projectState), options);
    },
  };
})();
