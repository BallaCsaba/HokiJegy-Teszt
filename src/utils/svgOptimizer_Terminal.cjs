/**
 * SVG Optimizer Terminal Script
 * --------------------------------
 * This Node.js script optimizes SVG files using SVGO (v1.x).
 * It is intended to be run from the command line to reduce SVG file size and clean up SVG markup
 * before using SVGs in web projects (such as React apps).
 *
 * Features:
 * - Removes unnecessary metadata, comments, and elements.
 * - Preserves all element IDs (important for referencing SVG parts in code).
 * - Keeps the viewBox attribute for responsive SVGs.
 * - Removes width/height attributes to allow flexible scaling.
 * - Collapses groups and removes empty or hidden elements.
 * - Converts colors to short hex and removes unused styles/scripts.
 *
 * Usage:
 *   node svgOptimizer_Terminal.cjs input.svg output.svg
 *
 * Arguments:
 *   input.svg   Path to the SVG file you want to optimize.
 *   output.svg  Path where the optimized SVG will be saved.
 *
 * Example:
 *   node svgOptimizer_Terminal.cjs ./src/assets/SECTORS.svg ./src/assets/SECTORS_optimized.svg
 *
 * Requirements:
 *   - Node.js
 *   - SVGO v1.x (`npm install svgo@1`)
 *
 * Note:
 *   This script is for use in a Node.js environment only (not in the browser).
 *   If you upgrade to SVGO v2+, the API will change and this script will need to be updated.
 */

const fs = require('fs').promises;
const SVGO = require('svgo');

async function main() {
  const [,, inputPath, outputPath] = process.argv;

  if (!inputPath || !outputPath) {
    console.error('Usage: node svgOptimizer_Terminal.js input.svg output.svg');
    process.exit(1);
  }

  // Create SVGO instance with your plugins
  const svgo = new SVGO({
    plugins: [
      { removeViewBox: false },
      { removeDimensions: true },
      { removeComments: true },
      { removeMetadata: true },
      { removeXMLProcInst: true },
      { removeTitle: true },
      { removeDesc: true },
      { removeUselessDefs: true },
      { collapseGroups: true },
      { removeEmptyContainers: true },
      { removeHiddenElems: true },
      { removeEmptyText: true },
      { removeUselessStrokeAndFill: true },
      { convertColors: true },
      { removeStyleElement: true },
      { removeScriptElement: true },
      { cleanupIDs: false },
    ],
  });

  try {
    const svgString = await fs.readFile(inputPath, 'utf8');
    const result = await svgo.optimize(svgString);
    await fs.writeFile(outputPath, result.data, 'utf8');
    console.log(`Optimized SVG written to ${outputPath}`);
  } catch (err) {
    console.error('Error optimizing SVG:', err.message);
    process.exit(1);
  }
}

main();