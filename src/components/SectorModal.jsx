import React, { useMemo, useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import '../styles/modal.css';

const PAD = 40;

function getPathBBox(d) {
  if (!d) return { x: 0, y: 0, width: 200, height: 200 };
  try {
    const svgNS = 'http://www.w3.org/2000/svg';
    const tempSvg = document.createElementNS(svgNS, 'svg');
    const tempPath = document.createElementNS(svgNS, 'path');
    tempPath.setAttribute('d', d);
    tempSvg.appendChild(tempPath);
    document.body.appendChild(tempSvg);
    const bbox = tempPath.getBBox();
    document.body.removeChild(tempSvg);
    return bbox;
  } catch {
    return { x: 0, y: 0, width: 200, height: 200 };
  }
}

export default function SectorModal({ open, sector, onClose }) {
  const containerRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // panning offset
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const offsetStart = useRef({ x: 0, y: 0 });
  const [selectedSeats, setSelectedSeats] = useState([]);

  const bbox = useMemo(() => {
    if (!sector?.d) return { x: 0, y: 0, width: 200, height: 200 };
    return getPathBBox(sector.d);
  }, [sector]);

  const center = useMemo(() => ({
    x: bbox.x + bbox.width / 2,
    y: bbox.y + bbox.height / 2,
  }), [bbox]);

  // Mouse handlers for dragging/panning
  const onMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    offsetStart.current = { ...offset };
  };

  const onMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setOffset({
      x: offsetStart.current.x + dx,
      y: offsetStart.current.y + dy,
    });
  };

  const onMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // Zoom buttons just adjust zoom level, no offset change
  const zoomIn = () => {
    setZoom(z => Math.min(z + 0.1, 4));
  };

  const zoomOut = () => {
    setZoom(z => Math.max(z - 0.1, 0.5));
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        zoomIn();
      } else {
        zoomOut();
      }
  };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [zoomIn, zoomOut]);

  // Toggle seat selection
  const toggleSeat = (seat) => {
    setSelectedSeats((prevSelected) => {
      const exists = prevSelected.find(s => s._id === seat._id);
      if (exists) {
        return prevSelected.filter(s => s._id !== seat._id);
      } else if (seat.isAvailable) {
        return [...prevSelected, seat];
      }
      return prevSelected;
    });
  };

  const finalizeReservation = () => {
    if (selectedSeats.length === 0) return;
    const seatList = selectedSeats.map(s => `Seat ${s.seatNumber} (Row ${s.rowCode})`).join(', ');
    alert(`Finalizing reservation for: ${seatList}`);
    setSelectedSeats([]);
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '90vw',
          maxHeight: '85vh',
          width: '800px',
          height: '600px',
          overflow: 'hidden',
          borderRadius: '12px',
          backdropFilter: 'blur(12px)',
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px',
          boxSizing: 'border-box',
          userSelect: isDragging ? 'none' : 'auto',
        }}
      >
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>Sector {sector.sectorCode || ''}</h2>

        <div
          className="modal-svg-container"
          style={{ overflow: 'auto', flexGrow: 1, cursor: isDragging ? 'grabbing' : 'grab' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUpOrLeave}
          onMouseLeave={onMouseUpOrLeave}
          ref={containerRef}
        >
          <svg
            width="100%"
            height="99%"
            viewBox={`${bbox.x - PAD} ${bbox.y - PAD} ${bbox.width + PAD * 2} ${bbox.height + PAD * 2}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ borderRadius: '12px', userSelect: 'none' }}
          >
            <defs>
              <filter id="glassBlur" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feComponentTransfer>
                  <feFuncA type="linear" slope="0.7" />
                </feComponentTransfer>
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            <g
              transform={`
                translate(${offset.x},${offset.y}) 
                translate(${center.x},${center.y}) 
                scale(${zoom}) 
                translate(${-center.x},${-center.y})
              `}
            >
              {sector.d && (
                <path
                  d={sector.d}
                  fill="rgba(255, 255, 255, 0.15)"
                  stroke="rgba(255, 255, 255, 0.4)"
                  strokeWidth="2"
                  filter="url(#glassBlur)"
                  style={{ pointerEvents: 'none' }}
                />
              )}

              {sector.sectorRows && sector.sectorRows.flatMap(row => row.rowSeats).map(seat => {
                const isSelected = selectedSeats.some(s => s._id === seat._id);
                return (
                  <circle
                    key={seat._id}
                    cx={seat.svgCoordinates?.cx ?? seat.cx ?? 0}
                    cy={seat.svgCoordinates?.cy ?? seat.cy ?? 0}
                    r={seat.svgCoordinates?.r ?? 5}
                    fill={seat.isAvailable ? (isSelected ? '#007bff' : '#00c820') : '#ff4d4d'}
                    stroke={isSelected ? '#003d99' : '#333'}
                    strokeWidth={isSelected ? 2 : 0.5}
                    style={{ cursor: seat.isAvailable ? 'pointer' : 'not-allowed' }}
                    onClick={() => toggleSeat(seat)}
                    title={`Seat ${seat.seatNumber} (Row ${seat.rowCode}) - ${seat.isAvailable ? 'Available' : 'Unavailable'}`}
                  />
                );
              })}
            </g>
          </svg>
        </div>

        <div className="modal-controls" style={{ marginTop: '10px' }}>
          <button onClick={zoomIn}>Zoom +</button>
          <button onClick={zoomOut}>Zoom -</button>

          <button
            onClick={finalizeReservation}
            disabled={selectedSeats.length === 0}
            style={{
              marginLeft: '10px',
              padding: '8px 16px',
              cursor: selectedSeats.length === 0 ? 'not-allowed' : 'pointer',
              backgroundColor: selectedSeats.length === 0 ? '#aaa' : '#007bff',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
            }}
          >
            Finalize Reservation
          </button>
        </div>
      </div>
    </div>
  );
}

SectorModal.propTypes = {
  open: PropTypes.bool.isRequired,
  sector: PropTypes.shape({
    sectorCode: PropTypes.string,
    d: PropTypes.string,
    sectorRows: PropTypes.arrayOf(PropTypes.shape({
      rowCode: PropTypes.string,
      rowSeats: PropTypes.arrayOf(PropTypes.shape({
        _id: PropTypes.string,
        seatNumber: PropTypes.number,
        isAvailable: PropTypes.bool,
        svgCoordinates: PropTypes.shape({
          cx: PropTypes.number,
          cy: PropTypes.number,
          r: PropTypes.number,
        }),
      })),
    })),
  }),
  onClose: PropTypes.func.isRequired,
};
