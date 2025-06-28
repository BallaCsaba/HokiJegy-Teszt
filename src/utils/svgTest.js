/**
 * Checks if an SVG string is valid XML and contains at least one <path> element.
 * @param {string} svgString
 * @returns {boolean}
 */
export function isValidSVG(svgString) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    // Check for parser errors
    if (doc.getElementsByTagName('parsererror').length > 0) {
      return false;
    }
    // Check for at least one <path>
    return doc.getElementsByTagName('path').length > 0;
  } catch {
    return false;
  }
}