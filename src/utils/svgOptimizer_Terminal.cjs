/**
 * Enhanced SVG optimizer and seat renamer
 * - Optimizes SVG with SVGO
 * - Converts ellipses to circles
 * - Renames seat circles/ellipses in sector groups using sector path id
 */

const fs = require('fs').promises;
const svgo = require('svgo');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const xpath = require('xpath');

async function main() {
  const [,, inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) {
    console.error('Usage: node script.js input.svg output.svg');
    process.exit(1);
  }

  const rawSvg = await fs.readFile(inputPath, 'utf8');

  // run svgo
  const optimized = await svgo.optimize(rawSvg, {
    plugins: [
        'removeDoctype',
        'removeXMLProcInst',
        'removeComments',
        'removeMetadata',
        'removeEditorsNSData',
        'cleanupAttrs',
        'mergeStyles',
        'inlineStyles',
        'minifyStyles',
        'removeUselessDefs',
        'cleanupNumericValues',
        'convertColors',
        'removeUnknownsAndDefaults',
        'removeNonInheritableGroupAttrs',
        'removeUselessStrokeAndFill',
        'cleanupEnableBackground',
        'removeHiddenElems',
        'removeEmptyText',
        'convertShapeToPath',
        'convertEllipseToCircle',
        'moveElemsAttrsToGroup',
        'moveGroupAttrsToElems',
        'collapseGroups',
        'convertPathData',
        'convertTransform',
        'removeEmptyAttrs',
        'removeEmptyContainers',
        'removeUnusedNS',
        'mergePaths',
        'sortAttrs',
        'sortDefsChildren',
        'removeDesc',
        'convertPathData',
        'convertTransform',
        'removeDimensions',
        'removeViewBox',
        'sortAttrs',
    ],
  });

  const dom = new DOMParser().parseFromString(optimized.data, 'image/svg+xml');
  const select = xpath.useNamespaces({ svg: "http://www.w3.org/2000/svg" });

  // get all sector groups
  const groups = select("//svg:g[starts-with(@id,'Sector-')]", dom);

  for (const group of groups) {
    const path = select(".//svg:path", group)[0];
    if (!path) continue;
    const sectorId = path.getAttribute("id");

    // get seats inside group
    const seats = select(".//svg:ellipse | .//svg:circle", group);

    seats.forEach((seat, index) => {
      const cx = seat.getAttribute("cx");
      const cy = seat.getAttribute("cy");

      if (seat.tagName === "ellipse") {
        // replace with circle
        const rx = parseFloat(seat.getAttribute("rx"));
        const ry = parseFloat(seat.getAttribute("ry"));
        const r = (rx + ry) / 2;

        const circle = dom.createElement("circle");
        circle.setAttribute("cx", cx);
        circle.setAttribute("cy", cy);
        circle.setAttribute("r", r.toString());

        // copy style attributes except rx/ry/id
        for (let i = 0; i < seat.attributes.length; i++) {
          const attr = seat.attributes[i];
          if (!["rx", "ry", "cx", "cy", "id"].includes(attr.name)) {
            circle.setAttribute(attr.name, attr.value);
          }
        }
        circle.setAttribute("id", `${sectorId}-S-${index + 1}`);
        seat.parentNode.replaceChild(circle, seat);

      } else if (seat.tagName === "circle") {
        // just rename circle id
        seat.setAttribute("id", `${sectorId}-S-${index + 1}`);
      }
    });
  }

  const output = new XMLSerializer().serializeToString(dom);
  await fs.writeFile(outputPath, output, 'utf8');
  console.log(`✅ Done! Saved to ${outputPath}`);
}

main();
