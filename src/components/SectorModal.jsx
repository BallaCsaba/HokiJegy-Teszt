import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';

// Helper to get bounding box from a path string using SVG APIs
function getPathBBox(d) {
  if (!d) return { x: 0, y: 0, width: 200, height: 200 };
  const svgNS = 'http://www.w3.org/2000/svg';
  const tempSvg = document.createElementNS(svgNS, 'svg');
  const tempPath = document.createElementNS(svgNS, 'path');
  tempPath.setAttribute('d', d);
  tempSvg.appendChild(tempPath);
  document.body.appendChild(tempSvg);
  let bbox = { x: 0, y: 0, width: 200, height: 200 };
  try {
    bbox = tempPath.getBBox();
  } catch (e) {
    // fallback
  }
  document.body.removeChild(tempSvg);
  return bbox;
}

/**
 * Extracts seat circles for a given sector from SVG markup.
 */
export function extractSeatsFromSVG(sectorId, svgMarkup) {
  if (!sectorId || !svgMarkup) return [];
  const baseSectorId = sectorId.replace(/-G$/i, '');
  const parser = new window.DOMParser();
  const doc = parser.parseFromString(svgMarkup, 'image/svg+xml');
  const seatElements = [
    ...Array.from(doc.querySelectorAll('circle')),
    ...Array.from(doc.querySelectorAll('ellipse')),
  ].filter(el => {
    const id = el.getAttribute('id') || '';
    return id.toLowerCase().startsWith(`${baseSectorId.toLowerCase()}-s`);
  });
  return seatElements.map(el => ({
    id: el.getAttribute('id'),
    cx: Number(el.getAttribute('cx')),
    cy: Number(el.getAttribute('cy')),
    r: Number(el.getAttribute('r')) || Number(el.getAttribute('rx')) || 4,
    fill: el.getAttribute('fill') || '#00c820',
  }));
}

const PAD = 40;

