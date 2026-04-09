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
    <div className={`flex flex-col h-full bg-surface shrink-0 transition-all duration-300 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-border-color flex justify-between items-center bg-surface/50 backdrop-blur-md sticky top-0 z-10">
        <h2 className="text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] flex items-center gap-3 opacity-70">
          <MessageSquare className="w-4 h-4 text-brand-500" /> Comments ({annotations.length})
        </h2>
        <div className="flex gap-2">
           <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setFilter(filter === 'ALL' ? 'OPEN' : 'ALL')}
            className={`rounded-xl text-[10px] font-black uppercase tracking-widest ${filter === 'OPEN' ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400' : ''}`}
          >
            <Filter className="w-3.5 h-3.5 mr-2" /> {filter === 'ALL' ? 'All' : 'Open'}
           </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-background/30">
        {/* Read Only Banner */}
        {readOnly && (
            <div className="bg-brand-50/50 dark:bg-brand-500/5 p-4 rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest text-text-secondary border border-brand-100 dark:border-brand-500/10">
                <Lock className="w-3.5 h-3.5" /> Comments are locked
            </div>
        )}

        {isAddingNew && !readOnly && (
          <div className="bg-surface p-5 rounded-3xl border border-brand-200 dark:border-brand-500/20 shadow-xl shadow-brand-500/5 animate-in fade-in slide-in-from-top-4">
            <p className="text-[10px] font-black text-brand-600 dark:text-brand-400 mb-4 uppercase tracking-[0.2em]">New Annotation</p>
            <form onSubmit={handleNewSubmit} className="space-y-4">
              <textarea
                autoFocus
                className="w-full p-4 border border-border-color rounded-2xl text-sm focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none bg-background/50 text-text-primary placeholder-text-secondary/40 transition-all min-h-[100px]"
                placeholder="Type your comment..."
                rows={3}
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
              />
              
              {/* Attachments List */}
              {newAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                      {newAttachments.map((att, idx) => (
                          <div key={idx} className="flex items-center gap-2 bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20 rounded-xl px-3 py-1.5 text-[10px] font-bold">
                              <Paperclip className="w-3 h-3 text-brand-500" />
                              <span className="truncate max-w-[120px]">{att.name}</span>
                              <button type="button" onClick={() => removeAttachment(idx)} className="text-red-500 hover:text-red-700 ml-1 transition-colors">
                                  <X className="w-3.5 h-3.5" />
                              </button>
                          </div>
                      ))}
                  </div>
              )}

              <div className="flex justify-between items-center pt-2">
                <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-text-secondary hover:text-brand-500 p-2.5 rounded-xl hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-all"
                    title="Attach File"
                >
                    <Paperclip className="w-5 h-5" />
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleFileSelect} 
                    multiple
                />

                <div className="flex gap-3">
                    <Button type="button" variant="ghost" size="sm" onClick={onCancelNew} className="rounded-xl font-bold uppercase tracking-wider text-[10px]">Cancel</Button>
                    <Button type="submit" size="sm" disabled={(!newCommentText.trim() && newAttachments.length === 0) || isUploading} className="rounded-xl font-bold uppercase tracking-wider text-[10px] px-6">
                        {isUploading ? 'Uploading...' : 'Post'}
                    </Button>
                </div>
              </div>
            </form>
          </div>
        )}

        {filteredAnnotations.length === 0 && !isAddingNew && (
          <div className="text-center py-20 text-text-secondary">
            <div className="w-20 h-20 bg-brand-50 dark:bg-brand-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <MessageSquare className="w-10 h-10 text-brand-200 dark:text-brand-500/30" />
            </div>
            <p className="text-lg font-bold text-text-primary">No comments yet</p>
            {!readOnly && <p className="text-sm opacity-60 mt-1">Click on the asset to start reviewing.</p>}
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
              rounded-3xl p-5 transition-all duration-300 cursor-pointer relative border
              ${activeAnnotationId === ann.id ? 'border-brand-500 bg-brand-500/5 shadow-lg shadow-brand-500/5 ring-1 ring-brand-500/20' : 'border-border-color hover:border-brand-500/30 hover:bg-surface hover:shadow-md'}
              ${ann.status === AnnotationStatus.RESOLVED ? 'opacity-60 grayscale-[0.5]' : ''}
              ${carriedOver ? 'bg-background/40' : 'bg-surface'}
            `}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-brand-500 text-white text-[10px] font-black shadow-lg shadow-brand-500/20">
                  {ann.pinNumber}
                </span>
                <div className="flex flex-col">
                    <span className="font-bold text-sm text-text-primary">{authorName}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                        {carriedOver ? (
                            <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-text-secondary opacity-60">
                                <History className="w-3 h-3" /> Previous
                            </span>
                        ) : (
                            <span className="text-[9px] font-black uppercase tracking-widest text-text-secondary opacity-60">{new Date(ann.createdAt).toLocaleDateString()}</span>
                        )}
                    </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {ann.timestamp !== undefined && (
                  <span className="text-[10px] font-black font-mono bg-text-primary text-background px-2 py-0.5 rounded-lg">
                    {formatTime(ann.timestamp)}
                  </span>
                )}
                <Badge status={ann.status} />
              </div>
            </div>

            <p className="text-text-primary text-sm leading-relaxed mb-4 font-medium">{ann.text}</p>
            
            {renderAttachments(ann.attachments)}

            {/* Actions Line */}
            {!readOnly && (
            <div className="flex items-center justify-between border-t border-border-color/50 pt-4 mt-4">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-[10px] font-black uppercase tracking-widest h-8 px-4 rounded-xl text-text-secondary hover:bg-brand-50 dark:hover:bg-brand-500/10"
                  onClick={(e) => { e.stopPropagation(); setReplyingTo(replyingTo === ann.id ? null : ann.id); }}
                >
                  Reply
                </Button>
                
                {ann.status !== AnnotationStatus.RESOLVED ? (
                   <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-[10px] font-black uppercase tracking-widest h-8 px-4 rounded-xl text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                    onClick={(e) => { e.stopPropagation(); updateAnnotationStatus(ann.id, AnnotationStatus.RESOLVED); }}
                  >
                    <Check className="w-3.5 h-3.5 mr-2" /> Resolve
                   </Button>
                ) : (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-[10px] font-black uppercase tracking-widest h-8 px-4 rounded-xl text-text-secondary hover:bg-brand-50 dark:hover:bg-brand-500/10"
                    onClick={(e) => { e.stopPropagation(); updateAnnotationStatus(ann.id, AnnotationStatus.OPEN); }}
                  >
                    Re-open
                   </Button>
                )}
            </div>
            )}

            {/* Replies */}
            {ann.replies.length > 0 && (
              <div className="mt-4 space-y-3 pl-4 border-l-2 border-brand-500/20">
                {ann.replies.map(reply => (
                  <div key={reply.id} className="text-sm">
                     <div className="flex justify-between items-baseline mb-1">
                        <span className="font-bold text-xs text-text-primary">{reply.authorId === currentUser?.id ? 'You' : 'Reviewer'}</span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-text-secondary opacity-50">{new Date(reply.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                     </div>
                     <p className="text-text-secondary font-medium text-xs leading-relaxed">{reply.text}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Reply Input */}
            {replyingTo === ann.id && !readOnly && (
               <div className="mt-4 animate-in fade-in slide-in-from-top-2" onClick={e => e.stopPropagation()}>
                 <div className="flex gap-2">
                   <input 
                    type="text" 
                    autoFocus
                    className="flex-1 text-xs border border-border-color rounded-xl px-4 py-2 bg-background/50 text-text-primary placeholder-text-secondary/40 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all"
                    placeholder="Write a reply..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleReplySubmit(ann.id)}
                   />
                   <Button size="sm" onClick={() => handleReplySubmit(ann.id)} className="px-3 rounded-xl">
                     <Send className="w-3.5 h-3.5" />
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