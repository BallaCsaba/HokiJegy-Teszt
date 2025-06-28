import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSectorModal } from './hooks/useSectorModal';
import SectorModal from './components/SectorModal';
import svgRaw, { ReactComponent as VectorsSVG } from './assets/SECTORS_O.svg';
import PropTypes from 'prop-types';

const DEFAULT_FILL = '#e0e0e0';
const HOVER_FILL = '#ffe082';
const ACTIVE_FILL = '#ffd54f';

const MapContainer = ({
  width = 800,
  height = 600,
  defaultFill = DEFAULT_FILL,
}) => {
  const {
    modalOpen,
    selectedSector,
    handleSectorClick: openSectorModal,
    closeModal,
  } = useSectorModal();

  // Pan and zoom state
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(null);
  const [zoom, setZoom] = useState(1);

  // Highlight state
  const [hoveredSector, setHoveredSector] = useState(null);
  const [activeSector, setActiveSector] = useState(null);

  // Extract paths and viewBox from the imported SVG component
  const [sectors, setSectors] = useState([]);
  const [svgViewBox, setSvgViewBox] = useState('0 0 800 600');
  const svgExtractRef = useRef(null); // For extracting paths/viewBox
  const svgWheelRef = useRef(null);   // For visible SVG wheel event

  useEffect(() => {
    console.log(`Current pan position: x=${pan.x}, y=${pan.y}`);
  }, [pan]);

  // Store SVG markup as string for seat extraction
  const [svgMarkup, setSvgMarkup] = useState('');
  useEffect(() => {
    if (typeof svgRaw === 'string' && svgRaw.endsWith('.svg')) {
      fetch(svgRaw)
        .then(res => res.text())
        .then(setSvgMarkup)
        .catch(() => setSvgMarkup(''));
    } else if (typeof svgRaw === 'string') {
      setSvgMarkup(svgRaw);
    }
  }, []);

  useEffect(() => {
    // Extract and process SVG paths as soon as the SVG is available
    if (svgExtractRef.current) {
      const svg = svgExtractRef.current;
      // Extract viewBox from the SVG
      const viewBox = svg.getAttribute('viewBox');
      if (viewBox) {
        setSvgViewBox(viewBox);
      }
      const paths = svg.querySelectorAll('path');
      const newSectors = [];
      paths.forEach((path, idx) => {
        const id = path.getAttribute('id') || `sector-${idx}`;
        const d = path.getAttribute('d') || '';
        let fill = path.getAttribute('fill');
        if (!fill || fill === 'none') fill = defaultFill;
        newSectors.push({ id, d, fill });
      });
      setSectors(newSectors);
    }
  }, [defaultFill]);

  // Mouse event handlers for panning
  const handleMouseDown = (e) => {
    setDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  // Zoom handlers
  const handleZoomIn = () => setZoom(z => Math.min(z + 0.2, 4));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.2, 0.4));

  const handleWheel = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) return; // let browser zoom
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom(z => Math.min(z + 0.1, 4));
    } else if (e.deltaY > 0) {
      setZoom(z => Math.max(z - 0.1, 0.4));
    }
  }, []);

  // Clamp pan so the map cannot be moved outside the border
  const clampPan = (x, y, zoomLevel) => {
    // Parse viewBox: e.g. '0 0 800 600'
    /* const [, , vbW, vbH] = svgViewBox.split(' ').map(Number); */
    // Get the actual rendered SVG size
    /* const svgContainer = svgWheelRef.current; */
    /* let containerW = 900;
    let containerH = 600;
    if (svgContainer) {
      containerW = svgContainer.clientWidth;
      containerH = svgContainer.clientHeight;
    } */
    /* const scaledW = vbW * zoomLevel;
    const scaledH = vbH * zoomLevel; */

   /*  // Calculate the maximum pan offset
    const maxOffsetX = containerW - scaledW;
    const maxOffsetY = containerH - scaledH; */

    // Allow for movement even at normal zoom level
    const minX = -244.79;
    const maxX = 244.79;
    const minY = -133.32;
    const maxY = 133.32;

    return {
      x: Math.max(Math.min(x, maxX), minX),
      y: Math.max(Math.min(y, maxY), minY),
    };
  };

  const handleMouseMove = (e) => {
    if (!dragging || !dragStart.current || modalOpen) return; // Add modalOpen check
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const unclamped = {
      x: dragStart.current.panX + dx,
      y: dragStart.current.panY + dy,
    };
    setPan(clampPan(unclamped.x, unclamped.y, zoom));
  };

  // Clamp pan when zoom changes
  useEffect(() => {
    setPan(p => clampPan(p.x, p.y, zoom));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, svgViewBox]);

  const handleMouseUp = () => {
    setDragging(false);
    dragStart.current = null;
  };

  useEffect(() => {
    if (dragging) {
      document.body.style.userSelect = 'none';
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      document.body.style.userSelect = '';
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.body.style.userSelect = '';
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging]);

  // Click handler for sectors
  const handleSectorClick = (sector, event) => {
    setActiveSector(sector.id);
    // Pass the full sector object with d, fill, id, and svgMarkup for seat extraction
    openSectorModal({ ...sector, svgMarkup });
  };

  // Aspect ratio logic (optional, you can adjust as needed)
  // (aspectRatio is not used)

  // Attach wheel event with passive: false to allow preventDefault
  useEffect(() => {
    const svgNode = svgWheelRef.current;
    if (!svgNode) return;
    svgNode.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      svgNode.removeEventListener('wheel', handleWheel);
    }; 
  }, [svgViewBox, handleWheel]);

  return (
    <div
      className="w-full min-h-[600px] flex flex-col items-center justify-center relative"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseUp}
    >
      {/* Hidden SVG for extracting paths and viewBox */}
      <div style={{ display: 'none' }}>
        <VectorsSVG ref={svgExtractRef} />
      </div>
      <div
        className="glass-map max-w-full w-[90vw] md:w-[900px] h-[60vw] md:h-[600px] flex items-center justify-center relative overflow-hidden border-4 border-[#6f6f66] rounded-2xl shadow-2xl"
      >
        {/* Zoom controls */}
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
          <button onClick={handleZoomIn} className="btn-primary">+</button>
          <button onClick={handleZoomOut} className="btn-primary">−</button>
        </div>
        <svg
          ref={svgWheelRef}
          width="100%"
          height="100%"
          viewBox={svgViewBox}
          className="block w-full h-full rounded-2xl shadow-lg transition"
          style={{ background: 'rgba(255,255,255,0.15)', cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none' }}
          
        >
          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {sectors.map(sector => {
              let fill = sector.fill;
              let stroke = '#1976d2';
              let strokeWidth = 1;
              if (activeSector === sector.id) {
                fill = ACTIVE_FILL;
                stroke = '#1976d2';
                strokeWidth = 3;
              } else if (hoveredSector === sector.id) {
                fill = HOVER_FILL;
                stroke = '#1976d2';
                strokeWidth = 3;
              }
              return (
                <path
                  key={sector.id}
                  d={sector.d}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  style={{ transition: 'fill 0.2s, stroke 0.2s, stroke-width 0.2s', cursor: 'pointer', outline: 'none' }}
                  onClick={e => {
                    e.stopPropagation();
                    handleSectorClick(sector, e);
                  }}
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleSectorClick(sector, e);
                    }
                  }}
                  aria-label={sector.id}
                  role="button"
                  onMouseEnter={() => setHoveredSector(sector.id)}
                  onMouseLeave={() => setHoveredSector(null)}
                  onFocus={() => setHoveredSector(sector.id)}
                  onBlur={() => setHoveredSector(null)}
                />
              );
            })}
          </g>
        </svg>
      </div>
      {/* Render modal at the end so it overlays everything */}
      <SectorModal open={modalOpen} sector={selectedSector} onClose={closeModal} svgMarkup={svgMarkup} />
    </div>
  );
};

MapContainer.propTypes = {
  width: PropTypes.number,
  height: PropTypes.number,
  defaultFill: PropTypes.string,
};
MapContainer.defaultProps = {
  width: 800,
  height: 600,
  defaultFill: '#e0e0e0',
};

export default MapContainer;