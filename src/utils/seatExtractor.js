// Utility to extract seat IDs for a sector from an SVG file
// Usage: getSeatsForSector(svgText, sector) => [seatIds]

export function getSeatsForSector(svgText, sector) {
  // Example: sector = 'R-VIP', seat IDs like 'R-VIP-S-6'
  const regex = new RegExp(`<circle[^>]+id=["']${sector}-S-([\w-]+)["'][^>]*>`, 'g'); // eslint-disable-line no-useless-escape
  const seatIds = [];
  let match;
  while ((match = regex.exec(svgText)) !== null) {
    seatIds.push(`${sector}-S-${match[1]}`);
  }
  return seatIds;
}
