/**
 * SVG Optimizer Utility
 * 
 * This script provides a function to optimize SVG content using SVGO.
 * It can be used as a module or as a CLI tool.
 * 
 * Usage as a module:
 *   const { optimizeSVG, optimizeSVGFile } = require('./svgOptimize');
 *   const optimized = await optimizeSVG('<svg>...</svg>');
 *   const optimizedFromFile = await optimizeSVGFile('path/to/file.svg');
 * 
 * Usage as a CLI:
 *   node svgOptimize.js input.svg output.svg
 */

const fs = require('fs').promises;
const path = require('path');
const { optimize } = require('svgo');

/**
 * Optimize an SVG string.
 * @param {string} svgString - The SVG content as a string.
 * @returns {Promise<string>} - The optimized SVG string.
 */
async function optimizeSVG(svgString) {
  try {
    const result = optimize(svgString, {
      plugins: [
        // Keep the viewBox (important for responsive SVGs)
        { name: 'removeViewBox', active: false },
        // Remove width/height attributes (let viewBox control scaling)
        { name: 'removeDimensions', active: true },
        // Remove comments
        { name: 'removeComments', active: true },
        // Remove metadata
        { name: 'removeMetadata', active: true },
        // Remove XML processing instructions
        { name: 'removeXMLProcInst', active: true },
        // Remove <title> and <desc> (unless you want them for accessibility)
        { name: 'removeTitle', active: true },
        { name: 'removeDesc', active: true },
        // Remove unused defs
        { name: 'removeUselessDefs', active: true },
        // Collapse groups
        { name: 'collapseGroups', active: true },
        // Remove empty containers
        { name: 'removeEmptyContainers', active: true },
        // Remove hidden elements
        { name: 'removeHiddenElems', active: true },
        // Remove empty text
        { name: 'removeEmptyText', active: true },
        // Remove unnecessary stroke and fill
        { name: 'removeUselessStrokeAndFill', active: true },
        // Convert colors to short hex
        { name: 'convertColors', active: true },
        // Remove style elements
        { name: 'removeStyleElement', active: true },
        // Remove script elements
        { name: 'removeScriptElement', active: true },
      ],
    });
    return result.data;
  } catch (error) {
    throw new Error('SVG optimization failed: ' + error.message);
  }
}

/**
 * Optimize an SVG file.
 * @param {string} filePath - Path to the SVG file.
 * @returns {Promise<string>} - The optimized SVG string.
 */
async function optimizeSVGFile(filePath) {
  try {
    const svgString = await fs.readFile(filePath, 'utf8');
    return await optimizeSVG(svgString);
  } catch (error) {
    throw new Error('Failed to read or optimize SVG file: ' + error.message);
  }
}

// CLI usage: node svgOptimize.js input.svg output.svg
if (require.main === module) {
  (async () => {
    const [,, inputPath, outputPath] = process.argv;
    if (!inputPath || !outputPath) {
      console.error('Usage: node svgOptimize.js input.svg output.svg');
      process.exit(1);
    }
    try {
      const optimized = await optimizeSVGFile(inputPath);
      await fs.writeFile(outputPath, optimized, 'utf8');
      console.log(`Optimized SVG written to ${outputPath}`);
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
  })();
}

module.exports = {
  optimizeSVG,
  optimizeSVGFile,
};