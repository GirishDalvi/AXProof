import React, { useState, useRef } from 'react';
import { X, Upload, FileType, Film, Image as ImageIcon, FileCode, FileText, Package, Globe, Link as LinkIcon, Plus } from 'lucide-react';
import { Button } from './ui/Button';
import { useAXProof } from '../context/ZflowContext';
import { AssetType, ProjectStatus, Project, AssetVersion } from '../types';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose }) => {
  const { createProject, processFile, processUrl } = useAXProof();
  
  // Form State
  const [activeTab, setActiveTab] = useState<'FILE' | 'URL'>('FILE');
  const [projectName, setProjectName] = useState('');
  const [clientName, setClientName] = useState('');
  
  // File State
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  
  // URL State
  const [urlInput, setUrlInput] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const resetForm = () => {
    setProjectName('');
    setClientName('');
    setFile(null);
    setUrlInput('');
    setIsProcessing(false);
    setActiveTab('FILE');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!projectName || !clientName) return;
    if (activeTab === 'FILE' && !file) return;
    if (activeTab === 'URL' && !urlInput) return;

    setIsProcessing(true);
    
    try {
        let resultUrl = '';
        let resultType = AssetType.IMAGE;
        let resultFiles = undefined;
        let fileSizeLabel = '';
        let fileNameLabel = '';

        if (activeTab === 'FILE' && file) {
            const result = await processFile(file);
            resultUrl = result.url;
            resultType = result.assetType;
            resultFiles = result.files;
            fileSizeLabel = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
            fileNameLabel = file.name;
        } else if (activeTab === 'URL') {
            const result = await processUrl(urlInput);
            resultUrl = result.url;
            resultType = result.assetType; // Typically HTML
            fileSizeLabel = 'External Link';
            fileNameLabel = resultUrl;
        }
        
        const versionId = `v-${Date.now()}`;

        const newVersion: AssetVersion = {
            id: versionId,
            versionNumber: 1,
            assetType: resultType,
            url: resultUrl,
            uploadDate: new Date().toISOString(),
            fileSize: fileSizeLabel,
            fileName: fileNameLabel,
            status: 'IN_REVIEW',
            files: resultFiles
        };

        const newProject: Project = {
            id: `p-${Date.now()}`,
            name: projectName,
            clientName,
            status: ProjectStatus.IN_REVIEW,
            thumbnail: resultType === AssetType.VIDEO ? '' : (resultType === AssetType.HTML ? '' : resultUrl), 
            versions: [newVersion],
            currentVersionId: versionId,
            createdAt: new Date().toISOString()
        };

        // Pass the raw file to createProject for persistence
        createProject(newProject, file || undefined);
        
        onClose();
        resetForm();
    } catch (error: any) {
        console.error(error);
        alert(`Error creating project: ${error.message || 'Unknown error'}`);
    } finally {
        setIsProcessing(false);
    }
  };

  const getFileIcon = (file: File) => {
    if (file.name.endsWith('.zip')) return <Package className="w-8 h-8 text-yellow-500" />;
    
    if (file.type.startsWith('video/')) return <Film className="w-8 h-8 text-purple-500" />;
    if (file.type.startsWith('image/')) return <ImageIcon className="w-8 h-8 text-blue-500" />;
    if (file.type === 'text/html' || file.name.endsWith('.html')) return <FileCode className="w-8 h-8 text-brand-500" />;
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) return <FileText className="w-8 h-8 text-red-500" />;
    
    return <FileType className="w-8 h-8 text-text-secondary" />;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-surface rounded-[2rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-300 border border-border-color">
        <div className="flex justify-between items-center p-8 border-b border-border-color bg-brand-50/30 dark:bg-brand-500/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-brand-500 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-500/20">
                <Plus className="w-6 h-6 text-white" />
            </div>
            <div>
                <h2 className="text-2xl font-black text-text-primary tracking-tight">New Project</h2>
                <p className="text-xs text-text-secondary opacity-60">Create a new review project to get started.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-text-secondary hover:text-text-primary hover:bg-background rounded-xl transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex p-2 bg-background/50 mx-8 mt-8 rounded-2xl border border-border-color">
            <button 
                onClick={() => setActiveTab('FILE')}
                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'FILE' ? 'bg-surface text-brand-600 shadow-md ring-1 ring-black/5 dark:ring-white/5' : 'text-text-secondary hover:text-text-primary'}`}
            >
                <Upload className="w-4 h-4 inline-block mr-2" /> Upload File
            </button>
            <button 
                onClick={() => setActiveTab('URL')}
                className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'URL' ? 'bg-surface text-brand-600 shadow-md ring-1 ring-black/5 dark:ring-white/5' : 'text-text-secondary hover:text-text-primary'}`}
            >
                <Globe className="w-4 h-4 inline-block mr-2" /> Live Website
            </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-60 ml-1">Project Name</label>
                <input 
                type="text" 
                required
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-4 py-3.5 border border-border-color rounded-2xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none bg-background/50 text-text-primary placeholder-text-secondary/30 transition-all font-medium"
                placeholder="e.g., Q1 Campaign"
                />
            </div>

            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-60 ml-1">Client Name</label>
                <input 
                type="text" 
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-4 py-3.5 border border-border-color rounded-2xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none bg-background/50 text-text-primary placeholder-text-secondary/30 transition-all font-medium"
                placeholder="e.g., Acme Corp"
                />
            </div>
          </div>

          {activeTab === 'FILE' ? (
              <div className="space-y-2 animate-in fade-in slide-in-from-left-4 duration-500">
                <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-60 ml-1">Asset File</label>
                <div 
                  className={`border-2 border-dashed rounded-3xl p-10 text-center transition-all cursor-pointer relative group ${
                    dragActive ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-500/10' : 'border-border-color hover:border-brand-400 hover:bg-brand-50/30 dark:hover:bg-brand-500/5'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    className="hidden" 
                    accept=".jpg,.jpeg,.png,.gif,.mp4,.mov,.pdf,.html,.zip"
                    onChange={handleChange}
                  />
                  
                  {file ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-brand-50 dark:bg-brand-500/10 rounded-2xl flex items-center justify-center text-brand-600 shadow-sm ring-1 ring-black/5 dark:ring-white/5">
                        {getFileIcon(file)}
                      </div>
                      <div className="space-y-1">
                        <p className="text-base font-bold text-text-primary">{file.name}</p>
                        <p className="text-xs font-mono text-text-secondary opacity-60">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setFile(null); }}
                        className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors mt-2 bg-red-50 dark:bg-red-900/20 px-4 py-1.5 rounded-full"
                      >
                        Remove File
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4 text-text-secondary">
                      <div className="w-16 h-16 bg-background rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                        <Upload className="w-8 h-8 opacity-40" />
                      </div>
                      <div>
                        <p className="text-base font-bold text-text-primary">Click to upload or drag and drop</p>
                        <p className="text-xs opacity-50 mt-1">MP4, JPG, PNG, PDF, HTML, ZIP</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
          ) : (
              <div className="space-y-2 animate-in fade-in slide-in-from-right-4 duration-500">
                <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-60 ml-1">Website URL</label>
                <div className="relative">
                    <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary opacity-40" />
                    <input 
                        type="url" 
                        required={activeTab === 'URL'}
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 border border-border-color rounded-2xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none bg-background/50 text-text-primary placeholder-text-secondary/30 transition-all font-medium"
                        placeholder="https://example.com"
                    />
                </div>
                <div className="flex items-start gap-2 mt-3 ml-1">
                    <Globe className="w-3.5 h-3.5 text-text-secondary opacity-40 mt-0.5" />
                    <p className="text-[10px] font-medium text-text-secondary opacity-50 leading-relaxed">
                        Enter a public URL to review. Note: Some sites (like Google, GitHub) may block embedding.
                    </p>
                </div>
              </div>
          )}

          <div className="pt-6 flex justify-end gap-4">
            <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl px-8 h-12">Cancel</Button>
            <Button 
                type="submit" 
                className="rounded-xl px-10 h-12 shadow-lg shadow-brand-500/20"
                disabled={(!file && activeTab === 'FILE') || (!urlInput && activeTab === 'URL') || !projectName || !clientName || isProcessing}
            >
                {isProcessing ? (
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Processing...</span>
                    </div>
                ) : 'Create Project'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};