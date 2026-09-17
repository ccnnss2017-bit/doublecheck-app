import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

interface PhotoViewerProps {
  photos: string[];
  initialIndex: number;
  onClose: () => void;
}

const PhotoViewer: React.FC<PhotoViewerProps> = ({ photos, initialIndex, onClose }) => {
  const [index, setIndex] = useState(initialIndex);
  const [direction, setDirection] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') paginate(-1);
      if (e.key === 'ArrowRight') paginate(1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [index, onClose]);

  const paginate = (newDirection: number) => {
    if (isZoomed) return; // 확대 중일 때는 사진 넘기기 방지
    const newIndex = index + newDirection;
    if (newIndex >= 0 && newIndex < photos.length) {
      setDirection(newDirection);
      setIndex(newIndex);
    }
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 500 : -500,
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 500 : -500,
      opacity: 0,
    })
  };

  const swipeConfidenceThreshold = 10000;
  const swipePower = (offset: number, velocity: number) => Math.abs(offset) * velocity;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center touch-none"
    >
      {/* 상단 헤더 */}
      <div className="absolute top-0 left-0 right-0 p-4 z-50 flex justify-between items-center text-white pb-safe pt-safe-top bg-gradient-to-b from-black/50 to-transparent">
        <div className="text-sm font-medium tracking-wider">
          {index + 1} / {photos.length}
        </div>
        <div className="flex gap-4">
           <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition backdrop-blur-md">
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={index}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
            drag={isZoomed ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={1}
            onDragEnd={(e, { offset, velocity }) => {
              const swipe = swipePower(offset.x, velocity.x);
              if (swipe < -swipeConfidenceThreshold) paginate(1);
              else if (swipe > swipeConfidenceThreshold) paginate(-1);
            }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <TransformWrapper
              initialScale={1}
              minScale={1}
              maxScale={5}
              centerOnInit={true}
              onTransformed={(ref) => setIsZoomed(ref.state.scale > 1.01)} // 모바일 터치 충돌 해결 핵심 로직
              panning={{ disabled: !isZoomed }} // 확대되었을 때만 이동 가능
              doubleClick={{ mode: "toggle" }}
            >
              {({ zoomIn, zoomOut, resetTransform }) => (
                <React.Fragment>
                  <div className="absolute top-16 right-4 z-50 flex flex-col gap-2">
                     <button onClick={() => zoomIn()} className="p-2 bg-black/50 text-white rounded-full"><ZoomIn size={20} /></button>
                     <button onClick={() => zoomOut()} className="p-2 bg-black/50 text-white rounded-full"><ZoomOut size={20} /></button>
                     <button onClick={() => resetTransform()} className="p-2 bg-black/50 text-white rounded-full"><RotateCcw size={20} /></button>
                  </div>
                  <TransformComponent wrapperClass="w-full h-full flex items-center justify-center" contentClass="w-full h-full flex items-center justify-center">
                    <img
                      src={photos[index]}
                      className="max-h-[85vh] max-w-[95vw] object-contain shadow-2xl"
                      alt="Preview"
                      onDragStart={e => e.preventDefault()}
                    />
                  </TransformComponent>
                </React.Fragment>
              )}
            </TransformWrapper>
          </motion.div>
        </AnimatePresence>

        {/* PC/태블릿용 좌우 네비게이션 화살표 */}
        {!isZoomed && index > 0 && (
          <button className="absolute left-4 p-3 bg-white/10 rounded-full text-white hover:bg-white/20 transition hidden md:block z-40" onClick={() => paginate(-1)}><ChevronLeft size={24} /></button>
        )}
        {!isZoomed && index < photos.length - 1 && (
          <button className="absolute right-4 p-3 bg-white/10 rounded-full text-white hover:bg-white/20 transition hidden md:block z-40" onClick={() => paginate(1)}><ChevronRight size={24} /></button>
        )}
      </div>
    </motion.div>
  );
};

export default PhotoViewer;
