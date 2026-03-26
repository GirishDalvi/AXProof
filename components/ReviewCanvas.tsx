import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { AssetVersion, AssetType, Annotation, AnnotationType } from '../types';
import { parseGIF, decompressFrames } from 'gifuct-js';
import * as pdfjsLib from 'pdfjs-dist';

// Fix for different ESM loaders handling pdfjs-dist exports differently
const pdfjs = (pdfjsLib as any).default || pdfjsLib;

// Initialize PDF worker
if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
  // Use cdnjs for the worker as it provides a stable classic script suitable for importScripts
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
}

interface ReviewCanvasProps {
  version: AssetVersion;
  onCanvasClick: (x: number, y: number, timestamp?: number, type?: AnnotationType, width?: number, height?: number) => void;
  currentTime?: number;
  onTimeUpdate?: (time: number) => void;
  activeAnnotationId?: string | null;
  children?: React.ReactNode;
  isPlaying?: boolean;
  onDurationChange?: (duration: number) => void;
  tool: AnnotationType | 'INTERACT';
  readOnly?: boolean;
  zoom?: number;
  showAnnotations?: boolean;
  showLiveOverlay?: boolean;
  // Overrides for multi-file assets
  activeAssetUrl?: string; 
  activeAssetType?: AssetType;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  className?: string;
}

export interface ReviewCanvasHandle {
    captureSnapshot: (annotation: Annotation) => Promise<string | null>;
}

// Sub-component for individual PDF pages to handle their own rendering
const PdfPageRenderer: React.FC<{ page: any, scale: number, onCanvasRef: (el: HTMLCanvasElement | null) => void }> = ({ page, scale, onCanvasRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || !page) return;

      const viewport = page.getViewport({ scale });
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Pass ref up
      onCanvasRef(canvas);

      const renderContext = {
          canvasContext: context,
          viewport: viewport,
      };
      
      const renderTask = page.render(renderContext);

      // Handle the promise rejection that occurs when cancel() is called
      renderTask.promise.catch((err: any) => {
          // RenderingCancelledException is expected when we cancel
          if (err.name === 'RenderingCancelledException') {
              return;
          }
          console.error("PDF Render error:", err);
      });

      return () => {
         // cancel() returns void in modern pdf.js, so we don't await or catch it here.
         // The error is caught in the promise above.
         renderTask.cancel();
      };
  }, [page, scale, onCanvasRef]);

  return <canvas ref={canvasRef} className="shadow-sm bg-white" />;
};

