import React, { useState, useRef } from 'react';
import { AssetVersion, Annotation, AnnotationType, AnnotationStatus } from '../types';
import { ReviewCanvas } from './ReviewCanvas';
import { AnnotationSidebar } from './AnnotationSidebar';
import { X, Play, Pause, MessageSquare, Hand, MousePointer2, ZoomIn, ZoomOut, Maximize, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { Button } from './ui/Button';
import { motion, AnimatePresence } from 'motion/react';

interface CompareViewProps {
  projectVersions: AssetVersion[];
  initialLeftVersionId?: string;
  initialRightVersionId: string;
  annotations: Record<string, Annotation[]>;
  onClose: () => void;
}

export const CompareView: React.FC<CompareViewProps> = ({
  projectVersions,
  initialLeftVersionId,
  initialRightVersionId,
  annotations,
  onClose
}) => {
  const [leftId, setLeftId] = useState<string>(initialLeftVersionId || (projectVersions.length > 1 ? projectVersions[1].id : projectVersions[0].id));
  const [rightId, setRightId] = useState<string>(initialRightVersionId);
  
  const leftVersion = projectVersions.find(v => v.id === leftId);
  const rightVersion = projectVersions.find(v => v.id === rightId);
  
  // Shared Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // View State
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<'POINTER' | 'PAN'>('POINTER');
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);

  // Panning State
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ left: 0, top: 0 });

  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);

  const leftAnns = annotations[leftId] || [];
  const rightAnns = annotations[rightId] || [];

  const handleTimeUpdate = (time: number) => {
    if (Math.abs(currentTime - time) > 0.1) {
      setCurrentTime(time);
    }
  };

  const handleAnnotationClick = (id: string, side: 'LEFT' | 'RIGHT') => {
    setActiveAnnotationId(id);
    if (side === 'LEFT' && !isLeftSidebarOpen) setIsLeftSidebarOpen(true);
    if (side === 'RIGHT' && !isRightSidebarOpen) setIsRightSidebarOpen(true);
    
    // Sync time if applicable
    const anns = side === 'LEFT' ? leftAnns : rightAnns;
    const ann = anns.find(a => a.id === id);
    if (ann && ann.timestamp !== undefined) {
        setCurrentTime(ann.timestamp);
        setIsPlaying(false);
    }
  };

  const formatTime = (time: number) => {
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Panning Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
      if (tool === 'PAN') {
          setIsPanning(true);
          setPanStart({ x: e.clientX, y: e.clientY });
          if (leftScrollRef.current) {
              setScrollStart({ 
                  left: leftScrollRef.current.scrollLeft, 
                  top: leftScrollRef.current.scrollTop 
              });
          } else if (rightScrollRef.current) {
              setScrollStart({ 
                left: rightScrollRef.current.scrollLeft, 
                top: rightScrollRef.current.scrollTop 
            });
          }
      }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (isPanning && tool === 'PAN') {
          const dx = e.clientX - panStart.x;
          const dy = e.clientY - panStart.y;
          
          const newLeft = scrollStart.left - dx;
          const newTop = scrollStart.top - dy;

          if (leftScrollRef.current) {
              leftScrollRef.current.scrollLeft = newLeft;
              leftScrollRef.current.scrollTop = newTop;
          }
          if (rightScrollRef.current) {
              rightScrollRef.current.scrollLeft = newLeft;
              rightScrollRef.current.scrollTop = newTop;
          }
      }
  };

  const handleMouseUp = () => setIsPanning(false);

  // Zoom Handlers
  const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 4));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.25));
  const handleZoomReset = () => setZoom(1);

  const renderAnnotations = (versionId: string, version: AssetVersion, side: 'LEFT' | 'RIGHT') => {
    const anns = annotations[versionId] || [];
    return anns.map(ann => {
        const isVisible = version.assetType !== 'VIDEO' || (ann.timestamp !== undefined && Math.abs(currentTime - ann.timestamp) < 2);
        if (!isVisible) return null;

        const isActive = activeAnnotationId === ann.id;
        
        if (ann.type === AnnotationType.BOX && ann.width && ann.height) {
           return (
               <div
                   key={ann.id}
                   onClick={(e) => { e.stopPropagation(); handleAnnotationClick(ann.id, side); }}
                   className={`annotation-pin absolute border-2 cursor-pointer transition-all pointer-events-auto rounded-lg
                    ${isActive ? 'border-primary bg-primary/10 shadow-xl ring-4 ring-primary/5 z-30' : (ann.status === AnnotationStatus.RESOLVED ? 'border-status-approved-text bg-status-approved-bg/10 opacity-60 z-10' : 'border-primary/60 bg-primary/5 z-20 hover:border-primary')}
                   `}
                   style={{ 
                       left: `${ann.x}%`, 
                       top: `${ann.y}%`, 
                       width: `${ann.width}%`, 
                       height: `${ann.height}%` 
                   }}
               />
           );
        }

        return (
         <div
           key={ann.id}
           onClick={(e) => { e.stopPropagation(); handleAnnotationClick(ann.id, side); }}
           className={`annotation-pin absolute transform -translate-x-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-xl border-2 shadow-lg cursor-pointer transition-all pointer-events-auto font-bold text-[10px]
            ${isActive ? 'bg-primary border-white text-white scale-110 z-30 ring-4 ring-primary/20' : (ann.status === AnnotationStatus.RESOLVED ? 'bg-status-approved-text border-white text-white opacity-60 z-10' : 'bg-card-light dark:bg-card-dark border-primary text-primary z-20 hover:scale-110')}
           `}
           style={{ left: `${ann.x}%`, top: `${ann.y}%` }}
         >
           {ann.pinNumber}
         </div>
       );
    });
  };

  if (!leftVersion || !rightVersion) return <div>Error loading versions</div>;

  return (
    <div 
        className="fixed inset-0 z-50 bg-background-light dark:bg-background-dark flex flex-col font-sans"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
    >
      {/* Compare Header */}
      <div className="h-16 bg-card-light dark:bg-card-dark border-b border-border-light dark:border-border-dark flex items-center justify-between px-6 text-text-primary-light dark:text-text-primary-dark shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Maximize className="w-4 h-4 text-primary" />
                </div>
                <span className="font-bold text-lg tracking-tight hidden md:block">Compare Mode</span>
            </div>
            
            {/* Version Selectors */}
            <div className="flex items-center gap-2 bg-background-light dark:bg-background-dark rounded-2xl p-1.5 border border-border-light dark:border-border-dark">
                <select 
                    value={leftId} 
                    onChange={(e) => setLeftId(e.target.value)}
                    className="bg-transparent text-xs font-bold border-none focus:ring-0 cursor-pointer text-text-primary-light dark:text-text-primary-dark max-w-[100px] uppercase tracking-wider"
                >
                    {projectVersions.map(v => (
                        <option key={v.id} value={v.id} className="text-text-primary-light dark:text-text-primary-dark bg-card-light dark:bg-card-dark">v{v.versionNumber}</option>
                    ))}
                </select>
                <span className="text-text-secondary-light dark:text-text-secondary-dark text-[10px] font-black opacity-30">VS</span>
                <select 
                    value={rightId} 
                    onChange={(e) => setRightId(e.target.value)}
                    className="bg-transparent text-xs font-bold border-none focus:ring-0 cursor-pointer text-text-primary-light dark:text-text-primary-dark max-w-[100px] uppercase tracking-wider"
                >
                    {projectVersions.map(v => (
                        <option key={v.id} value={v.id} className="text-text-primary-light dark:text-text-primary-dark bg-card-light dark:bg-card-dark">v{v.versionNumber}</option>
                    ))}
                </select>
            </div>
        </div>

        {/* Center Toolbar */}
        <div className="flex items-center gap-4">
             {/* Playback */}
            {(leftVersion.assetType === 'VIDEO' || rightVersion.assetType === 'VIDEO') && (
                <div className="flex items-center gap-3 bg-background-light dark:bg-background-dark rounded-2xl p-1.5 border border-border-light dark:border-border-dark">
                     <button 
                        onClick={() => setIsPlaying(!isPlaying)} 
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all"
                     >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                     </button>
                     <span className="text-xs font-bold font-mono w-16 text-center text-text-primary-light dark:text-text-primary-dark">
                         {formatTime(currentTime)}
                     </span>
                </div>
            )}

             {/* Tools */}
             <div className="flex items-center bg-background-light dark:bg-background-dark rounded-2xl p-1.5 border border-border-light dark:border-border-dark">
                 <button 
                    onClick={() => setTool('POINTER')}
                    className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all ${tool === 'POINTER' ? 'bg-card-light dark:bg-card-dark text-primary shadow-soft border border-primary/10' : 'text-text-secondary-light dark:text-text-secondary-dark hover:text-primary'}`}
                    title="Pointer"
                 >
                     <MousePointer2 className="w-4 h-4" />
                 </button>
                 <button 
                    onClick={() => setTool('PAN')}
                    className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all ${tool === 'PAN' ? 'bg-card-light dark:bg-card-dark text-primary shadow-soft border border-primary/10' : 'text-text-secondary-light dark:text-text-secondary-dark hover:text-primary'}`}
                    title="Hand Tool"
                 >
                     <Hand className="w-4 h-4" />
                 </button>
             </div>

             {/* Zoom */}
             <div className="flex items-center bg-background-light dark:bg-background-dark rounded-2xl p-1.5 border border-border-light dark:border-border-dark">
                <button onClick={handleZoomOut} className="w-8 h-8 flex items-center justify-center rounded-xl text-text-secondary-light dark:text-text-secondary-dark hover:text-primary transition-colors"><ZoomOut className="w-4 h-4" /></button>
                <span className="text-[10px] font-bold font-mono w-12 text-center text-text-primary-light dark:text-text-primary-dark">{Math.round(zoom * 100)}%</span>
                <button onClick={handleZoomIn} className="w-8 h-8 flex items-center justify-center rounded-xl text-text-secondary-light dark:text-text-secondary-dark hover:text-primary transition-colors"><ZoomIn className="w-4 h-4" /></button>
                <button onClick={handleZoomReset} className="w-8 h-8 flex items-center justify-center rounded-xl text-text-secondary-light dark:text-text-secondary-dark hover:text-primary transition-colors"><Maximize className="w-3.5 h-3.5" /></button>
            </div>
        </div>

        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 mr-2">
                <Button 
                    variant={isLeftSidebarOpen ? "primary" : "secondary"} 
                    size="sm" 
                    onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
                    title="Toggle Left Comments"
                    className="hidden lg:flex rounded-xl"
                >
                    {isLeftSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
                </Button>
                <Button 
                    variant={isRightSidebarOpen ? "primary" : "secondary"} 
                    size="sm" 
                    onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
                    title="Toggle Right Comments"
                    className="rounded-xl"
                >
                    {isRightSidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
                </Button>
            </div>

            <div className="h-8 w-px bg-border-light dark:bg-border-dark mx-1" />

            <Button variant="secondary" size="sm" onClick={onClose} className="rounded-xl font-bold px-4">
                <X className="w-4 h-4 mr-2" /> Exit
            </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Left Sidebar */}
        <AnimatePresence>
            {isLeftSidebarOpen && (
                <motion.div 
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 320, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="bg-card-light dark:bg-card-dark border-r border-border-light dark:border-border-dark flex flex-col shrink-0 z-10 overflow-hidden"
                >
                    <div className="p-4 bg-background-light dark:bg-background-dark border-b border-border-light dark:border-border-dark font-bold text-[10px] uppercase tracking-widest text-center text-text-secondary-light dark:text-text-secondary-dark">
                    Version {leftVersion.versionNumber} Comments
                    </div>
                    <div className="flex-1 overflow-hidden relative">
                        <AnnotationSidebar 
                            className="w-full h-full border-none"
                            annotations={leftAnns}
                            activeAnnotationId={activeAnnotationId}
                            onAnnotationClick={(id) => handleAnnotationClick(id, 'LEFT')}
                            onNewCommentSubmit={() => {}}
                            isAddingNew={false}
                            onCancelNew={() => {}}
                            readOnly={true}
                            currentVersion={leftVersion}
                        />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        {/* Canvases Area */}
        <div 
            className="flex-1 flex flex-col min-w-0 bg-background-light dark:bg-background-dark"
            onMouseDown={handleMouseDown}
        >
            <div className="flex-1 flex overflow-hidden">
                {/* Left Pane */}
                <div className="flex-1 border-r border-border-light dark:border-border-dark relative flex flex-col">
                    <div className="absolute top-6 left-6 z-10 bg-card-light/80 dark:bg-card-dark/80 text-text-primary-light dark:text-text-primary-dark px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest backdrop-blur-md shadow-soft border border-border-light dark:border-border-dark pointer-events-none">
                        Version {leftVersion.versionNumber}
                    </div>
                    <div className="flex-1 relative">
                        <ReviewCanvas
                            scrollRef={leftScrollRef}
                            className={tool === 'PAN' ? 'cursor-grab active:cursor-grabbing' : ''}
                            version={leftVersion}
                            onCanvasClick={() => {}} 
                            currentTime={currentTime}
                            onTimeUpdate={handleTimeUpdate}
                            isPlaying={isPlaying}
                            onDurationChange={setDuration}
                            tool={tool === 'PAN' ? AnnotationType.PIN : 'INTERACT'}
                            readOnly={true}
                            zoom={zoom}
                        >
                            {renderAnnotations(leftId, leftVersion, 'LEFT')}
                        </ReviewCanvas>
                    </div>
                </div>

                {/* Right Pane */}
                <div className="flex-1 relative flex flex-col">
                    <div className="absolute top-6 left-6 z-10 bg-card-light/80 dark:bg-card-dark/80 text-text-primary-light dark:text-text-primary-dark px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest backdrop-blur-md shadow-soft border border-border-light dark:border-border-dark pointer-events-none">
                        Version {rightVersion.versionNumber}
                    </div>
                    <div className="flex-1 relative">
                        <ReviewCanvas
                            scrollRef={rightScrollRef}
                            className={tool === 'PAN' ? 'cursor-grab active:cursor-grabbing' : ''}
                            version={rightVersion}
                            onCanvasClick={() => {}}
                            currentTime={currentTime}
                            onTimeUpdate={handleTimeUpdate}
                            isPlaying={isPlaying}
                            onDurationChange={setDuration}
                            tool={tool === 'PAN' ? AnnotationType.PIN : 'INTERACT'}
                            readOnly={true}
                            zoom={zoom}
                        >
                            {renderAnnotations(rightId, rightVersion, 'RIGHT')}
                        </ReviewCanvas>
                    </div>
                </div>
            </div>
        </div>

        {/* Right Sidebar */}
        <AnimatePresence>
            {isRightSidebarOpen && (
                <motion.div 
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 320, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="bg-card-light dark:bg-card-dark border-l border-border-light dark:border-border-dark flex flex-col shrink-0 z-10 overflow-hidden"
                >
                    <div className="p-4 bg-background-light dark:bg-background-dark border-b border-border-light dark:border-border-dark font-bold text-[10px] uppercase tracking-widest text-center text-text-secondary-light dark:text-text-secondary-dark">
                    Version {rightVersion.versionNumber} Comments
                    </div>
                    <div className="flex-1 overflow-hidden relative">
                        <AnnotationSidebar 
                            className="w-full h-full border-none"
                            annotations={rightAnns}
                            activeAnnotationId={activeAnnotationId}
                            onAnnotationClick={(id) => handleAnnotationClick(id, 'RIGHT')}
                            onNewCommentSubmit={() => {}}
                            isAddingNew={false}
                            onCancelNew={() => {}}
                            readOnly={true}
                            currentVersion={rightVersion}
                        />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
      </div>
    </div>
  );
};
