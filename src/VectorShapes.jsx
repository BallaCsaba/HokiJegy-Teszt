import React, { useState, useRef, useEffect } from 'react';
import SectorModal from './components/SectorModal';
import PropTypes from 'prop-types';

const DEFAULT_FILL = '#e0e0e0';
const HOVER_FILL = '#ffe082';
const ACTIVE_FILL = '#ffd54f';

const VectorShapes = () => {
  const [svgMarkup, setSvgMarkup] = useState({ width: 0, height: 0, sectors: [], bounds: null });
  const [selectedSector, setSelectedSector] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeSector, setActiveSector] = useState(null);
  const svgRef = useRef(null);

  // Extract points from path string for bounding box calculations
  const extractPointsFromPath = (pathStr) => {
    if (!pathStr) return [];
    const nums = pathStr.match(/-?\d*\.?\d+/g);
    if (!nums) return [];
    const points = [];
    for (let i = 0; i < nums.length - 1; i += 2) {
      points.push({ x: parseFloat(nums[i]), y: parseFloat(nums[i + 1]) });
    }
    return points;
  };

  // Calculate bounding box for all sectors combined
  const calculateBounds = (sectors) => {
    if (!sectors || sectors.length === 0) {
      return { minX: 0, minY: 0, maxX: 1000, maxY: 800 };
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    sectors.forEach(sector => {
      const points = extractPointsFromPath(sector.svgPathData);
      points.forEach(({ x, y }) => {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      });
    });
    const padding = 50;
    return {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding,
    };
  };

  // Fetch venue data and calculate bounds
  useEffect(() => {
    const apiEndpoint = 'https://getticketfor.me/api/get-venue/686774522f01fe37d70152af';
    fetch(apiEndpoint)
      .then(res => res.json())
      .then(data => {
        const bounds = calculateBounds(data.sectors);
        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxY - bounds.minY;
        setSvgMarkup({ ...data, width, height, bounds });
      })
      .catch(() => setSvgMarkup({ width: 0, height: 0, sectors: [], bounds: null }));
  }, []);

  // Responsive scale to fit viewport
  const [scaleFactor, setScaleFactor] = useState(1);
  useEffect(() => {
    const updateScaleFactor = () => {
      if (svgMarkup && svgMarkup.width && svgMarkup.height) {
        const scaleW = window.innerWidth / svgMarkup.width;
        const scaleH = window.innerHeight / svgMarkup.height;
        // Allow scaling up and down freely, but limit minimum scale to 0.3 to avoid too small
        const scale = Math.min(scaleW, scaleH);
        const adjustedScale = scale < 1 ? 1 : scale; // minimum 0.3
        setScaleFactor(adjustedScale);
      }
    };
    updateScaleFactor();
    console.log(scaleFactor);
    window.addEventListener('resize', updateScaleFactor);
    return () => window.removeEventListener('resize', updateScaleFactor);
  }, [svgMarkup]);

  const handleSectorClick = (sector) => {
    setActiveSector(sector._id);
    setSelectedSector(sector);
    setModalOpen(true);
  };

  const handleMouseOver = (event) => {
    event.target.setAttribute('fill', HOVER_FILL);
  };

  const handleMouseOut = (event, sector) => {
    event.target.setAttribute('fill', sector._id === activeSector ? ACTIVE_FILL : DEFAULT_FILL);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setActiveSector(null);
    setSelectedSector(null);
  };

  // Store centers after mount
  const [sectorCenters, setSectorCenters] = useState({});

  useEffect(() => {
    if (!svgMarkup.sectors || svgMarkup.sectors.length === 0) return;

    const centers = {};
    svgMarkup.sectors.forEach(sector => {
      const pathElement = document.getElementById(`path-${sector._id}`);
      if (pathElement) {
        const bbox = pathElement.getBBox();
        centers[sector._id] = { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2, bbox };
      }
    });
    setSectorCenters(centers);
  }, [svgMarkup]);

  // Instead of viewBox starting at minX, minY, set it to 0 0 width height
  // We'll translate all shapes by (-minX, -minY) so they fit inside this coordinate space
  const bounds = svgMarkup.bounds || { minX: 0, minY: 0, maxX: 1000, maxY: 800 };
  const width = svgMarkup.width || (bounds.maxX - bounds.minX);
  const height = svgMarkup.height || (bounds.maxY - bounds.minY);
  const viewBox = `0 0 ${width} ${height}`;

  return (
    <div style={{ width: '100%', height: '100vh', overflow: 'auto' }}>
      {svgMarkup && svgMarkup.sectors && svgMarkup.sectors.length > 0 ? (
        <svg
          ref={svgRef}
          width="100%"
          height="99%"
          viewBox={viewBox}
          preserveAspectRatio="xMinYMin meet"
          style={{ height: '99vh' }}
        >
          {/* Translate by (-minX, -minY) to bring all shapes to positive coords, then scale */}
          <g transform={`translate(${-bounds.minX},${-bounds.minY}) scale(${scaleFactor})`}>
            {svgMarkup.sectors.map((sector) => {
              // Calculate available seats count
              let availableSeats = 0;
              if (sector.sectorRows && sector.sectorRows.length > 0) {
                sector.sectorRows.forEach(row => {
                  if (row.rowSeats && row.rowSeats.length > 0) {
                    availableSeats += row.rowSeats.filter(seat => seat.isAvailable).length;
                  }
                });
              }

              const center = sectorCenters[sector._id] || { x: 0, y: 0, bbox: null };
              const isDisabledSector = (sector.sectorCode?.toLowerCase().includes('disabled') || sector._id.toLowerCase().includes('disabled'));

              // Adjust text position for disabled sector to bottom center of bbox
              let textX = center.x;
              let textY = center.y;
              if (isDisabledSector && center.bbox) {
                textX = center.bbox.x + center.bbox.width / 2;
                textY = center.bbox.y + center.bbox.height - 10; // 10px padding from bottom
              }

              const textContent = `${availableSeats} available`;

              return (
                <g key={sector._id}>
                  <path
                    id={`path-${sector._id}`}
                    d={sector.svgPathData}
                    fill={sector._id === activeSector ? ACTIVE_FILL : DEFAULT_FILL}
                    data-id={sector._id}
                    onMouseOver={handleMouseOver}
                    onMouseOut={(e) => handleMouseOut(e, sector)}
                    onClick={() => handleSectorClick(sector)}
                    style={{ cursor: 'pointer' }}
                  />
                  {/* Background rectangle behind the text */}
                  <rect
                    x={textX - 50}
                    y={textY - 15}
                    width={100}
                    height={24}
                    rx={4}
                    ry={4}
                    fill="rgba(255, 255, 255, 0.8)"
                    pointerEvents="none"
                  />
                  {/* Text label */}
                  <text
                    x={textX}
                    y={textY + 3} // vertically center text within rect
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{
                      userSelect: 'none',
                      pointerEvents: 'none',
                      fontSize: 18,
                      fontWeight: 'bold',
                      fill: '#222',
                      textShadow: '1px 1px 2px rgba(0,0,0,0.6)',
                      fontFamily: 'Arial, sans-serif',
                    }}
                  >
                    {textContent}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      ) : (
        <div>Loading venue data...</div>
      )}

      {modalOpen && selectedSector && (
        <SectorModal
          open={modalOpen}
          sector={{ ...selectedSector, d: selectedSector.svgPathData }} // normalize prop name for SectorModal
          onClose={handleCloseModal}
          svgMarkup={svgMarkup}
        />
      )}
    </div>
  );
};

VectorShapes.propTypes = {
  width: PropTypes.number,
  height: PropTypes.number,
  defaultFill: PropTypes.string,
};

VectorShapes.defaultProps = {
  width: 800,
  height: 600,
  defaultFill: '#e0e0e0',
};

export default VectorShapes;