export const ReviewCanvas = forwardRef<ReviewCanvasHandle, ReviewCanvasProps>(({
  version,
  onCanvasClick,
  currentTime = 0,
  onTimeUpdate,
  activeAnnotationId,
  children,
  isPlaying,
  onDurationChange,
  tool,
  readOnly = false,
  zoom = 1,
  showAnnotations = true,
  showLiveOverlay = true,
  activeAssetUrl,
  activeAssetType,
  scrollRef,
  className
}, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{x: number, y: number} | null>(null);
  const [currentPos, setCurrentPos] = useState<{x: number, y: number} | null>(null);

  const currentUrl = activeAssetUrl || version.url;
  const currentType = activeAssetType || version.assetType;

  // GIF State
  const [gifFrames, setGifFrames] = useState<{imageData: ImageData, delay: number, start: number}[]>([]);
  const [gifDuration, setGifDuration] = useState(0);
  const [isGifLoading, setIsGifLoading] = useState(false);
  const [gifError, setGifError] = useState<string | null>(null);

  // PDF State
  const [pdfPages, setPdfPages] = useState<any[]>([]); // Store PDF page proxies
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  // We keep a map of canvas refs for PDF pages: index -> canvas
  const pdfCanvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  // HTML/Iframe State
  const [isIframeLoading, setIsIframeLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  const [iframeContentSize, setIframeContentSize] = useState({ width: 0, height: 0 });
  const [assetDimensions, setAssetDimensions] = useState({ width: 0, height: 0 });

  const syncIframeState = (e?: Event) => {
    if (iframeRef.current?.contentWindow) {
      try {
        const doc = iframeRef.current.contentWindow.document;
        
        // Try to find ad size from meta tags first (common in HTML5 ads)
        const adSizeMeta = doc.querySelector('meta[name="ad.size"]');
        if (adSizeMeta) {
          const content = adSizeMeta.getAttribute('content');
          const widthMatch = content?.match(/width=(\d+)/);
          const heightMatch = content?.match(/height=(\d+)/);
          if (widthMatch && heightMatch) {
            setIframeContentSize({ width: parseInt(widthMatch[1]), height: parseInt(heightMatch[1]) });
            return;
          }
        }

        // Get the maximum scrollable dimensions
        let contentWidth = Math.max(doc.body.scrollWidth, doc.documentElement.scrollWidth, doc.body.offsetWidth, doc.documentElement.offsetWidth, doc.documentElement.clientWidth);
        let contentHeight = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight, doc.body.offsetHeight, doc.documentElement.offsetHeight, doc.documentElement.clientHeight);
        
        // If dimensions are very small or zero, try to find the largest element
        if (contentWidth < 10 || contentHeight < 10) {
          const elements = doc.querySelectorAll('body > *');
          elements.forEach(el => {
            const rect = (el as HTMLElement).getBoundingClientRect();
            contentWidth = Math.max(contentWidth, rect.width);
            contentHeight = Math.max(contentHeight, rect.height);
          });
        }

        setIframeContentSize({ width: contentWidth || 300, height: contentHeight || 250 });
      } catch (err) {
        // Cross-origin error - fallback to common ad size or fill
        if (iframeContentSize.width === 0) {
          setIframeContentSize({ width: 300, height: 250 });
        }
      }
    }
  };

  // Use ResizeObserver to track asset dimensions for perfect overlay alignment
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setAssetDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });

    const target = containerRef.current;
    if (target) {
      observer.observe(target);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (currentType === AssetType.HTML && !isIframeLoading && iframeRef.current?.contentWindow) {
      try {
        const win = iframeRef.current.contentWindow;
        // Use capture phase to catch scroll events on any element inside the iframe
        win.addEventListener('scroll', syncIframeState, true);
        win.document.addEventListener('scroll', syncIframeState, true);
        win.addEventListener('resize', syncIframeState);
        
        const observer = new MutationObserver(() => syncIframeState());
        observer.observe(win.document.body, { childList: true, subtree: true, attributes: true });
        
        // Initial sync
        syncIframeState();

        return () => {
          win.removeEventListener('scroll', syncIframeState, true);
          win.document.removeEventListener('scroll', syncIframeState, true);
          win.removeEventListener('resize', syncIframeState);
          observer.disconnect();
        };
      } catch (e) {
        // Cross-origin error
      }
    }
  }, [currentType, isIframeLoading]);

  // Reset iframe state when URL changes
  useEffect(() => {
    if (currentType === AssetType.HTML) {
      setIsIframeLoading(true);
      setIframeError(false);
    }
  }, [currentUrl, currentType]);

  // Load GIF
  useEffect(() => {
      let isMounted = true;
      if (currentType === AssetType.GIF && currentUrl) {
          setIsGifLoading(true);
          setGifError(null);
          
          fetch(currentUrl)
            .then(resp => {
                if (!resp.ok) throw new Error("Network response was not ok");
                return resp.arrayBuffer();
            })
            .then(buff => {
                if (!isMounted) return;
                
                // Parse
                const gif = parseGIF(buff);
                const frames = decompressFrames(gif, true);
                
                if (!frames || frames.length === 0) {
                     throw new Error("No frames found in GIF");
                }

                // Determine dimensions - check multiple sources as gifuct-js types vary
                // @ts-ignore - access raw property if needed
                let width = gif.raw?.lsd?.width || frames[0].dims.width;
                // @ts-ignore
                let height = gif.raw?.lsd?.height || frames[0].dims.height;

                // Validate dimensions
                if (!width || !height || width <= 0 || height <= 0) {
                     // Try to find ANY valid frame dim
                     const validFrame = frames.find(f => f.dims.width > 0 && f.dims.height > 0);
                     if (validFrame) {
                         width = validFrame.dims.width;
                         height = validFrame.dims.height;
                     } else {
                         throw new Error(`Invalid GIF dimensions: ${width}x${height}`);
                     }
                }

                // Pre-render frames to handling disposal
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (!ctx) throw new Error("Could not create canvas context");

                const loadedFrames: {imageData: ImageData, delay: number, start: number}[] = [];
                let time = 0;

                frames.forEach(frame => {
                    // Skip invalid frames
                    if (frame.dims.width <= 0 || frame.dims.height <= 0) return;
                    
                    const expectedSize = frame.dims.width * frame.dims.height * 4;
                    if (frame.patch.length !== expectedSize) return;

                    // Draw patch
                    const patch = new ImageData(
                        new Uint8ClampedArray(frame.patch),
                        frame.dims.width,
                        frame.dims.height
                    );
                    
                    const patchCanvas = document.createElement('canvas');
                    patchCanvas.width = frame.dims.width;
                    patchCanvas.height = frame.dims.height;
                    const patchCtx = patchCanvas.getContext('2d');
                    
                    if (patchCtx) {
                        patchCtx.putImageData(patch, 0, 0);

                        // Handling Disposal
                        // 2: Restore to background (clear rect)
                        // 3: Restore to previous (not implemented here, complex)
                        if (frame.disposalType === 2) {
                             ctx.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height);
                        }
                        
                        ctx.drawImage(patchCanvas, frame.dims.left, frame.dims.top);
                    }
                    
                    loadedFrames.push({
                        imageData: ctx.getImageData(0,0, width, height),
                        delay: frame.delay,
                        start: time
                    });
                    
                    time += frame.delay;
                });

                if (isMounted) {
                    setGifFrames(loadedFrames);
                    setGifDuration(time / 1000);
                    onDurationChange?.(time / 1000);
                    setIsGifLoading(false);
                }
            })
            .catch(err => {
                console.error("Failed to parse GIF", err);
                if (isMounted) {
                    setGifError("Failed to load GIF");
                    setIsGifLoading(false);
                }
            });
      } else {
          setGifFrames([]);
          setGifDuration(0);
          setGifError(null);
      }
      return () => { isMounted = false; };
  }, [currentUrl, currentType]);

  // Load PDF
  useEffect(() => {
      let isMounted = true;
      if (currentType === AssetType.PDF && currentUrl) {
          setIsPdfLoading(true);
          setPdfPages([]);
          pdfCanvasRefs.current = [];
          
          const loadingTask = pdfjs.getDocument(currentUrl);
          loadingTask.promise.then(async (pdf: any) => {
              if (!isMounted) return;
              const pages = [];
              for (let i = 1; i <= pdf.numPages; i++) {
                  try {
                    const page = await pdf.getPage(i);
                    pages.push(page);
                  } catch (e) {
                      console.error(`Error loading page ${i}`, e);
                  }
              }
              if (isMounted) {
                  setPdfPages(pages);
                  setIsPdfLoading(false);
              }
          }).catch((err: any) => {
              console.error("PDF Load Error", err);
              if (isMounted) setIsPdfLoading(false);
          });
      } else {
          setPdfPages([]);
      }
      return () => { isMounted = false; };
  }, [currentUrl, currentType]);

  // GIF Rendering & Playback Loop
  useEffect(() => {
      if (currentType === AssetType.GIF && canvasRef.current && gifFrames.length > 0) {
          const ctx = canvasRef.current.getContext('2d');
          if (!ctx) return;
          
          // Find frame
          const timeMs = currentTime * 1000;
          // Loop logic for playback visual is handled by time updates from parent, 
          // but we need to find the correct frame for current 'time'
          // Standard GIF behavior loop: timeMs % totalDuration
          const safeTime = (timeMs % (gifDuration * 1000)); 
          
          const frame = gifFrames.find((f, i) => {
              const next = gifFrames[i+1];
              return safeTime >= f.start && (!next || safeTime < next.start);
          }) || gifFrames[0];

          // Check if dimensions match
          if (canvasRef.current.width !== frame.imageData.width || canvasRef.current.height !== frame.imageData.height) {
              canvasRef.current.width = frame.imageData.width;
              canvasRef.current.height = frame.imageData.height;
          }

          ctx.putImageData(frame.imageData, 0, 0);
      }
  }, [currentTime, gifFrames, currentType, gifDuration]);

  // GIF Playback Tick - Updates parent time
  const currentTimeRef = useRef(currentTime);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);

  useEffect(() => {
      let rafId: number;
      if (currentType === AssetType.GIF && isPlaying && onTimeUpdate && gifDuration > 0) {
          let lastTime = performance.now();
          const loop = () => {
              const now = performance.now();
              const dt = (now - lastTime) / 1000;
              lastTime = now;
              
              let nextTime = currentTimeRef.current + dt;
              if (nextTime >= gifDuration) nextTime = 0;
              
              onTimeUpdate(nextTime); // This will trigger re-render and prop update, updating ref
              rafId = requestAnimationFrame(loop);
          };
          rafId = requestAnimationFrame(loop);
      }
      return () => cancelAnimationFrame(rafId);
  }, [isPlaying, currentType, gifDuration]); // Intentionally omitting currentTime from deps to avoid re-subscription loop

  useImperativeHandle(ref, () => ({
    captureSnapshot: async (ann: Annotation) => {
        const outputCanvas = document.createElement('canvas');
        const ctx = outputCanvas.getContext('2d');
        if (!ctx) return null;

        let width = 0;
        let height = 0;
        let source: CanvasImageSource | null = null;
        // Shadow annotation to modify Y for PDF snapshotting without affecting original
        let snapshotAnn = { ...ann };

        try {
            if (currentType === AssetType.VIDEO && videoRef.current) {
                const vid = videoRef.current;
                source = vid;
                width = vid.videoWidth;
                height = vid.videoHeight;

                if (ann.timestamp !== undefined) {
                    const originalTime = vid.currentTime;
                    await new Promise<void>((resolve) => {
                        const onSeeked = () => {
                            vid.removeEventListener('seeked', onSeeked);
                            resolve();
                        };
                        vid.addEventListener('seeked', onSeeked);
                        vid.currentTime = ann.timestamp || 0;
                    });
                }
            } else if (currentType === AssetType.IMAGE && imgRef.current) {
                const img = imgRef.current;
                source = img;
                width = img.naturalWidth;
                height = img.naturalHeight;
            } else if (currentType === AssetType.GIF && canvasRef.current) {
                // For GIF, we need to render the specific frame to a temp canvas
                if (gifFrames.length > 0 && ann.timestamp !== undefined) {
                    const timeMs = ann.timestamp * 1000;
                    const safeTime = (timeMs % (gifDuration * 1000)); 
                    const frame = gifFrames.find((f, i) => {
                        const next = gifFrames[i+1];
                        return safeTime >= f.start && (!next || safeTime < next.start);
                    }) || gifFrames[0];

                    source = document.createElement('canvas');
                    source.width = frame.imageData.width;
                    source.height = frame.imageData.height;
                    const sCtx = (source as HTMLCanvasElement).getContext('2d');
                    sCtx?.putImageData(frame.imageData, 0, 0);

                    width = frame.imageData.width;
                    height = frame.imageData.height;
                } else if (canvasRef.current) {
                   source = canvasRef.current;
                   width = canvasRef.current.width;
                   height = canvasRef.current.height;
                }
            } else if (currentType === AssetType.PDF && pdfPages.length > 0) {
                 // Calculate which page based on Y percentage and total height
                 const canvases = pdfCanvasRefs.current.filter(Boolean) as HTMLCanvasElement[];
                 const pageHeights = canvases.map(c => c.height);
                 const totalHeight = pageHeights.reduce((a, b) => a + b, 0);
                 const gap = 16; // 4 * 4px gap
                 const totalGapHeight = Math.max(0, (pageHeights.length - 1) * gap);
                 const effectiveTotalHeight = totalHeight + totalGapHeight;

                 const targetY = (ann.y / 100) * effectiveTotalHeight;
                 
                 let currentY = 0;
                 let foundIndex = -1;
                 let localY = 0;

                 for (let i = 0; i < pageHeights.length; i++) {
                     const h = pageHeights[i];
                     if (targetY >= currentY && targetY <= currentY + h) {
                         foundIndex = i;
                         localY = targetY - currentY;
                         break;
                     }
                     currentY += h + gap;
                 }
                 
                 // If not found (e.g. gap click or edge case), default to first or clamped
                 if (foundIndex === -1 && canvases.length > 0) {
                     if (targetY < 0) foundIndex = 0;
                     else foundIndex = canvases.length - 1;
                 }

                 if (foundIndex !== -1 && canvases[foundIndex]) {
                     const sourceCanvas = canvases[foundIndex];
                     source = sourceCanvas;
                     width = sourceCanvas.width;
                     height = sourceCanvas.height;
                     
                     // Convert local pixel Y back to percentage of THIS page for the drawing step
                     const localYPercent = (localY / height) * 100;
                     snapshotAnn.y = localYPercent;
                 }
            }

            if (!source || width === 0 || height === 0) return null;

            outputCanvas.width = width;
            outputCanvas.height = height;

            // Draw Source
            ctx.drawImage(source, 0, 0, width, height);

            // Draw Annotation
            ctx.strokeStyle = '#0ea5e9'; // brand-500
            ctx.lineWidth = Math.max(4, width * 0.005);
            ctx.fillStyle = '#0ea5e9';

            if (snapshotAnn.type === AnnotationType.BOX && snapshotAnn.width && snapshotAnn.height) {
                const x = (snapshotAnn.x / 100) * width;
                const y = (snapshotAnn.y / 100) * height;
                const w = (snapshotAnn.width / 100) * width;
                const h = (snapshotAnn.height / 100) * height;
                ctx.strokeRect(x, y, w, h);
                
                // Label
                ctx.font = `bold ${Math.max(16, width * 0.02)}px Arial`;
                ctx.fillStyle = 'white';
                const radius = Math.max(12, width * 0.015);
                
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, 2 * Math.PI);
                ctx.fillStyle = '#0ea5e9';
                ctx.fill();
                ctx.fillStyle = 'white';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(snapshotAnn.pinNumber.toString(), x, y);

            } else {
                // PIN
                const x = (snapshotAnn.x / 100) * width;
                const y = (snapshotAnn.y / 100) * height;
                const radius = Math.max(20, width * 0.02);

                ctx.beginPath();
                ctx.arc(x, y, radius, 0, 2 * Math.PI);
                ctx.fillStyle = '#0ea5e9';
                ctx.fill();
                ctx.strokeStyle = 'white';
                ctx.stroke();

                ctx.font = `bold ${radius}px Arial`;
                ctx.fillStyle = 'white';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(snapshotAnn.pinNumber.toString(), x, y);
            }

            return outputCanvas.toDataURL('image/jpeg', 0.8);

        } catch (e) {
            console.error("Snapshot failed", e);
            return null;
        }
    }
  }));

  // Sync video play state
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.play();
      else videoRef.current.pause();
    }
    if (currentType === AssetType.HTML && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: isPlaying ? 'PLAY' : 'PAUSE' }, '*');
    }
  }, [isPlaying, currentType]);

  // Sync video and HTML time
  useEffect(() => {
    if (videoRef.current && currentTime !== undefined && Math.abs(videoRef.current.currentTime - currentTime) > 0.5) {
      videoRef.current.currentTime = currentTime;
    }
    if (currentType === AssetType.HTML && iframeRef.current?.contentWindow && currentTime !== undefined) {
      iframeRef.current.contentWindow.postMessage({ type: 'SEEK', time: currentTime }, '*');
    }
  }, [currentTime, currentType]);

  // HTML Playback Tick
  useEffect(() => {
      let rafId: number;
      if (currentType === AssetType.HTML) {
          onDurationChange?.(15); // Default 15s for HTML ads
          if (isPlaying && onTimeUpdate) {
              let lastTime = performance.now();
              const loop = () => {
                  const now = performance.now();
                  const dt = (now - lastTime) / 1000;
                  lastTime = now;
                  
                  let nextTime = currentTimeRef.current + dt;
                  if (nextTime >= 15) nextTime = 0;
                  
                  onTimeUpdate(nextTime);
                  rafId = requestAnimationFrame(loop);
              };
              rafId = requestAnimationFrame(loop);
          }
      }
      return () => cancelAnimationFrame(rafId);
  }, [isPlaying, currentType]);

  const getRelativeCoords = (e: React.MouseEvent | MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };

    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly) return;
    if ((e.target as HTMLElement).closest('.annotation-pin')) return;
    if (tool === AnnotationType.BOX) {
      setIsDrawing(true);
      const coords = getRelativeCoords(e);
      setStartPos(coords);
      setCurrentPos(coords);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly) return;
    if (isDrawing && tool === AnnotationType.BOX) {
      setCurrentPos(getRelativeCoords(e));
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly) return;
    if (tool === AnnotationType.BOX && isDrawing && startPos && currentPos) {
      // Calculate box
      const x = Math.min(startPos.x, currentPos.x);
      const y = Math.min(startPos.y, currentPos.y);
      const width = Math.abs(currentPos.x - startPos.x);
      const height = Math.abs(currentPos.y - startPos.y);

      if (width > 1 && height > 1) { // Min size check
        let timestamp;
        if (currentType === AssetType.VIDEO && videoRef.current) {
            timestamp = videoRef.current.currentTime;
        } else if (currentType === AssetType.GIF || currentType === AssetType.HTML) {
            timestamp = currentTime;
        }
        
        if (onTimeUpdate && timestamp !== undefined) onTimeUpdate(timestamp);

        onCanvasClick(x, y, timestamp, AnnotationType.BOX, width, height);
      }
      setIsDrawing(false);
      setStartPos(null);
      setCurrentPos(null);
    }
  };

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly) return;
    if (tool === AnnotationType.PIN) {
        if ((e.target as HTMLElement).closest('.annotation-pin')) return;

        const coords = getRelativeCoords(e);
        let timestamp;
        if (currentType === AssetType.VIDEO && videoRef.current) {
            timestamp = videoRef.current.currentTime;
        } else if (currentType === AssetType.GIF || currentType === AssetType.HTML) {
            timestamp = currentTime;
        }

        if (onTimeUpdate && timestamp !== undefined) onTimeUpdate(timestamp);

        onCanvasClick(coords.x, coords.y, timestamp, AnnotationType.PIN);
    }
  };

  const renderAsset = () => {
    if (!currentUrl) {
      return <div className="text-white p-10">Asset not found</div>;
    }

    switch (currentType) {
      case AssetType.VIDEO:
        return (
          <video
            ref={videoRef}
            src={currentUrl}
            className="block max-w-full max-h-full object-contain shadow-lg"
            style={{ width: 'auto', height: 'auto' }}
            onTimeUpdate={() => onTimeUpdate?.(videoRef.current?.currentTime || 0)}
            onLoadedMetadata={() => onDurationChange?.(videoRef.current?.duration || 0)}
            playsInline
            crossOrigin="anonymous"
          />
        );
      case AssetType.IMAGE:
        return (
          <img 
            ref={imgRef}
            src={currentUrl} 
            alt="Asset" 
            className="block max-w-full max-h-full object-contain select-none shadow-lg" 
            style={{ width: 'auto', height: 'auto' }}
            draggable={false}
            crossOrigin="anonymous"
          />
        );
      case AssetType.GIF:
        if (isGifLoading) {
            return <div className="text-white animate-pulse">Processing GIF...</div>;
        }
        if (gifError) {
             return <div className="text-red-400 p-10 bg-gray-800 rounded">{gifError}</div>;
        }
        // Need to set explicit dimensions or canvas defaults to 300x150
        const w = gifFrames[0]?.imageData.width || 'auto';
        const h = gifFrames[0]?.imageData.height || 'auto';
        return (
            <canvas
                ref={canvasRef}
                width={typeof w === 'number' ? w : undefined}
                height={typeof h === 'number' ? h : undefined}
                className="block max-w-full max-h-full object-contain shadow-lg"
                style={{ width: 'auto', height: 'auto' }}
            />
        );
      case AssetType.PDF:
        if (isPdfLoading) {
            return <div className="text-white animate-pulse">Loading PDF...</div>;
        }
        return (
            <div className="flex flex-col gap-4 bg-gray-500/10 p-4 rounded shadow-inner">
                {pdfPages.map((page, index) => (
                    <PdfPageRenderer 
                        key={index} 
                        page={page} 
                        scale={zoom * 1.5} 
                        onCanvasRef={(el) => { pdfCanvasRefs.current[index] = el; }}
                    />
                ))}
            </div>
        );
      case AssetType.HTML:
        return (
          <div className="absolute top-0 left-0 w-full h-full bg-white border border-gray-200 shadow-lg">
            {isIframeLoading && !iframeError && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-2 text-gray-500">Loading creative...</span>
              </div>
            )}
            {iframeError && (
              <div className="absolute inset-0 flex items-center justify-center bg-red-50 z-10">
                <div className="text-red-500 text-center">
                  <p className="font-semibold">Failed to load creative</p>
                  <p className="text-sm">Please check the console for details or try re-uploading.</p>
                </div>
              </div>
            )}
            <iframe 
              ref={iframeRef}
              src={currentUrl} 
              className={`absolute top-0 left-0 w-full h-full border-none z-10 ${tool !== 'INTERACT' ? 'pointer-events-none' : ''} ${isIframeLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`} 
              title="HTML Proof"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              style={{ margin: 0, padding: 0 }}
              onLoad={() => {
                setIsIframeLoading(false);
                try {
                  if (iframeRef.current?.contentWindow) {
                    iframeRef.current.contentWindow.postMessage({ type: isPlaying ? 'PLAY' : 'PAUSE' }, '*');
                    if (currentTime !== undefined) {
                      iframeRef.current.contentWindow.postMessage({ type: 'SEEK', time: currentTime }, '*');
                    }
                  }
                } catch (e) {
                  console.error("Iframe load error or cross-origin issue:", e);
                  setIframeError(true);
                }
              }}
              onError={() => {
                setIsIframeLoading(false);
                setIframeError(true);
              }}
            />
            {/* Transparent overlay to capture annotation clicks */}
            {tool !== 'INTERACT' && (
              <div className="absolute inset-0 bg-transparent z-20" /> 
            )}
            
            {/* Secondary Annotation Overlay for Live Website */}
            {showAnnotations && showLiveOverlay && (
              <div 
                className="absolute inset-0 pointer-events-none z-30"
                style={{
                  width: '100%',
                  height: '100%'
                }}
              >
                {children}
              </div>
            )}
          </div>
        );
      default:
        return (
          <div className="flex items-center justify-center w-full h-[400px] bg-gray-100 rounded-lg border-2 border-dashed border-gray-300">
            <div className="text-center text-gray-500">
              <p className="text-lg font-medium">Unsupported Asset Type</p>
              <p className="text-sm">This asset type ({currentType}) cannot be rendered.</p>
            </div>
          </div>
        );
    }
  };

  // Determine if we should shrink-wrap the container to the asset (Media) 
  // or fill the viewport (HTML/PDF)
  const isPdf = currentType === AssetType.PDF;
  const isMedia = currentType === AssetType.IMAGE || currentType === AssetType.VIDEO || currentType === AssetType.GIF || isPdf;

  const innerContent = (
      <div 
        ref={containerRef} 
        onClick={handleContainerClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setIsDrawing(false); setStartPos(null); }}
        className={`relative flex-shrink-0 m-auto transition-all duration-200 ease-out group
          ${readOnly ? 'cursor-default' : (tool === AnnotationType.BOX ? 'cursor-crosshair' : 'cursor-default')}
        `}
        style={isMedia ? {
          // For PDF, we want 'none' max constraints to allow vertical scroll, or at least maxHeight none
          maxWidth: isPdf ? 'none' : `${zoom * 100}%`, 
          maxHeight: isPdf ? 'none' : `${zoom * 100}%`,
          width: 'fit-content',
          height: 'fit-content'
        } : {
          width: iframeContentSize.width > 0 ? `${iframeContentSize.width}px` : '100%',
          height: iframeContentSize.height > 0 ? `${iframeContentSize.height}px` : '100%',
          transform: iframeContentSize.width > 0 ? `scale(${zoom})` : 'none',
          transformOrigin: 'center',
          backgroundColor: '#fff'
        }}
      >
        {renderAsset()}
        
        {/* Annotations Overlay - Perfectly aligned with container */}
        {showAnnotations && (
          <div 
            className="absolute top-0 left-0 pointer-events-none z-20"
            style={{ 
              width: '100%', 
              height: '100%'
            }}
          >
            {/* Drawing Preview Box */}
            {isDrawing && startPos && currentPos && (
              <div 
                className="absolute border-2 border-brand-500 bg-brand-500/20 pointer-events-none z-30"
                style={{
                  left: `${Math.min(startPos.x, currentPos.x)}%`,
                  top: `${Math.min(startPos.y, currentPos.y)}%`,
                  width: `${Math.abs(currentPos.x - startPos.x)}%`,
                  height: `${Math.abs(currentPos.y - startPos.y)}%`
                }}
              />
            )}

            {/* Pins & Boxes Overlay */}
            {(activeAssetType || version.assetType) !== AssetType.HTML && children}
          </div>
        )}
      </div>
  );

  return (
    <div 
        ref={scrollRef}
        className={`w-full h-full bg-gray-900 overflow-auto flex ${className || ''}`}
    >
      {!isMedia && iframeContentSize.width > 0 ? (
        <div 
          className="m-auto flex items-center justify-center flex-shrink-0"
          style={{
            width: `${iframeContentSize.width * zoom}px`,
            height: `${iframeContentSize.height * zoom}px`,
          }}
        >
          {innerContent}
        </div>
      ) : (
        innerContent
      )}
    </div>
  );
});

ReviewCanvas.displayName = 'ReviewCanvas';