import React, { useState, useRef } from 'react';
import { X, Upload, FileType, Film, Image as ImageIcon, FileCode, FileText, Package, Globe, Link as LinkIcon } from 'lucide-react';
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
    if (file.type === 'text/html' || file.name.endsWith('.html')) return <FileCode className="w-8 h-8 text-orange-500" />;
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) return <FileText className="w-8 h-8 text-red-500" />;
    
    return <FileType className="w-8 h-8 text-gray-500" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">New Project</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-gray-100">
            <button 
                onClick={() => setActiveTab('FILE')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'FILE' ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-50/50' : 'text-gray-500 hover:text-gray-700'}`}
            >
                <Upload className="w-4 h-4 inline-block mr-2" /> Upload File
            </button>
            <button 
                onClick={() => setActiveTab('URL')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'URL' ? 'text-brand-600 border-b-2 border-brand-600 bg-brand-50/50' : 'text-gray-500 hover:text-gray-700'}`}
            >
                <Globe className="w-4 h-4 inline-block mr-2" /> Live Website
            </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Project Name</label>
            <input 
              type="text" 
              required
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-gray-700 text-[#FFFFFF]"
              placeholder="e.g., Q1 Marketing Campaign"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Client Name</label>
            <input 
              type="text" 
              required
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-gray-700 text-[#FFFFFF]"
              placeholder="e.g., Acme Corp"
            />
          </div>

          {activeTab === 'FILE' ? (
              <div className="space-y-1 animate-in fade-in slide-in-from-left-4 duration-300">
                <label className="text-sm font-medium text-gray-700">Asset File</label>
                <div 
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                    dragActive ? 'border-brand-500 bg-brand-50' : 'border-gray-300 hover:border-brand-400 hover:bg-gray-50'
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
                    <div className="flex flex-col items-center gap-2">
                      {getFileIcon(file)}
                      <p className="text-sm font-medium text-gray-900">{file.name}</p>
                      <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setFile(null); }}
                        className="text-xs text-red-500 hover:underline mt-1"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-500">
                      <Upload className="w-8 h-8 text-gray-400" />
                      <p className="text-sm font-medium">Click to upload or drag and drop</p>
                      <p className="text-xs text-gray-400">MP4, JPG, PNG, PDF, HTML, ZIP</p>
                    </div>
                  )}
                </div>
              </div>
          ) : (
              <div className="space-y-1 animate-in fade-in slide-in-from-right-4 duration-300">
                <label className="text-sm font-medium text-gray-700">Website URL</label>
                <div className="relative">
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                        type="url" 
                        required={activeTab === 'URL'}
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-gray-700 text-[#FFFFFF]"
                        placeholder="https://example.com"
                    />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                    Enter a public URL to review. Note: Some sites (like Google, GitHub) may block embedding.
                </p>
              </div>
          )}

          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button 
                type="submit" 
                disabled={(!file && activeTab === 'FILE') || (!urlInput && activeTab === 'URL') || !projectName || !clientName || isProcessing}
            >
                {isProcessing ? 'Processing...' : 'Create Project'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};