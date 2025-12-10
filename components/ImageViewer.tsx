
import React, { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface Props {
  src: string;
  onClose: () => void;
}

const ImageViewer: React.FC<Props> = ({ src, onClose }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastPos = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const initialPinchDist = useRef<number | null>(null);
  const initialScale = useRef(1);

  useEffect(() => {
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleZoom = (newScale: number) => {
    const s = Math.min(Math.max(1, newScale), 5); // Limit 1x to 5x
    setScale(s);
    if (s === 1) {
      setPosition({ x: 0, y: 0 }); // Reset position if zoomed out
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    // Allow standard scroll if we are not zoomed in? 
    // Actually standard viewer behavior is wheel zooms.
    const delta = e.deltaY * -0.002;
    handleZoom(scale + delta);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only drag if zoomed in
    if (scale > 1) {
      setIsDragging(true);
      startPos.current = { x: e.clientX, y: e.clientY };
      lastPos.current = { x: position.x, y: position.y };
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging && scale > 1) {
      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;
      setPosition({
        x: lastPos.current.x + dx,
        y: lastPos.current.y + dy
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // Touch handlers for Pinch Zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialPinchDist.current = dist;
      initialScale.current = scale;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDist.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / initialPinchDist.current;
      handleZoom(initialScale.current * ratio);
      e.preventDefault(); // Prevent page scroll
    }
  };

  const toggleZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scale > 1) {
      handleZoom(1);
    } else {
      handleZoom(2.5);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center overflow-hidden animate-fadeIn"
      onClick={onClose}
    >
      {/* Top Controls */}
      <div className="absolute top-0 inset-x-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex gap-4">
           <button 
            onClick={(e) => { e.stopPropagation(); handleZoom(scale - 0.5); }}
            className="text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <ZoomOut size={24} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); handleZoom(scale + 0.5); }}
            className="text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <ZoomIn size={24} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); handleZoom(1); }}
            className="text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <RotateCcw size={24} />
          </button>
        </div>
        <button 
          onClick={onClose}
          className="text-white p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors backdrop-blur-sm"
        >
          <X size={24} />
        </button>
      </div>

      {/* Main Image Area */}
      <div 
        ref={containerRef}
        className="flex-1 w-full h-full flex items-center justify-center overflow-hidden touch-none"
        onWheel={onWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        <img 
          ref={imgRef}
          src={src} 
          alt="Preview"
          className="max-w-full max-h-full transition-transform duration-75 ease-out select-none"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            cursor: scale > 1 ? 'grab' : 'zoom-in',
            touchAction: 'none'
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={(e) => e.stopPropagation()} 
          onDoubleClick={toggleZoom}
        />
      </div>
      
      {/* Footer Info */}
      <div className="absolute bottom-6 bg-black/50 px-4 py-1 rounded-full text-white text-xs backdrop-blur-sm pointer-events-none">
         {Math.round(scale * 100)}%
      </div>
    </div>
  );
};

export default ImageViewer;
