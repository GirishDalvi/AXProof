import React, { useState, useRef } from 'react';
import { Annotation, AnnotationStatus, User, AssetVersion, Attachment } from '../types';
import { useAXProof } from '../context/ZflowContext';
import { Button } from './ui/Button';
import { MessageSquare, Check, Clock, Filter, Trash2, Send, Lock, History, Paperclip, File, X } from 'lucide-react';
import { Badge } from './ui/Badge';

interface AnnotationSidebarProps {
  annotations: Annotation[];
  activeAnnotationId: string | null;
  onAnnotationClick: (id: string) => void;
  onDelete?: (id: string) => void;
  onNewCommentSubmit: (text: string, attachments: Attachment[]) => void;
  isAddingNew: boolean;
  onCancelNew: () => void;
  readOnly?: boolean;
  currentVersion?: AssetVersion;
  className?: string;
}

export const AnnotationSidebar: React.FC<AnnotationSidebarProps> = ({
  annotations,
  activeAnnotationId,
  onAnnotationClick,
  onNewCommentSubmit,
  isAddingNew,
  onCancelNew,
  readOnly = false,
  currentVersion,
  className = "w-96 border-l border-border-color"
}) => {
  const { currentUser, addReply, updateAnnotationStatus, processAttachment } = useAXProof();
  const [filter, setFilter] = useState<'ALL' | 'OPEN'>('ALL');
  
  // New Comment State
  const [newCommentText, setNewCommentText] = useState('');
  const [newAttachments, setNewAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // Reply State
  const [replyText, setReplyText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredAnnotations = annotations.filter(a => 
    filter === 'ALL' ? true : a.status === AnnotationStatus.OPEN
  ).sort((a, b) => {
    // Sort by timestamp if exists, else creation date
    if (a.timestamp !== undefined && b.timestamp !== undefined) {
      return a.timestamp - b.timestamp;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const formatTime = (seconds?: number) => {
    if (seconds === undefined) return '';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isCarriedOver = (annotation: Annotation) => {
    if (!currentVersion) return false;
    // Simple check: if annotation was created before the version was uploaded, it's carried over.
    // (Assuming uploadDate is set when version is created)
    return new Date(annotation.createdAt) < new Date(currentVersion.uploadDate);
  };

  const handleNewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCommentText.trim() || newAttachments.length > 0) {
      onNewCommentSubmit(newCommentText, newAttachments);
      setNewCommentText('');
      setNewAttachments([]);
    }
  };

  const handleReplySubmit = (id: string) => {
    if (replyText.trim()) {
      addReply(id, replyText);
      setReplyText('');
      setReplyingTo(null);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          setIsUploading(true);
          try {
             const files = Array.from(e.target.files);
             for (const file of files) {
                 const attachment = await processAttachment(file);
                 setNewAttachments(prev => [...prev, attachment]);
             }
          } catch (err) {
              console.error("Upload failed", err);
              alert("Failed to attach file");
          } finally {
              setIsUploading(false);
              // Reset input
              if (fileInputRef.current) fileInputRef.current.value = '';
          }
      }
  };

  const removeAttachment = (index: number) => {
      setNewAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const renderAttachments = (attachments?: Attachment[]) => {
      if (!attachments || attachments.length === 0) return null;
      return (
          <div className="flex flex-wrap gap-2 mt-2">
              {attachments.map(att => (
                  <a 
                    key={att.id} 
                    href={att.url} 
                    download={att.name}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 bg-background border border-border-color rounded px-2 py-1 text-xs text-brand-600 hover:underline max-w-full truncate"
                  >
                      <Paperclip className="w-3 h-3" />
                      <span className="truncate max-w-[150px]">{att.name}</span>
                  </a>
              ))}
          </div>
      );
  };

  return (
    <div className={`flex flex-col h-full bg-surface shrink-0 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-border-color flex justify-between items-center bg-background">
        <h2 className="font-semibold text-text-primary flex items-center gap-2">
          <MessageSquare className="w-4 h-4" /> Comments ({annotations.length})
        </h2>
        <div className="flex gap-2">
           <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setFilter(filter === 'ALL' ? 'OPEN' : 'ALL')}
            className={filter === 'OPEN' ? 'bg-blue-50 text-blue-600' : ''}
          >
            <Filter className="w-4 h-4 mr-1" /> {filter === 'ALL' ? 'All' : 'Open'}
           </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Read Only Banner */}
        {readOnly && (
            <div className="bg-background p-3 rounded-md flex items-center justify-center gap-2 text-sm text-text-secondary border border-border-color">
                <Lock className="w-4 h-4" /> Comments are locked
            </div>
        )}

        {isAddingNew && !readOnly && (
          <div className="bg-brand-50 p-4 rounded-lg border border-brand-200 shadow-sm animate-in fade-in slide-in-from-top-2">
            <p className="text-xs font-bold text-brand-700 mb-2 uppercase tracking-wide">New Annotation</p>
            <form onSubmit={handleNewSubmit}>
              <textarea
                autoFocus
                className="w-full p-2 border border-border-color rounded text-sm focus:ring-2 focus:ring-brand-500 outline-none bg-surface text-text-primary placeholder-text-secondary"
                placeholder="Type your comment..."
                rows={3}
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
              />
              
              {/* Attachments List */}
              {newAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                      {newAttachments.map((att, idx) => (
                          <div key={idx} className="flex items-center gap-1 bg-surface border border-brand-200 rounded px-2 py-1 text-xs">
                              <Paperclip className="w-3 h-3 text-text-secondary" />
                              <span className="truncate max-w-[120px]">{att.name}</span>
                              <button type="button" onClick={() => removeAttachment(idx)} className="text-red-500 hover:text-red-700 ml-1">
                                  <X className="w-3 h-3" />
                              </button>
                          </div>
                      ))}
                  </div>
              )}

              <div className="flex justify-between items-center mt-2">
                <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-text-secondary hover:text-brand-600 p-1 rounded hover:bg-brand-100 transition-colors"
                    title="Attach File"
                >
                    <Paperclip className="w-4 h-4" />
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleFileSelect} 
                    multiple
                />

                <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={onCancelNew}>Cancel</Button>
                    <Button type="submit" size="sm" disabled={(!newCommentText.trim() && newAttachments.length === 0) || isUploading}>
                        {isUploading ? 'Uploading...' : 'Post'}
                    </Button>
                </div>
              </div>
            </form>
          </div>
        )}

        {filteredAnnotations.length === 0 && !isAddingNew && (
          <div className="text-center py-10 text-text-secondary">
            <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p>No comments yet.</p>
            {!readOnly && <p className="text-xs">Click on the asset to start reviewing.</p>}
          </div>
        )}

        {filteredAnnotations.map(ann => {
          const carriedOver = isCarriedOver(ann);
          const authorName = currentUser?.id === ann.authorId ? 'You' : (ann.authorId === 'u1' ? 'Alex Creative' : 'Reviewer');
          
          return (
          <div 
            key={ann.id} 
            id={`annotation-card-${ann.id}`}
            onClick={() => onAnnotationClick(ann.id)}
            className={`
              border rounded-lg p-3 transition-all cursor-pointer relative
              ${activeAnnotationId === ann.id ? 'border-annotation ring-1 ring-annotation bg-annotation/10' : 'border-border-color hover:border-annotation/50 hover:bg-background'}
              ${ann.status === AnnotationStatus.RESOLVED ? 'opacity-75' : ''}
              ${carriedOver ? 'bg-background/80' : ''}
            `}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-annotation text-white text-xs font-bold">
                  {ann.pinNumber}
                </span>
                <span className="font-medium text-sm text-text-primary">{authorName}</span>
                {carriedOver ? (
                   <span className="flex items-center gap-1 text-[10px] text-text-secondary bg-background px-1.5 py-0.5 rounded">
                     <History className="w-3 h-3" /> Previous Version
                   </span>
                ) : (
                   <span className="text-xs text-text-secondary">{new Date(ann.createdAt).toLocaleDateString()}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {ann.timestamp !== undefined && (
                  <span className="text-xs font-mono bg-brand-900 text-white px-1.5 py-0.5 rounded">
                    {formatTime(ann.timestamp)}
                  </span>
                )}
                <Badge status={ann.status} />
              </div>
            </div>

            <p className="text-text-primary text-sm leading-relaxed mb-1">{ann.text}</p>
            
            {renderAttachments(ann.attachments)}

            {/* Actions Line */}
            {!readOnly && (
            <div className="flex items-center justify-between border-t border-border-color pt-2 mt-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs h-7 px-2 text-text-secondary"
                  onClick={(e) => { e.stopPropagation(); setReplyingTo(replyingTo === ann.id ? null : ann.id); }}
                >
                  Reply
                </Button>
                
                {ann.status !== AnnotationStatus.RESOLVED ? (
                   <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={(e) => { e.stopPropagation(); updateAnnotationStatus(ann.id, AnnotationStatus.RESOLVED); }}
                  >
                    <Check className="w-3 h-3 mr-1" /> Resolve
                   </Button>
                ) : (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs h-7 px-2 text-text-secondary"
                    onClick={(e) => { e.stopPropagation(); updateAnnotationStatus(ann.id, AnnotationStatus.OPEN); }}
                  >
                    Re-open
                   </Button>
                )}
            </div>
            )}

            {/* Replies */}
            {ann.replies.length > 0 && (
              <div className="mt-3 space-y-2 pl-3 border-l-2 border-border-color">
                {ann.replies.map(reply => (
                  <div key={reply.id} className="text-sm">
                     <div className="flex justify-between items-baseline">
                        <span className="font-semibold text-xs text-text-primary">{reply.authorId === currentUser?.id ? 'You' : 'Reviewer'}</span>
                        <span className="text-[10px] text-text-secondary">{new Date(reply.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                     </div>
                     <p className="text-text-secondary">{reply.text}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Reply Input */}
            {replyingTo === ann.id && !readOnly && (
               <div className="mt-3" onClick={e => e.stopPropagation()}>
                 <div className="flex gap-2">
                   <input 
                    type="text" 
                    autoFocus
                    className="flex-1 text-sm border border-border-color rounded px-2 py-1 bg-surface text-text-primary placeholder-text-secondary"
                    placeholder="Write a reply..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleReplySubmit(ann.id)}
                   />
                   <Button size="sm" onClick={() => handleReplySubmit(ann.id)} className="px-2">
                     <Send className="w-3 h-3" />
                   </Button>
                 </div>
               </div>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
};