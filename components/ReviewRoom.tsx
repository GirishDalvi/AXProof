import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAXProof } from '../context/ZflowContext';
import { ReviewCanvas, ReviewCanvasHandle } from './ReviewCanvas';
import { AnnotationSidebar } from './AnnotationSidebar';
import { Button } from './ui/Button';
import { CompareView } from './CompareView';
import { Annotation, AnnotationStatus, AnnotationType, AssetFile, AssetType, Attachment } from '../types';
import { ArrowLeft, Play, Pause, Layers, MousePointer2, BoxSelect, CheckCircle, Lock, AlertCircle, FileDown, GitBranch, Send, Upload, X, ZoomIn, ZoomOut, Maximize, FileText, Image as ImageIcon, FileCode, Film, Package, Globe, Link as LinkIcon, Clock, Hourglass, Loader2, MoreVertical, Trash2, ExternalLink } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { db } from '../db';

export const ReviewRoom: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { getProject, addAnnotation, annotations, approveVersion, requestChanges, markInReview, markWaitingForReview, uploadNewVersion, currentUser, saveFileToApp, rehydrateAsset, deleteProject, warmupConnection } = useAXProof();
  
  const project = getProject(id || '');
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [isRehydrating, setIsRehydrating] = useState(false);
  const [rehydrationError, setRehydrationError] = useState<string | null>(null);
  
  // Player State
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);

  // Multi-file / ZIP State
  const [activeFile, setActiveFile] = useState<AssetFile | null>(null);

  // Tool State
  const [tool, setTool] = useState<AnnotationType | 'INTERACT'>('INTERACT');
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [showLiveOverlay, setShowLiveOverlay] = useState(true);

  // Modal State
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // URL Update Modal State
  const [isUrlUpdateOpen, setIsUrlUpdateOpen] = useState(false);
  const [newUrlInput, setNewUrlInput] = useState('');
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<ReviewCanvasHandle>(null);

  // New Annotation State
  const [tempAnnotation, setTempAnnotation] = useState<{
    x: number, y: number, timestamp?: number, type: AnnotationType, width?: number, height?: number
  } | null>(null);

  useEffect(() => {
    if (project) {
        if (project.currentVersionId !== currentVersionId) {
             setCurrentVersionId(project.currentVersionId);
        }
    }
  }, [project, currentVersionId]);

  // Rehydrate ZIP assets on demand
  useEffect(() => {
    if (!project || !currentVersionId) return;
    const v = project.versions.find(ver => ver.id === currentVersionId);
    if (!v) return;

    // Check if it's a ZIP that needs rehydration
    // We consider it a ZIP if it has files or if the URL points to /uploads/
    const isZip = v.url?.includes('/uploads/') || (v.files && v.files.length > 0);
    
    if (isZip && !isRehydrating && !rehydrationError) {
        const timer = setTimeout(() => {
            setIsRehydrating(true);
            setRehydrationError(null);
            rehydrateAsset(project.id, currentVersionId)
                .catch((err) => {
                    console.error("Rehydration failed:", err);
                    setRehydrationError(err.message || "Failed to rehydrate asset. Please try again.");
                })
                .finally(() => setIsRehydrating(false));
        }, 500); // Small delay to ensure session is ready
        return () => clearTimeout(timer);
    }
  }, [currentVersionId, project?.id, rehydrateAsset, rehydrationError, isRehydrating]);

  const handleRetryRehydration = async () => {
    if (!project || !currentVersionId) return;
    setRehydrationError(null);
    setIsRehydrating(true);
    try {
        // Aggressively warm up the connection before retrying
        await warmupConnection();
        await rehydrateAsset(project.id, currentVersionId);
    } catch (err: any) {
        console.error("Manual retry failed:", err);
        setRehydrationError(err.message || "Failed to rehydrate asset. Please try again.");
    } finally {
        setIsRehydrating(false);
    }
  };

  // Handle active file reset when version changes
  useEffect(() => {
    if (!currentVersionId || !project) return;
    const v = project.versions.find(ver => ver.id === currentVersionId);
    if (v && v.files && v.files.length > 0) {
        // Default to first file if not set or if current active file isn't in this version
        if (!activeFile || !v.files.find(f => f.path === activeFile.path)) {
            // Try to find index.html first for HTML zip uploads
            const indexHtml = v.files.find(f => f.name.toLowerCase() === 'index.html');
            setActiveFile(indexHtml || v.files[0]);
        }
    } else {
        setActiveFile(null);
    }
  }, [currentVersionId, project]);

  const handleDeleteProject = async () => {
    if (confirm(`Are you sure you want to delete "${project.name}"? This action cannot be undone.`)) {
        await deleteProject(project.id);
        window.location.href = '/';
    }
  };

  if (!project || !currentVersionId) return <div>Project not found</div>;

  const version = project.versions.find(v => v.id === currentVersionId);
  if (!version) return <div>Version not found</div>;
  
  const previousVersion = version.previousVersionId 
    ? project.versions.find(v => v.id === version.previousVersionId)
    : null;

  // Filter annotations based on active file if we are in a multi-file version
  const rawAnnotations = annotations[version.id] || [];
  const currentAnnotations = version.files && version.files.length > 0
    ? rawAnnotations.filter(a => a.filePath === activeFile?.path)
    : rawAnnotations;

  const isApproved = version.status === 'APPROVED';
  const isChangesRequired = version.status === 'CHANGES_REQUIRED';
  const isWaitingForReview = version.status === 'WAITING_FOR_REVIEW';
  const isLocked = isApproved || isChangesRequired;

  const currentAssetType = activeFile ? activeFile.type : version.assetType;
  const hasTimeline = currentAssetType === AssetType.VIDEO || currentAssetType === AssetType.GIF || currentAssetType === AssetType.HTML;

  const handleCanvasClick = (x: number, y: number, timestamp?: number, type: AnnotationType = AnnotationType.PIN, width?: number, height?: number) => {
    if (isLocked) return; // Prevent creation if locked

    // Clear active annotation when clicking on canvas
    setActiveAnnotationId(null);

    if (tempAnnotation) {
      setTempAnnotation(null); 
      return;
    }
    setTempAnnotation({ x, y, timestamp, type, width, height });
    setIsPlaying(false);
  };

  const handleNewCommentSubmit = (text: string, attachments: Attachment[]) => {
    if (!tempAnnotation || !currentUser) return;

    const newAnnotation: Annotation = {
      id: Date.now().toString(),
      assetVersionId: version.id,
      pinNumber: currentAnnotations.length + 1,
      type: tempAnnotation.type,
      x: tempAnnotation.x,
      y: tempAnnotation.y,
      width: tempAnnotation.width,
      height: tempAnnotation.height,
      timestamp: tempAnnotation.timestamp,
      text,
      authorId: currentUser.id,
      createdAt: new Date().toISOString(),
      status: AnnotationStatus.OPEN,
      replies: [],
      filePath: activeFile?.path, // Save specific file path for ZIPs
      attachments
    };

    addAnnotation(newAnnotation);
    setTempAnnotation(null);
  };

  const handleAnnotationClick = (id: string) => {
    setActiveAnnotationId(id);
    const ann = currentAnnotations.find(a => a.id === id);
    if (ann?.timestamp !== undefined) {
      setCurrentTime(ann.timestamp);
      setIsPlaying(false);
    }
  };

  const handleApprove = () => {
    approveVersion(project.id, version.id);
    setIsSubmitModalOpen(false);
  };

  const handleRequestChanges = () => {
    requestChanges(project.id, version.id);
    setIsSubmitModalOpen(false);
  };

  const handleMarkInReview = () => {
    markInReview(project.id, version.id);
    setIsSubmitModalOpen(false);
  };

  const handleMarkWaitingForReview = () => {
    markWaitingForReview(project.id, version.id);
    setIsSubmitModalOpen(false);
  };

  const handleSaveToApp = async () => {
    try {
        const blob = await db.getAsset(version.id);
        if (blob) {
            await saveFileToApp(blob, version.fileName || `${project.name}_v${version.versionNumber}`);
            alert('File saved to your library!');
        } else {
            // If it's a remote URL or not in DB, fetch it
            const response = await fetch(version.url, { credentials: 'include' });
            const remoteBlob = await response.blob();
            await saveFileToApp(remoteBlob, version.fileName || `${project.name}_v${version.versionNumber}`);
            alert('File saved to your library!');
        }
    } catch (e) {
        console.error("Save failed", e);
        alert("Failed to save file to app.");
    }
  };

  const handleExport = async (saveToApp: boolean = false) => {
    if (!canvasRef.current) return;
    setIsExporting(true);
    setIsPlaying(false);

    try {
        const doc = new jsPDF();
        let y = 20;

        // Title
        doc.setFontSize(20);
        doc.text(project.name, 10, y);
        y += 10;
        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(`Version: v${version.versionNumber} | Status: ${version.status.replace('_', ' ')}`, 10, y);
        y += 8;
        doc.text(`Export Date: ${new Date().toLocaleDateString()}`, 10, y);
        y += 15;
        doc.line(10, y, 200, y);
        y += 10;

        // Save original file to restore later
        const originalFile = activeFile;

        // Capture logic
        // Use ALL annotations for the project to ensure comprehensive report
        const allAnns = [...rawAnnotations].sort((a,b) => (a.pinNumber - b.pinNumber));

        for (const ann of allAnns) {
            // If multi-file, we might need to switch file to capture snapshot
            if (ann.filePath && ann.filePath !== activeFile?.path) {
                const file = version.files?.find(f => f.path === ann.filePath);
                if (file) {
                    setActiveFile(file);
                    // Wait for rehydration to start and then finish
                    await new Promise(resolve => setTimeout(resolve, 200));
                    let waitCount = 0;
                    while (isRehydrating && waitCount < 50) { // Max 5s wait
                        await new Promise(resolve => setTimeout(resolve, 100));
                        waitCount++;
                    }
                    // Give it a bit more time to render
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            // Check if we need new page
            if (y > 250) {
                doc.addPage();
                y = 20;
            }

            // Annotation Header
            doc.setFontSize(14);
            doc.setTextColor(0);
            doc.text(`Observation #${ann.pinNumber}`, 10, y);
            
            // Status Badge text
            doc.setFontSize(10);
            const statusColor = ann.status === 'RESOLVED' ? [0, 150, 0] : [200, 0, 0];
            doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
            doc.text(`[${ann.status}]`, 150, y);
            doc.setTextColor(0); // Reset

            y += 8;

            // Meta Info
            doc.setFontSize(10);
            doc.setTextColor(100);
            let meta = `Author: ${ann.authorId === currentUser?.id ? 'You' : 'Reviewer'} | Date: ${new Date(ann.createdAt).toLocaleDateString()}`;
            if (ann.timestamp !== undefined) {
                meta += ` | Time: ${formatTime(ann.timestamp)}`;
            }
            doc.text(meta, 10, y);
            y += 6;

            // Comment
            doc.setFontSize(12);
            doc.setTextColor(0);
            // Wrap text
            const splitText = doc.splitTextToSize(ann.text, 180);
            doc.text(splitText, 10, y);
            y += (splitText.length * 5) + 5;

            // Snapshot
            if (canvasRef.current) {
                // Show loading state for video capture maybe?
                const dataUrl = await canvasRef.current.captureSnapshot(ann);
                if (dataUrl) {
                    // Fit image into say 100x60 box
                    const imgProps = doc.getImageProperties(dataUrl);
                    const pdfWidth = 100;
                    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                    
                    // Check page break for image
                    if (y + pdfHeight > 270) {
                         doc.addPage();
                         y = 20;
                    }

                    doc.addImage(dataUrl, 'JPEG', 10, y, pdfWidth, pdfHeight);
                    // Draw box around image
                    doc.setDrawColor(200);
                    doc.rect(10, y, pdfWidth, pdfHeight);
                    
                    y += pdfHeight + 10;
                }
            }

            // Replies
            if (ann.replies.length > 0) {
                doc.setFontSize(10);
                doc.setTextColor(50);
                doc.text("Replies:", 15, y);
                y += 5;
                ann.replies.forEach(rep => {
                     const repText = `- ${rep.text} (${new Date(rep.createdAt).toLocaleDateString()})`;
                     const splitRep = doc.splitTextToSize(repText, 170);
                     if (y + (splitRep.length * 4) > 270) {
                         doc.addPage();
                         y = 20;
                     }
                     doc.text(splitRep, 15, y);
                     y += (splitRep.length * 4) + 2;
                });
                y += 5;
            }

            // Divider
            doc.setDrawColor(230);
            doc.line(10, y, 200, y);
            y += 10;
        }

        // Return to original time if video/gif
        if (hasTimeline && canvasRef.current) {
            setCurrentTime(currentTime); 
        }

        // Restore original file
        if (originalFile && originalFile.path !== activeFile?.path) {
            setActiveFile(originalFile);
        }

        const fileName = `${project.name}_v${version.versionNumber}_report.pdf`;
        if (saveToApp) {
            const pdfBlob = doc.output('blob');
            await saveFileToApp(pdfBlob, fileName);
            alert('Report saved to your library!');
        } else {
            doc.save(fileName);
        }

    } catch (e) {
        console.error("Export failed", e);
        alert("Failed to generate PDF. See console for details.");
    } finally {
        setIsExporting(false);
    }
  };

  const handleUploadNewVersionFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const nextVersionNum = version.versionNumber + 1;
      
      const shouldConfirm = !isChangesRequired;
      
      if (!shouldConfirm || confirm(`Upload "${file.name}" as v${nextVersionNum}? \n\nThis will create a new version stack.`)) {
        try {
          await uploadNewVersion(project.id, file);
        } catch (error: any) {
          console.error(error);
          alert(`Error uploading new version: ${error.message || 'Unknown error'}`);
        }
      }
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleNewVersionClick = () => {
    // Check if current version is a live URL (not a blob)
    const isLiveUrl = version.assetType === AssetType.HTML && !version.url.startsWith('blob:');
    
    if (isLiveUrl) {
        setNewUrlInput(version.url); // Pre-fill
        setIsUrlUpdateOpen(true);
    } else {
        fileInputRef.current?.click();
    }
  };

  const submitUrlVersion = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newUrlInput) return;
      
      const nextVersionNum = version.versionNumber + 1;
      const shouldConfirm = !isChangesRequired;

      if (!shouldConfirm || confirm(`Update URL to "${newUrlInput}" as v${nextVersionNum}?`)) {
          try {
              await uploadNewVersion(project.id, newUrlInput);
              setIsUrlUpdateOpen(false);
          } catch (error: any) {
              console.error(error);
              alert(`Error updating URL version: ${error.message || 'Unknown error'}`);
          }
      }
  };

  const formatTime = (time: number) => {
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    // show 1 decimal for GIFs short loops? no, keep standard
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.25));
  const handleZoomReset = () => setZoom(1);

  const getFileIcon = (type: AssetType) => {
    switch (type) {
        case AssetType.VIDEO: return <Film className="w-4 h-4" />;
        case AssetType.GIF: return <ImageIcon className="w-4 h-4 text-purple-400" />;
        case AssetType.IMAGE: return <ImageIcon className="w-4 h-4" />;
        case AssetType.HTML: return <FileCode className="w-4 h-4" />;
        case AssetType.PDF: return <FileText className="w-4 h-4" />;
        default: return <FileText className="w-4 h-4" />;
    }
  };

  if (isCompareMode) {
      return (
          <CompareView
            projectVersions={project.versions}
            initialLeftVersionId={version.previousVersionId}
            initialRightVersionId={version.id}
            annotations={annotations}
            onClose={() => setIsCompareMode(false)}
          />
      );
  }

  // Check for Live URL indicator
  const isLiveUrl = version.assetType === AssetType.HTML && !version.url.startsWith('blob:');

  return (
    <div className="flex flex-col h-screen bg-background relative">
      {/* Loading Overlay for Export */}
      {isExporting && (
          <div className="absolute inset-0 z-[100] bg-background/70 backdrop-blur-sm flex flex-col items-center justify-center text-text-primary">
              <Loader2 className="w-12 h-12 animate-spin mb-4 text-brand-500" />
              <h3 className="text-xl font-bold">Generating PDF Report...</h3>
              <p className="text-text-secondary mt-2">Capturing screenshots and compiling data.</p>
              <p className="text-sm text-text-secondary mt-1">Please wait.</p>
          </div>
      )}

      {/* Top Bar */}
      <div className="h-16 bg-surface border-b border-border-color flex items-center justify-between px-4 shrink-0 z-10">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-text-secondary hover:text-text-primary">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-semibold text-text-primary flex items-center gap-2">
                {project.name}
                {version.files && version.files.length > 0 && (
                  <span title="Package/ZIP" className="flex items-center">
                    <Package className="w-4 h-4 text-text-secondary" />
                  </span>
                )}
                {isLiveUrl && (
                  <span title="Live Website" className="flex items-center">
                    <Globe className="w-4 h-4 text-blue-500" />
                  </span>
                )}
                {isApproved && (
                    <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Approved v{version.versionNumber}
                    </span>
                )}
                {isChangesRequired && (
                    <span className="bg-brand-100 text-brand-700 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Changes Required v{version.versionNumber}
                    </span>
                )}
                {isWaitingForReview && (
                    <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Hourglass className="w-3 h-3" /> Waiting for Review v{version.versionNumber}
                    </span>
                )}
                {/* Show Revision Indicator for new versions */}
                {!isLocked && previousVersion && (
                     <span className="bg-brand-50 text-brand-600 text-xs px-2 py-0.5 rounded-full flex items-center gap-1 border border-brand-100">
                        <GitBranch className="w-3 h-3" /> Revision of v{previousVersion.versionNumber}
                     </span>
                )}
            </h1>
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <span>{project.clientName}</span>
              <span className="w-1 h-1 rounded-full bg-border-color" />
              <select 
                value={currentVersionId || ''}
                onChange={(e) => setCurrentVersionId(e.target.value)}
                className="bg-transparent border-none p-0 text-text-primary font-medium focus:ring-0 cursor-pointer"
              >
                {project.versions.map(v => (
                  <option key={v.id} value={v.id} className="bg-surface">
                    v{v.versionNumber} {v.status === 'APPROVED' ? '(Approved)' : v.status === 'CHANGES_REQUIRED' ? '(Changes Req.)' : v.status === 'WAITING_FOR_REVIEW' ? '(Waiting)' : '(In Review)'}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Toolbar - Center */}
        <div className="flex items-center gap-2">
            {!isLocked ? (
                <div className="flex items-center bg-background rounded-lg p-1 border border-border-color">
                    <button 
                    onClick={() => setTool('INTERACT')}
                    className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-colors ${tool === 'INTERACT' ? 'bg-surface shadow text-brand-600' : 'text-text-secondary hover:text-text-primary'}`}
                    title="Interact Tool"
                    >
                    <MousePointer2 className="w-4 h-4" />
                    </button>
                    <button 
                    onClick={() => setTool(AnnotationType.PIN)}
                    className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-colors ${tool === AnnotationType.PIN ? 'bg-surface shadow text-annotation' : 'text-text-secondary hover:text-text-primary'}`}
                    title="Pin Tool"
                    >
                    <div className="w-4 h-4 rounded-full border-2 border-current flex items-center justify-center text-[8px] font-bold">1</div>
                    </button>
                    <button 
                    onClick={() => setTool(AnnotationType.BOX)}
                    className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-colors ${tool === AnnotationType.BOX ? 'bg-surface shadow text-annotation' : 'text-text-secondary hover:text-text-primary'}`}
                    title="Box Tool"
                    >
                    <BoxSelect className="w-4 h-4" />
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-2 text-sm text-text-secondary bg-background px-3 py-1.5 rounded-md border border-border-color">
                    <Lock className="w-4 h-4" /> Locked
                </div>
            )}

            {/* Zoom Controls */}
            <div className="flex items-center bg-background rounded-lg p-1 border border-border-color">
                <button onClick={handleZoomOut} className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface transition-colors" title="Zoom Out">
                    <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono w-10 text-center text-text-primary">{Math.round(zoom * 100)}%</span>
                <button onClick={handleZoomIn} className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface transition-colors" title="Zoom In">
                    <ZoomIn className="w-4 h-4" />
                </button>
                <button onClick={handleZoomReset} className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface transition-colors" title="Reset Zoom">
                    <Maximize className="w-3 h-3" />
                </button>
            </div>

            {/* Annotation Toggle */}
            <div className="flex items-center bg-background rounded-lg p-1 border border-border-color">
                <button 
                  onClick={() => setShowAnnotations(!showAnnotations)} 
                  className={`p-1.5 rounded-md transition-colors ${showAnnotations ? 'bg-surface shadow text-brand-600' : 'text-text-secondary hover:text-text-primary hover:bg-surface'}`} 
                  title={showAnnotations ? "Hide Annotations" : "Show Annotations"}
                >
                    <Layers className="w-4 h-4" />
                </button>
            </div>
        </div>

        <div className="flex items-center gap-3">
           {/* Upload New Version Input - Hidden */}
           <input 
             type="file" 
             ref={fileInputRef} 
             className="hidden" 
             onChange={handleUploadNewVersionFile} 
             accept=".jpg,.jpeg,.png,.gif,.mp4,.mov,.pdf,.html,.zip"
           />
           
           {/* Only show 'New Version' ghost button if NOT Changes Required */}
           {!isChangesRequired && (
             <Button 
              variant="ghost" 
              size="sm" 
              className="text-text-secondary hover:text-brand-600"
              title="Upload a new version"
              onClick={handleNewVersionClick}
             >
               <Upload className="w-4 h-4 mr-2" /> New Version
             </Button>
           )}

            {/* Playback Controls */}
           {hasTimeline && (
              <div className="flex items-center gap-4 mr-4 bg-background rounded-full px-4 py-1">
                <button onClick={() => setIsPlaying(!isPlaying)} className="hover:text-brand-600 text-text-primary">
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <span className="text-xs font-mono w-24 text-center text-text-primary">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>
           )}

          <Button variant="outline" size="sm" onClick={() => setIsCompareMode(true)}>
            <Layers className="w-4 h-4 mr-2" /> Compare
          </Button>
          
          {isApproved ? (
             <div className="flex items-center gap-2">
                 <div className="flex flex-col items-end mr-2">
                    <span className="text-xs font-bold text-green-700 uppercase tracking-wide">Approved</span>
                    <span className="text-[10px] text-text-secondary">by {version.approvedBy || 'Admin'}</span>
                 </div>
                 <div className="relative group/export">
                     <Button variant="outline" size="sm" onClick={() => handleExport(false)} disabled={isExporting}>
                         {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
                         Export
                     </Button>
                     <div className="absolute right-0 top-full mt-1 hidden group-hover/export:block bg-surface rounded-lg shadow-xl border border-border-color z-50 p-1 w-48">
                         <button 
                             onClick={() => handleExport(true)}
                             className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-background rounded flex items-center gap-2"
                         >
                             <FileText className="w-3 h-3" /> Save Report to App
                         </button>
                         <button 
                             onClick={handleSaveToApp}
                             className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-background rounded flex items-center gap-2"
                         >
                             <Package className="w-3 h-3" /> Save Original to App
                         </button>
                     </div>
                 </div>
             </div>
          ) : isChangesRequired ? (
            <div className="flex items-center gap-3">
                 <div className="flex flex-col items-end mr-2">
                    <span className="text-xs font-bold text-brand-700 uppercase tracking-wide">Changes Required</span>
                    <span className="text-[10px] text-text-secondary">by {version.changesRequestedBy || 'Reviewer'}</span>
                 </div>
                 <Button variant="primary" size="sm" onClick={handleNewVersionClick}>
                    <Upload className="w-4 h-4 mr-2" /> Submit Revision
                 </Button>
            </div>
          ) : (
            <div className="flex gap-2">
                 <div className="relative group/export">
                     <Button variant="outline" size="sm" onClick={() => handleExport(false)} disabled={isExporting} title="Export Report">
                         {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                     </Button>
                     <div className="absolute right-0 top-full mt-1 hidden group-hover/export:block bg-surface rounded-lg shadow-xl border border-border-color z-50 p-1 w-48">
                         <button 
                             onClick={() => handleExport(true)}
                             className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-background rounded flex items-center gap-2"
                         >
                             <FileText className="w-3 h-3" /> Save Report to App
                         </button>
                         <button 
                             onClick={handleSaveToApp}
                             className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-background rounded flex items-center gap-2"
                         >
                             <Package className="w-3 h-3" /> Save Original to App
                         </button>
                     </div>
                 </div>
                <Button variant="primary" size="sm" onClick={() => setIsSubmitModalOpen(true)}>
                    <Send className="w-4 h-4 mr-2" /> Submit Review
                </Button>
            </div>
          )}

          {/* More Menu */}
          <div className="relative">
              <button 
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                className="p-2 text-text-secondary hover:text-text-primary hover:bg-background rounded-lg transition-colors"
                title="More Actions"
              >
                  <MoreVertical className="w-5 h-5" />
              </button>
              {isMoreMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsMoreMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 bg-surface rounded-lg shadow-xl border border-border-color z-50 p-1 w-56 animate-in fade-in slide-in-from-top-1">
                        <a 
                            href="https://drive.google.com/drive/folders/1RWqqHe9-_am2IgZwFCmnyAj_zP76aFko?usp=sharing" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-background rounded flex items-center gap-2"
                        >
                            <ExternalLink className="w-4 h-4 text-brand-600" /> Save to Google Drive
                        </a>
                        <div className="h-px bg-border-color my-1" />
                        <button 
                            onClick={handleDeleteProject}
                            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded flex items-center gap-2"
                        >
                            <Trash2 className="w-4 h-4" /> Delete Project
                        </button>
                    </div>
                  </>
              )}
          </div>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Files Sidebar (if ZIP/Multi-file) */}
        {version.files && version.files.length > 0 && (
            <div className="w-64 bg-background border-r border-border-color flex flex-col shrink-0">
                <div className="p-4 border-b border-border-color">
                    <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wide">Package Contents</h3>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {version.files.map((file, idx) => {
                         const fileAnns = rawAnnotations.filter(a => a.filePath === file.path).length;
                         return (
                            <button
                                key={idx}
                                onClick={() => { setActiveFile(file); setCurrentTime(0); }}
                                className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between hover:bg-surface border-b border-border-color transition-colors
                                    ${activeFile?.path === file.path ? 'bg-surface border-l-4 border-l-brand-500 text-brand-700 font-medium shadow-sm' : 'text-text-secondary border-l-4 border-l-transparent'}
                                `}
                            >
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <span className="shrink-0 text-text-secondary">{getFileIcon(file.type)}</span>
                                    <span className="truncate">{file.name}</span>
                                </div>
                                {fileAnns > 0 && (
                                    <span className="bg-background text-text-secondary text-xs px-1.5 rounded-full">{fileAnns}</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        )}

        {/* Canvas Area */}
        <div className="flex-1 relative flex flex-col">
          <div className="flex-1 relative bg-background overflow-hidden">
            {(isRehydrating || rehydrationError) && (
                <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center text-text-primary p-6 text-center">
                    {rehydrationError ? (
                        <>
                            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                            <h3 className="text-lg font-medium text-red-400">Rehydration Failed</h3>
                            <p className="text-text-secondary text-sm mt-2 max-w-md">{rehydrationError}</p>
                            <Button variant="primary" className="mt-6" onClick={handleRetryRehydration}>
                                <Upload className="w-4 h-4 mr-2" /> Retry Rehydration
                            </Button>
                        </>
                    ) : (
                        <>
                            <Loader2 className="w-12 h-12 text-brand-500 animate-spin mb-4" />
                            <h3 className="text-lg font-medium">Rehydrating Asset...</h3>
                            <p className="text-text-secondary text-sm mt-2">Preparing the creative for review. This may take a moment for larger packages.</p>
                        </>
                    )}
                </div>
            )}
            <ReviewCanvas
              ref={canvasRef}
              version={version}
              onCanvasClick={handleCanvasClick}
              currentTime={currentTime}
              onTimeUpdate={setCurrentTime}
              onDurationChange={setDuration}
              isPlaying={isPlaying}
              activeAnnotationId={activeAnnotationId}
              tool={isLocked ? 'INTERACT' : tool}
              readOnly={isLocked}
              zoom={zoom}
              showAnnotations={showAnnotations}
              activeAssetUrl={activeFile?.url}
              activeAssetType={activeFile?.type}
            >
              {/* Render Existing Annotations */}
              {currentAnnotations.map(ann => {
                 // If an annotation is active, only show that one and hide others
                 if (activeAnnotationId && activeAnnotationId !== ann.id) return null;

                 // Visibility logic for Video/GIF
                 const isVisible = !hasTimeline || (ann.timestamp !== undefined && Math.abs(currentTime - ann.timestamp) < 2);
                 if (!isVisible) return null;

                 const isActive = activeAnnotationId === ann.id;

                 if (ann.type === AnnotationType.BOX && ann.width && ann.height) {
                    return (
                        <div
                            key={ann.id}
                            onClick={(e) => { e.stopPropagation(); handleAnnotationClick(ann.id); }}
                            className={`annotation-pin absolute border-2 z-20 transition-colors cursor-pointer flex items-start justify-start pointer-events-auto
                              ${isActive ? 'border-annotation bg-annotation/50' : 'border-annotation/80 bg-annotation/20 hover:border-annotation'}
                            `}
                            style={{ 
                                left: `${ann.x}%`, 
                                top: `${ann.y}%`, 
                                width: `${ann.width}%`, 
                                height: `${ann.height}%` 
                            }}
                        >
                            <span className={`flex items-center justify-center w-6 h-6 -mt-3 -ml-3 rounded-full text-xs font-bold shadow-sm ${isActive ? 'bg-annotation text-white' : 'bg-surface text-annotation border border-annotation/20'}`}>
                                {ann.pinNumber}
                            </span>
                        </div>
                    );
                 }

                 // Default PIN
                 return (
                  <div
                    key={ann.id}
                    onClick={(e) => { e.stopPropagation(); handleAnnotationClick(ann.id); }}
                    className={`annotation-pin absolute transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full border-2 shadow-lg cursor-pointer transition-transform hover:scale-110 z-20 pointer-events-auto
                      ${isActive ? 'bg-annotation border-white text-white scale-110' : 'bg-surface border-annotation text-annotation'}
                    `}
                    style={{ left: `${ann.x}%`, top: `${ann.y}%` }}
                  >
                    <span className="font-bold text-xs">{ann.pinNumber}</span>
                  </div>
                );
              })}

              {/* Temp Annotation Creation Preview */}
              {tempAnnotation && (
                 <>
                   {tempAnnotation.type === AnnotationType.BOX && tempAnnotation.width && tempAnnotation.height ? (
                      <div
                        className="absolute border-2 border-annotation bg-annotation/50 z-30 animate-pulse"
                        style={{ 
                            left: `${tempAnnotation.x}%`, 
                            top: `${tempAnnotation.y}%`, 
                            width: `${tempAnnotation.width}%`, 
                            height: `${tempAnnotation.height}%` 
                        }}
                      >
                         <div className="absolute -top-3 -left-3 w-6 h-6 rounded-full bg-annotation text-white flex items-center justify-center text-xs font-bold">
                            {currentAnnotations.length + 1}
                         </div>
                      </div>
                   ) : (
                    <div
                        className="absolute transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-annotation text-white border-2 border-white shadow-lg z-30 animate-pulse"
                        style={{ left: `${tempAnnotation.x}%`, top: `${tempAnnotation.y}%` }}
                    >
                        <span className="font-bold text-xs">{currentAnnotations.length + 1}</span>
                    </div>
                   )}
                 </>
              )}
            </ReviewCanvas>
          </div>
          
          {/* Timeline Bar (Bottom of canvas) */}
          {hasTimeline && (
             <div className="h-12 bg-background border-t border-border-color flex items-center px-4 relative group">
                <div className="absolute top-0 left-0 right-0 h-1 z-10 pointer-events-none">
                    {currentAnnotations.map(ann => (
                      <div 
                        key={ann.id} 
                        className={`absolute top-0 w-1 h-3 ${ann.status === AnnotationStatus.RESOLVED ? 'bg-green-500' : 'bg-brand-500'}`}
                        style={{ left: `${(ann.timestamp || 0) / duration * 100}%` }} 
                      />
                    ))}
                </div>

                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  step="0.01"
                  value={currentTime}
                  onChange={(e) => {
                    const t = parseFloat(e.target.value);
                    setCurrentTime(t);
                    setIsPlaying(false);
                  }}
                  className="w-full h-1 bg-border-color rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-brand-500 [&::-webkit-slider-thumb]:rounded-full"
                />
             </div>
          )}
        </div>

        {/* Sidebar */}
        <AnnotationSidebar
          annotations={currentAnnotations}
          activeAnnotationId={activeAnnotationId}
          onAnnotationClick={handleAnnotationClick}
          onNewCommentSubmit={handleNewCommentSubmit}
          isAddingNew={!!tempAnnotation}
          onCancelNew={() => setTempAnnotation(null)}
          readOnly={isLocked}
          currentVersion={version}
        />
      </div>

      {/* Submit Review Modal */}
      {isSubmitModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-surface rounded-xl shadow-2xl p-6 w-full max-w-3xl border border-border-color">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-text-primary">Submit Review</h3>
                    <button onClick={() => setIsSubmitModalOpen(false)} className="text-text-secondary hover:text-text-primary">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <p className="text-text-secondary text-sm mb-6">
                    You are about to complete your review for <b>v{version.versionNumber}</b>. 
                    Select the outcome below.
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <button 
                        onClick={handleMarkWaitingForReview}
                        className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-transparent bg-purple-50 hover:bg-purple-100 hover:border-purple-200 text-purple-700 transition-all group"
                    >
                        <Hourglass className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="font-semibold text-sm text-center">Waiting for Review</span>
                        <span className="text-xs opacity-75 mt-1 text-center">Ready for review</span>
                    </button>
                    <button 
                        onClick={handleMarkInReview}
                        className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-transparent bg-blue-50 hover:bg-blue-100 hover:border-blue-200 text-blue-700 transition-all group"
                    >
                        <Clock className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="font-semibold text-sm text-center">In Review</span>
                        <span className="text-xs opacity-75 mt-1 text-center">Mark as actively reviewing</span>
                    </button>
                    <button 
                        onClick={handleRequestChanges}
                        className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-transparent bg-red-50 hover:bg-red-100 hover:border-red-200 text-red-700 transition-all group"
                    >
                        <AlertCircle className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="font-semibold text-sm text-center">Request Changes</span>
                        <span className="text-xs opacity-75 mt-1 text-center">Locks version & requires update</span>
                    </button>
                    <button 
                         onClick={handleApprove}
                         className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-transparent bg-green-50 hover:bg-green-100 hover:border-green-200 text-green-700 transition-all group"
                    >
                        <CheckCircle className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="font-semibold text-sm text-center">Approve Version</span>
                        <span className="text-xs opacity-75 mt-1 text-center">Mark as final & approved</span>
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* URL Update Modal */}
      {isUrlUpdateOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
             <div className="bg-surface rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
                <div className="p-4 border-b border-border-color flex justify-between items-center bg-background">
                     <h3 className="font-semibold text-text-primary">Update Website URL</h3>
                     <button onClick={() => setIsUrlUpdateOpen(false)} className="text-text-secondary hover:text-text-primary">
                        <X className="w-5 h-5" />
                     </button>
                </div>
                <form onSubmit={submitUrlVersion} className="p-6">
                    <div className="mb-4">
                        <label className="text-sm font-medium text-text-primary block mb-2">New Version URL</label>
                        <div className="relative">
                            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                            <input 
                                type="url" 
                                required
                                autoFocus
                                value={newUrlInput}
                                onChange={(e) => setNewUrlInput(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 border border-border-color rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-surface text-text-primary"
                                placeholder="https://example.com/v2"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3">
                         <Button type="button" variant="ghost" onClick={() => setIsUrlUpdateOpen(false)}>Cancel</Button>
                         <Button type="submit">Update Version</Button>
                    </div>
                </form>
             </div>
        </div>
      )}
    </div>
  );
};