const SectorModal = ({ open, sector, onClose, svgMarkup, modalOpen }) => {
  // Calculate bounding box for the sector path
  const bbox = useMemo(
    () =>
      sector && sector.d
        ? getPathBBox(sector.d)
        : { x: 0, y: 0, width: 200, height: 200 },
    [sector]
  );

  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });

  // SVG container size (for clamping)
  const containerRef = useRef(null);
  // eslint-disable-next-line no-unused-vars
  const [containerSize, setContainerSize] = useState({ width: 800, height: 800 });

  // Update container size on mount and resize
  useEffect(() => {
    function updateSize() {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    }
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [setContainerSize]);

  // Reset zoom, pan, and selection when modal opens or sector changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedSeats([]);
  }, [open, sector]);

  // Calculate viewBox with padding
  const viewBox = useMemo(() => {
    return `${bbox.x - PAD} ${bbox.y - PAD} ${(bbox.width + PAD * 2) / zoom} ${(bbox.height + PAD * 2) / zoom}`;
  }, [bbox.x, bbox.y, bbox.width, bbox.height, zoom]);

  // --- SEAT EXTRACTION LOGIC ---
  let seatExtractionWarning = null;
  let seatCircles = [];
  const effectiveSvgMarkup = (sector && sector.svgMarkup) ? sector.svgMarkup : svgMarkup;
  if (effectiveSvgMarkup && sector && sector.id) {
    seatCircles = extractSeatsFromSVG(sector.id, effectiveSvgMarkup);
  } else if (!effectiveSvgMarkup) {
    seatExtractionWarning = (
      <div style={{ color: 'red', textAlign: 'center', margin: '12px 0' }}>
        <strong>Warning:</strong> svgMarkup prop is missing.<br />
        Automatic seat extraction will not work.<br />
        Pass the SVG markup as a string via the <code>svgMarkup</code> prop.
      </div>
    );
  }

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

  // Clamp pan so the sector stays in view
  // This version ensures the SVG content never leaves the visible area, regardless of zoom or container size
  const clampPan = useCallback((x, y, zoomLevel) => {
    // SVG logical dimensions
    const vbW = bbox.width + PAD * 2;
    const vbH = bbox.height + PAD * 2;

    // The visible area in SVG units (after zoom)
    const visibleW = vbW / zoomLevel;
    const visibleH = vbH / zoomLevel;

    // The pan is in SVG units
    // We want to keep the SVG content inside the viewport
    // If the SVG is smaller than the viewport, center it
    let minX, maxX, minY, maxY;
    if (visibleW >= vbW) {
      minX = maxX = 0;
    } else {
      minX = -(vbW - visibleW) / 2;
      maxX = (vbW - visibleW) / 2;
    }
    if (visibleH >= vbH) {
      minY = maxY = 0;
    } else {
      minY = -(vbH - visibleH) / 2;
      maxY = (vbH - visibleH) / 2;
    }
    return {
      x: Math.min(Math.max(x, minX), maxX),
      y: Math.min(Math.max(y, minY), maxY),
    };
  }, [bbox.width, bbox.height]);

  // Pan handlers
  const svgRef = useRef(null);

  const handleMouseDown = (e) => {
    // Only left mouse button
    if (e.button !== 0) return;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    panStart.current = { ...pan };
    document.body.style.userSelect = 'none';
  };

  const handleMouseMove = useCallback((e) => {
    if (!dragging) return;
    // Make panning less sensitive (slower): divide by a factor, e.g., 2.5
    const factor = 2.5;
    const dx = (e.clientX - dragStart.current.x) / zoom / factor;
    const dy = (e.clientY - dragStart.current.y) / zoom / factor;
    setPan(() => {
      const next = clampPan(panStart.current.x + dx, panStart.current.y + dy, zoom);
      return next;
    });
  }, [dragging, zoom, clampPan]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  // Touch support
  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    setDragging(true);
    dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    panStart.current = { ...pan };
    document.body.style.userSelect = 'none';
  };

  // Attach wheel event with passive: false to allow preventDefault
  useEffect(() => {
    const svgNode = svgRef.current;
    if (!svgNode) return;
    svgNode.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      svgNode.removeEventListener('wheel', handleWheel);
    };
  }, [viewBox, handleWheel]);

  const handleTouchMove = useCallback((e) => {
    if (!dragging || e.touches.length !== 1 || !modalOpen) return; // Add modalOpen check
    const factor = 2.5;
    const dx = (e.touches[0].clientX - dragStart.current.x) / zoom / factor;
    const dy = (e.touches[0].clientY - dragStart.current.y) / zoom / factor;
    setPan(() => {
      const next = clampPan(panStart.current.x + dx, panStart.current.y + dy, zoom);
      return next;
    });
  }, [dragging, zoom, clampPan, modalOpen]);

  const handleTouchEnd = useCallback(() => {
    setDragging(false);
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleTouchEnd);
      return () => {
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [dragging, handleTouchMove, handleTouchEnd]);

  if (!open || !sector) return null;

  // Use React Portal to render modal at document.body
  return ReactDOM.createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="glass-modal flex flex-col overflow-hidden"
        style={{
          width: '90vw',
          height: '80vh',
          maxWidth: '50%',
          maxHeight: '60%',
          minWidth: '16vw',
          minHeight: '16vh',
          position: 'center',
          // On large screens, use 50vw/50vh
          ...(window.innerWidth >= 1024 ? {
            width: '60vw',
            height: '70vh',
            maxWidth: '900px',
            maxHeight: '900px',
            position: 'center',
          } : {})
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'transparent',
            border: 'none',
            fontSize: 28,
            cursor: 'pointer',
            zIndex: 2,
          }}
          aria-label="Close"
        >
          ×
        </button>
        <h2 style={{ margin: '24px 0 0 0', textAlign: 'center' }}>Sector: {sector.id}</h2>
        {seatExtractionWarning}
        <div
          ref={containerRef}
          className="flex-1 flex items-center justify-center min-h-0 min-w-0 relative mb-6"
          style={{ userSelect: dragging ? 'none' : 'auto', cursor: dragging ? 'grabbing' : 'grab' }}
        >
          {/* Zoom controls */}
          <div style={{ position: 'absolute', top: 18, right: 18, zIndex: 2, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={handleZoomIn} style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, width: 36, height: 36, fontSize: 22, cursor: 'pointer', marginBottom: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.10)' }}>+</button>
            <button onClick={handleZoomOut} style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, width: 36, height: 36, fontSize: 22, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.10)' }}>−</button>
          </div>
          <div
            ref={containerRef}
            className="flex-1 flex items-center justify-center min-h-0 min-w-0 relative mb-6"
            style={{ userSelect: dragging ? 'none' : 'auto', cursor: dragging ? 'grabbing' : 'grab' }}
          >
            {/* Zoom controls */}
            <div style={{ position: 'absolute', top: 18, right: 18, zIndex: 2, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={handleZoomIn} style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, width: 36, height: 36, fontSize: 22, cursor: 'pointer', marginBottom: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.10)' }}>+</button>
              <button onClick={handleZoomOut} style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, width: 36, height: 36, fontSize: 22, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.10)' }}>−</button>
            </div>
            <svg
              ref={svgRef}
              width="100%"
              height="100%"
              viewBox={viewBox}
              style={{
                background: 'none',
                borderRadius: 12,
                boxShadow: '0 1px 8px rgba(0,0,0,0.08)',
                maxWidth: '100%',
                maxHeight: '100%',
                display: 'block',
                transition: 'box-shadow 0.2s',
                cursor: dragging ? 'grabbing' : 'grab',
                touchAction: 'none',
              }}
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
            >
              <g transform={`translate(${pan.x},${pan.y})`}>
                <path
                  d={sector.d}
                  fill={sector.fill}
                  stroke="#1976d2"
                  strokeWidth={1}
                  style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.10))' }}
                />
                {/* Render seat circles as clickable buttons */}
                {seatCircles.map(seat => {
                  const isSelected = selectedSeats.includes(seat.id);
                  return (
                    <circle
                      key={seat.id}
                      cx={seat.cx}
                      cy={seat.cy}
                      r={seat.r}
                      fill={isSelected ? '#ff9800' : (seat.fill || '#00c820')}
                      stroke={isSelected ? '#d84315' : '#1976d2'}
                      strokeWidth={isSelected ? 2 : 1}
                      style={{ cursor: 'pointer', transition: 'fill 0.2s, stroke 0.2s', outline: 'none' }}
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedSeats(prev => {
                          const already = prev.includes(seat.id);
                          const next = already ? prev.filter(id => id !== seat.id) : [...prev, seat.id];
                          // eslint-disable-next-line no-console
                          console.log('Selected seats:', next);
                          return next;
                        });
                      }}
                      aria-label={`Seat ${seat.id}`}
                      role="button"
                    />
                  );
                })}
              </g>
            </svg>
          </div>
        </div>
        {selectedSeats.length > 0 && (
          <div style={{ textAlign: 'center', margin: '16px 0' }}>
            <button
              style={{
                background: '#1976d2',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '10px 24px',
                fontSize: 18,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                marginTop: 8,
              }}
              onClick={() => {
                // eslint-disable-next-line no-alert
                alert('Az uleohelyek le lettek foglalva. (The seats have been reserved.)');
                // eslint-disable-next-line no-console
                console.log('Az uleohelyek le lettek foglalva. (The seats have been reserved.)');
              }}
            >
              Foglalás véglegesítése / Finalize Reservation
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

SectorModal.propTypes = {
  open: PropTypes.bool.isRequired,
  sector: PropTypes.shape({
    id: PropTypes.string.isRequired,
    d: PropTypes.string.isRequired,
    fill: PropTypes.string.isRequired,
    seats: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        cx: PropTypes.number.isRequired,
        cy: PropTypes.number.isRequired,
        r: PropTypes.number,
        fill: PropTypes.string,
      })
    ),
  }),
  onClose: PropTypes.func.isRequired,
  svgMarkup: PropTypes.string, // Pass the SVG markup as a string for seat extraction
};

export default SectorModal;