import React, { useState, useRef } from 'react';
import { AssetVersion, Annotation, AnnotationType, AnnotationStatus } from '../types';
import { ReviewCanvas } from './ReviewCanvas';
import { AnnotationSidebar } from './AnnotationSidebar';
import { X, Play, Pause, MessageSquare, Hand, MousePointer2, ZoomIn, ZoomOut, Maximize, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { Button } from './ui/Button';

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
          // Capture initial scroll position from one of the containers (assuming synced)
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

  // Sync scroll on manual scroll (e.g. trackpad)
  const handleScroll = (e: React.UIEvent<HTMLDivElement>, targetRef: React.RefObject<HTMLDivElement | null>) => {
      if (isPanning) return; // Managed by mouse move
      const target = e.currentTarget;
      if (targetRef.current) {
          if (Math.abs(targetRef.current.scrollTop - target.scrollTop) > 1 || Math.abs(targetRef.current.scrollLeft - target.scrollLeft) > 1) {
            targetRef.current.scrollTop = target.scrollTop;
            targetRef.current.scrollLeft = target.scrollLeft;
          }
      }
  };

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
        const colorClass = isActive 
            ? 'border-brand-500 bg-brand-500/30 z-30' 
            : (ann.status === AnnotationStatus.RESOLVED ? 'border-green-400 bg-green-400/10 z-10' : 'border-brand-400 bg-brand-400/10 z-20');
        
        const pinColorClass = isActive
            ? 'bg-brand-500 border-white text-white scale-110 z-30'
            : (ann.status === AnnotationStatus.RESOLVED ? 'bg-green-500 border-white text-white z-10' : 'bg-brand-500 border-white text-white z-20');

        if (ann.type === AnnotationType.BOX && ann.width && ann.height) {
           return (
               <div
                   key={ann.id}
                   onClick={(e) => { e.stopPropagation(); handleAnnotationClick(ann.id, side); }}
                   className={`annotation-pin absolute border-2 cursor-pointer hover:border-brand-300 transition-all pointer-events-auto ${colorClass}`}
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
           className={`annotation-pin absolute transform -translate-x-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full border-2 shadow-sm cursor-pointer hover:scale-110 transition-transform pointer-events-auto ${pinColorClass}`}
           style={{ left: `${ann.x}%`, top: `${ann.y}%` }}
         >
           <span className="font-bold text-[10px]">{ann.pinNumber}</span>
         </div>
       );
    });
  };

  if (!leftVersion || !rightVersion) return <div>Error loading versions</div>;

  return (
    <div 
        className="fixed inset-0 z-50 bg-gray-900 flex flex-col"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
    >
      {/* Compare Header */}
      <div className="h-14 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4 text-white shrink-0">
        <div className="flex items-center gap-4">
            <span className="font-semibold text-lg hidden md:block">Compare Mode</span>
            
            {/* Version Selectors */}
            <div className="flex items-center gap-2 bg-gray-700 rounded-lg p-1">
                <select 
                    value={leftId} 
                    onChange={(e) => setLeftId(e.target.value)}
                    className="bg-transparent text-sm border-none focus:ring-0 cursor-pointer text-gray-200 max-w-[120px]"
                >
                    {projectVersions.map(v => (
                        <option key={v.id} value={v.id} className="text-black">v{v.versionNumber}</option>
                    ))}
                </select>
                <span className="text-gray-500 text-xs font-bold">VS</span>
                <select 
                    value={rightId} 
                    onChange={(e) => setRightId(e.target.value)}
                    className="bg-transparent text-sm border-none focus:ring-0 cursor-pointer text-gray-200 max-w-[120px]"
                >
                    {projectVersions.map(v => (
                        <option key={v.id} value={v.id} className="text-black">v{v.versionNumber}</option>
                    ))}
                </select>
            </div>
        </div>

        {/* Center Toolbar */}
        <div className="flex items-center gap-3">
             {/* Playback */}
            {(leftVersion.assetType === 'VIDEO' || rightVersion.assetType === 'VIDEO') && (
                <div className="flex items-center gap-2 mr-4 bg-gray-700 rounded-lg p-1">
                     <button 
                        onClick={() => setIsPlaying(!isPlaying)} 
                        className="p-1.5 rounded bg-brand-600 hover:bg-brand-500 text-white"
                     >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                     </button>
                     <span className="text-xs font-mono w-16 text-center">
                         {formatTime(currentTime)}
                     </span>
                </div>
            )}

             {/* Tools */}
             <div className="flex items-center bg-gray-700 rounded-lg p-1">
                 <button 
                    onClick={() => setTool('POINTER')}
                    className={`p-1.5 rounded transition-colors ${tool === 'POINTER' ? 'bg-gray-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                    title="Pointer"
                 >
                     <MousePointer2 className="w-4 h-4" />
                 </button>
                 <button 
                    onClick={() => setTool('PAN')}
                    className={`p-1.5 rounded transition-colors ${tool === 'PAN' ? 'bg-gray-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                    title="Hand Tool"
                 >
                     <Hand className="w-4 h-4" />
                 </button>
             </div>

             {/* Zoom */}
             <div className="flex items-center bg-gray-700 rounded-lg p-1">
                <button onClick={handleZoomOut} className="p-1.5 rounded text-gray-400 hover:text-gray-200"><ZoomOut className="w-4 h-4" /></button>
                <span className="text-xs font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
                <button onClick={handleZoomIn} className="p-1.5 rounded text-gray-400 hover:text-gray-200"><ZoomIn className="w-4 h-4" /></button>
                <button onClick={handleZoomReset} className="p-1.5 rounded text-gray-400 hover:text-gray-200"><Maximize className="w-3 h-3" /></button>
            </div>
        </div>

        <div className="flex items-center gap-2">
            <Button 
                variant={isLeftSidebarOpen ? "primary" : "secondary"} 
                size="sm" 
                onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
                title="Toggle Left Comments"
                className="hidden lg:flex"
            >
                {isLeftSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </Button>
             <Button 
                variant={isRightSidebarOpen ? "primary" : "secondary"} 
                size="sm" 
                onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
                title="Toggle Right Comments"
            >
                {isRightSidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            </Button>

            <div className="h-6 w-px bg-gray-600 mx-2" />

            <Button variant="secondary" size="sm" onClick={onClose}>
                <X className="w-4 h-4 mr-2" /> Exit
            </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Left Sidebar */}
        {isLeftSidebarOpen && (
             <div className="w-80 bg-white border-r border-gray-200 flex flex-col shrink-0 animate-in slide-in-from-left-10 duration-200 z-10">
                <div className="p-3 bg-gray-50 border-b border-gray-200 font-medium text-sm text-center">
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
             </div>
        )}

        {/* Canvases Area */}
        <div 
            className="flex-1 flex flex-col min-w-0"
            onMouseDown={handleMouseDown}
        >
            <div className="flex-1 flex overflow-hidden">
                {/* Left Pane */}
                <div className="flex-1 border-r border-gray-700 relative flex flex-col">
                    <div className="absolute top-4 left-4 z-10 bg-black/50 text-white px-2 py-1 rounded text-xs backdrop-blur-sm pointer-events-none">
                        Version {leftVersion.versionNumber}
                    </div>
                    <div className="flex-1 relative bg-black">
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
                            {/* We handle scroll syncing by attaching scroll listener to the inner div via ReviewCanvas prop modification? 
                                Currently ReviewCanvas doesn't expose onScroll. 
                                We'll use the ref's native onScroll event, but we need to attach it.
                                React 'onScroll' on the ReviewCanvas component wrapper works if we bubble it up, 
                                but ReviewCanvas's overflow div is internal.
                                We can cheat and attach the listener in a useEffect here or add onScroll to ReviewCanvas props.
                                For now, relying on the 'isPanning' mouse move logic handles the main "Hand Tool" requirement. 
                                Trackpad syncing is secondary but good to have.
                            */}
                            {renderAnnotations(leftId, leftVersion, 'LEFT')}
                        </ReviewCanvas>
                    </div>
                </div>

                {/* Right Pane */}
                <div className="flex-1 relative flex flex-col">
                    <div className="absolute top-4 left-4 z-10 bg-black/50 text-white px-2 py-1 rounded text-xs backdrop-blur-sm pointer-events-none">
                        Version {rightVersion.versionNumber}
                    </div>
                    <div className="flex-1 relative bg-black">
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
        {isRightSidebarOpen && (
             <div className="w-80 bg-white border-l border-gray-200 flex flex-col shrink-0 animate-in slide-in-from-right-10 duration-200 z-10">
                <div className="p-3 bg-gray-50 border-b border-gray-200 font-medium text-sm text-center">
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
             </div>
        )}
      </div>
    </div>
  );
};