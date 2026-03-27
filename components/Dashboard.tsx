import React, { useState, useRef, useEffect } from 'react';
import { useAXProof } from '../context/ZflowContext';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Clock, CheckCircle, AlertCircle, Plus, Search, FileVideo, FileImage, FileCode, Folder, FileText, ChevronDown, MoreVertical, Edit2, Trash2, FolderInput, FolderOpen, LayoutGrid, List, LogOut, Sun, Moon, FileDown, Globe } from 'lucide-react';
import { Link } from 'react-router-dom';
import { UploadModal } from './UploadModal';
import { AssetType, ProjectStatus } from '../types';

const RepairButton: React.FC = () => {
  const { warmupConnection } = useAXProof();
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');

  const handleRepair = async () => {
    setIsRepairing(true);
    setRepairStatus('IDLE');
    try {
      await warmupConnection();
      setRepairStatus('SUCCESS');
      setTimeout(() => setRepairStatus('IDLE'), 3000);
    } catch (e) {
      setRepairStatus('ERROR');
      setTimeout(() => setRepairStatus('IDLE'), 3000);
    } finally {
      setIsRepairing(false);
    }
  };

  return (
    <button 
      onClick={handleRepair}
      disabled={isRepairing}
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
        repairStatus === 'SUCCESS' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
        repairStatus === 'ERROR' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
        'text-text-secondary hover:bg-brand-50/50 dark:hover:bg-brand-900/10'
      }`}
      title="Fix 'Cookie check' or connection issues"
    >
      <div className={`${isRepairing ? 'animate-spin' : ''}`}>
        <AlertCircle className="w-4 h-4" />
      </div>
      <span>
        {isRepairing ? 'Repairing...' : 
         repairStatus === 'SUCCESS' ? 'Connection Fixed' : 
         repairStatus === 'ERROR' ? 'Repair Failed' : 'Repair Connection'}
      </span>
    </button>
  );
};

export const Dashboard: React.FC = () => {
  const { projects, folders, savedFiles, deleteSavedFile, currentUser, updateProjectStatus, createFolder, deleteFolder, deleteProject, renameProject, moveProject, logout, theme, toggleTheme } = useAXProof();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'PROJECTS' | 'FILES'>('PROJECTS');
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Project Actions State
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  // Modals State
  const [renameModal, setRenameModal] = useState<{ isOpen: boolean; projectId: string; currentName: string }>({ isOpen: false, projectId: '', currentName: '' });
  const [moveModal, setMoveModal] = useState<{ isOpen: boolean; projectId: string }>({ isOpen: false, projectId: '' });
  const [newFolderModal, setNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setActionMenuOpen(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter Projects
  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.clientName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFolder = activeFolderId ? p.folderId === activeFolderId : true;
    return matchesSearch && matchesFolder;
  });

  // Simple stats
  const inReview = projects.filter(p => p.status === 'IN_REVIEW').length;
  const approved = projects.filter(p => p.status === 'APPROVED').length;
  const changes = projects.filter(p => p.status === 'CHANGES_REQUIRED').length;

  const getIcon = (type: string) => {
    switch (type) {
      case AssetType.VIDEO: return <FileVideo className="w-5 h-5 text-purple-500" />;
      case AssetType.IMAGE: return <FileImage className="w-5 h-5 text-blue-500" />;
      case AssetType.HTML: return <FileCode className="w-5 h-5 text-orange-500" />;
      case AssetType.PDF: return <FileText className="w-5 h-5 text-red-500" />;
      default: return <Folder className="w-5 h-5 text-text-secondary" />;
    }
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      createFolder(newFolderName);
      setNewFolderName('');
      setNewFolderModal(false);
    }
  };

  const handleRenameProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (renameModal.currentName.trim()) {
      renameProject(renameModal.projectId, renameModal.currentName);
      setRenameModal({ ...renameModal, isOpen: false });
    }
  };

  const handleDeleteProject = (id: string) => {
    if (confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      deleteProject(id);
    }
  };

  const handleDeleteFolder = (id: string) => {
      if (confirm('Delete this folder? Projects inside will be moved to "All Projects".')) {
          deleteFolder(id);
          if (activeFolderId === id) setActiveFolderId(null);
      }
  };

  return (
    <div className="flex h-screen bg-background text-text-primary overflow-hidden transition-colors">
      
      {/* Sidebar */}
      <div className="w-64 bg-surface border-r border-border-color flex flex-col shrink-0 transition-colors">
        <div className="p-6">
             <div className="flex items-center gap-2 mb-8">
                 <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-xl">A</span>
                 </div>
                 <span className="font-bold text-xl text-text-primary tracking-tight">AXProof</span>
             </div>

             <Button className="w-full justify-start" onClick={() => setIsUploadOpen(true)}>
                <Plus className="w-4 h-4 mr-2" /> New Project
             </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 space-y-6">
            <div>
                <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 px-2">Library</h3>
                <button 
                    onClick={() => { setActiveTab('PROJECTS'); setActiveFolderId(null); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'PROJECTS' && activeFolderId === null ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'text-text-secondary hover:bg-brand-50/50 dark:hover:bg-brand-900/10'}`}
                >
                    <LayoutGrid className="w-4 h-4" /> All Projects
                </button>
                <button 
                    onClick={() => { setActiveTab('FILES'); setActiveFolderId(null); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'FILES' ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'text-text-secondary hover:bg-brand-50/50 dark:hover:bg-brand-900/10'}`}
                >
                    <FileText className="w-4 h-4" /> My Files
                </button>
            </div>

            <div>
                <div className="flex items-center justify-between px-2 mb-2">
                    <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Folders</h3>
                    <button onClick={() => setNewFolderModal(true)} className="text-text-secondary hover:text-text-primary">
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
                <div className="space-y-1">
                    {folders.map(folder => (
                        <div key={folder.id} className="group flex items-center justify-between pr-2 rounded-lg hover:bg-brand-50/50 dark:hover:bg-brand-900/10 transition-colors">
                            <button 
                                onClick={() => { setActiveTab('PROJECTS'); setActiveFolderId(folder.id); }}
                                className={`flex-1 flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeFolderId === folder.id ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' : 'text-text-secondary'}`}
                            >
                                <Folder className={`w-4 h-4 ${activeFolderId === folder.id ? 'fill-brand-200 dark:fill-brand-800 text-brand-500' : 'fill-brand-50 dark:fill-brand-900/20 text-text-secondary'}`} /> 
                                <span className="truncate">{folder.name}</span>
                            </button>
                            <button onClick={() => handleDeleteFolder(folder.id)} className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-red-500 transition-opacity p-1">
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                    {folders.length === 0 && (
                        <div className="px-3 py-2 text-sm text-text-secondary italic">No folders created</div>
                    )}
                </div>
            </div>
        </div>

        <div className="p-4 border-t border-border-color">
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                    <img src={currentUser.avatar} alt="" className="w-9 h-9 rounded-full bg-brand-50 dark:bg-brand-900/20" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{currentUser.name}</p>
                        <p className="text-xs text-text-secondary truncate">Workspace Admin</p>
                    </div>
                </div>
                <button 
                  onClick={logout} 
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-text-secondary hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Sign out"
                >
                    <LogOut className="w-4 h-4" />
                    <span>Sign out</span>
                </button>
                
                <div className="h-px bg-border-color my-1" />
                
                <RepairButton />
            </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                <h1 className="text-2xl font-bold text-text-primary">
                    {activeTab === 'FILES' ? 'My Files' : activeFolderId ? folders.find(f => f.id === activeFolderId)?.name : 'All Projects'}
                </h1>
                <p className="text-text-secondary mt-1">
                    {activeTab === 'FILES' ? `Manage your saved assets and reports` : activeFolderId ? `${filteredProjects.length} projects in folder` : `Overview of all creative assets`}
                </p>
                </div>

                <div className="flex flex-col items-end gap-4">
                  {/* Theme Toggle */}
                  <button 
                      onClick={toggleTheme}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-50 dark:bg-brand-900/30 text-text-primary hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors text-sm font-medium border border-border-color"
                  >
                      {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                      <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                  </button>
                
                  {/* Stats (only show on All Projects view for summary) */}
                  {activeTab === 'PROJECTS' && !activeFolderId && (
                      <div className="flex gap-4">
                          <div className="bg-surface px-4 py-2 rounded-lg border border-border-color shadow-sm flex items-center gap-3 transition-colors">
                              <div className="p-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-full"><Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" /></div>
                              <div>
                                  <p className="text-xs text-text-secondary uppercase font-bold">In Review</p>
                                  <p className="text-lg font-bold text-text-primary leading-none">{inReview}</p>
                              </div>
                          </div>
                          <div className="bg-surface px-4 py-2 rounded-lg border border-border-color shadow-sm flex items-center gap-3 transition-colors">
                              <div className="p-1.5 bg-orange-50 dark:bg-orange-900/30 rounded-full"><AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" /></div>
                              <div>
                                  <p className="text-xs text-text-secondary uppercase font-bold">Changes</p>
                                  <p className="text-lg font-bold text-text-primary leading-none">{changes}</p>
                              </div>
                          </div>
                          <div className="bg-surface px-4 py-2 rounded-lg border border-border-color shadow-sm flex items-center gap-3 transition-colors">
                              <div className="p-1.5 bg-green-50 dark:bg-green-900/30 rounded-full"><CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" /></div>
                              <div>
                                  <p className="text-xs text-text-secondary uppercase font-bold">Approved</p>
                                  <p className="text-lg font-bold text-text-primary leading-none">{approved}</p>
                              </div>
                          </div>
                      </div>
                  )}
                </div>
            </div>

            <UploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} />

            {activeTab === 'PROJECTS' ? (
                /* Projects List */
                <div className="bg-surface rounded-xl shadow-sm border border-border-color overflow-hidden min-h-[400px] transition-colors">
                    <div className="p-4 border-b border-border-color flex justify-between items-center gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                            <input 
                            type="text" 
                            placeholder="Search projects by name or client..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-border-color rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-background text-text-primary placeholder-text-secondary/50"
                            />
                        </div>
                        {/* Sort or other controls could go here */}
                    </div>
                    
                    <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-text-secondary">
                        <thead className="bg-brand-50/50 dark:bg-brand-900/10 text-text-secondary font-medium">
                        <tr>
                            <th className="px-6 py-3 w-[40%]">Project Name</th>
                            <th className="px-6 py-3">Client</th>
                            <th className="px-6 py-3">Version</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3 text-right">Action</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-border-color">
                        {filteredProjects.length === 0 ? (
                            <tr>
                            <td colSpan={5} className="px-6 py-12 text-center">
                                <div className="flex flex-col items-center justify-center text-text-secondary">
                                    <FolderOpen className="w-12 h-12 mb-3 text-brand-100 dark:text-brand-900/20" />
                                    <p className="text-base font-medium text-text-primary">No projects found</p>
                                    <p className="text-sm">Try adjusting your search or create a new project.</p>
                                    <Button className="mt-4" onClick={() => setIsUploadOpen(true)}>
                                        <Plus className="w-4 h-4 mr-2" /> Create Project
                                    </Button>
                                </div>
                            </td>
                            </tr>
                        ) : (
                            filteredProjects.map(project => {
                            const currentVersion = project.versions.find(v => v.id === project.currentVersionId);
                            return (
                                <tr key={project.id} className="hover:bg-brand-50/30 dark:hover:bg-brand-900/5 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                    {project.thumbnail ? (
                                        <img src={project.thumbnail} alt="" className="w-10 h-10 rounded object-cover bg-brand-50 dark:bg-brand-900/20 shadow-sm" />
                                    ) : (
                                        <div className="w-10 h-10 rounded bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center text-text-secondary">
                                        {currentVersion && getIcon(currentVersion.assetType)}
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <Link to={`/project/${project.id}`} className="font-medium text-text-primary hover:text-brand-600 truncate block">
                                            {project.name}
                                        </Link>
                                        <div className="flex items-center gap-1 text-xs text-text-secondary">
                                        {currentVersion && getIcon(currentVersion.assetType)}
                                        <span>{currentVersion?.assetType}</span>
                                        <span className="text-border-color">|</span>
                                        <span className="truncate max-w-[150px]">{currentVersion?.fileName || 'asset'}</span>
                                        </div>
                                    </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">{project.clientName}</td>
                                <td className="px-6 py-4">
                                    <span className="bg-brand-50 dark:bg-brand-900/30 px-2 py-1 rounded text-xs font-mono text-text-secondary">v{currentVersion?.versionNumber}</span>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
                                    <select
                                        value={project.status}
                                        onChange={(e) => updateProjectStatus(project.id, e.target.value as ProjectStatus)}
                                        className={`
                                            appearance-none pl-3 pr-8 py-1 rounded-full text-xs font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-500 transition-shadow dark:bg-opacity-20
                                            ${project.status === ProjectStatus.APPROVED ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : ''}
                                            ${project.status === ProjectStatus.CHANGES_REQUIRED ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' : ''}
                                            ${project.status === ProjectStatus.IN_REVIEW ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' : ''}
                                            ${project.status === ProjectStatus.WAITING_FOR_REVIEW ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' : ''}
                                        `}
                                        >
                                        <option value={ProjectStatus.WAITING_FOR_REVIEW}>Waiting for Review</option>
                                        <option value={ProjectStatus.IN_REVIEW}>In Review</option>
                                        <option value={ProjectStatus.CHANGES_REQUIRED}>Changes Required</option>
                                        <option value={ProjectStatus.APPROVED}>Approved</option>
                                        </select>
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                            <ChevronDown className={`w-3 h-3 ${
                                            project.status === ProjectStatus.APPROVED ? 'text-green-800 dark:text-green-300' : 
                                            project.status === ProjectStatus.CHANGES_REQUIRED ? 'text-red-800 dark:text-red-300' : 
                                            project.status === ProjectStatus.WAITING_FOR_REVIEW ? 'text-purple-800 dark:text-purple-300' : 'text-blue-800 dark:text-blue-300'
                                            }`} />
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right relative">
                                    <div className="flex items-center justify-end gap-2">
                                        <Link to={`/project/${project.id}`}>
                                            <Button variant="outline" size="sm">Review</Button>
                                        </Link>
                                        
                                        <div className="relative">
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActionMenuOpen(actionMenuOpen === project.id ? null : project.id);
                                                }}
                                                className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-md transition-colors"
                                            >
                                                <MoreVertical className="w-4 h-4" />
                                            </button>
    
                                            {actionMenuOpen === project.id && (
                                                <div ref={actionMenuRef} className="absolute right-0 top-full mt-1 w-48 bg-surface rounded-lg shadow-xl border border-border-color z-20 animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
                                                    <button 
                                                        onClick={() => {
                                                            setRenameModal({ isOpen: true, projectId: project.id, currentName: project.name });
                                                            setActionMenuOpen(null);
                                                        }}
                                                        className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-brand-50/50 dark:hover:bg-brand-900/10 flex items-center gap-2"
                                                    >
                                                        <Edit2 className="w-4 h-4" /> Rename
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            setMoveModal({ isOpen: true, projectId: project.id });
                                                            setActionMenuOpen(null);
                                                        }}
                                                        className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-brand-50/50 dark:hover:bg-brand-900/10 flex items-center gap-2"
                                                    >
                                                        <FolderInput className="w-4 h-4" /> Move to Folder
                                                    </button>
                                                    <div className="h-px bg-border-color my-1" />
                                                    <button 
                                                        onClick={() => {
                                                            handleDeleteProject(project.id);
                                                            setActionMenuOpen(null);
                                                        }}
                                                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                                    >
                                                        <Trash2 className="w-4 h-4" /> Delete
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                </tr>
                            );
                            })
                        )}
                        </tbody>
                    </table>
                    </div>
                </div>
            ) : (
                /* Files List */
                <div className="space-y-6">
                    {/* Google Drive Temporary Storage Info */}
                    <div className="bg-brand-50/50 dark:bg-brand-900/10 border border-brand-200 dark:border-brand-800 rounded-xl p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white dark:bg-surface rounded-lg flex items-center justify-center shadow-sm">
                                <Globe className="w-6 h-6 text-brand-600" />
                            </div>
                            <div>
                                <h4 className="font-bold text-text-primary">Temporary Google Drive Storage</h4>
                                <p className="text-sm text-text-secondary">Use this shared folder to temporarily save and share your review files.</p>
                            </div>
                        </div>
                        <a 
                            href="https://drive.google.com/drive/folders/1RWqqHe9-_am2IgZwFCmnyAj_zP76aFko?usp=sharing" 
                            target="_blank" 
                            rel="noopener noreferrer"
                        >
                            <Button variant="outline" className="bg-white dark:bg-surface">
                                <FolderOpen className="w-4 h-4 mr-2" /> Open Drive Folder
                            </Button>
                        </a>
                    </div>

                    <div className="bg-surface rounded-xl shadow-sm border border-border-color overflow-hidden min-h-[400px] transition-colors">
                    <div className="p-4 border-b border-border-color flex justify-between items-center gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                            <input 
                                type="text" 
                                placeholder="Search files..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 border border-border-color rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-background text-text-primary placeholder-text-secondary/50"
                            />
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-text-secondary">
                            <thead className="bg-brand-50/50 dark:bg-brand-900/10 text-text-secondary font-medium">
                                <tr>
                                    <th className="px-6 py-3 w-[40%]">File Name</th>
                                    <th className="px-6 py-3">Type</th>
                                    <th className="px-6 py-3">Size</th>
                                    <th className="px-6 py-3">Saved On</th>
                                    <th className="px-6 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-color">
                                {savedFiles.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center justify-center text-text-secondary">
                                                <FileText className="w-12 h-12 mb-3 text-brand-100 dark:text-brand-900/20" />
                                                <p className="text-base font-medium text-text-primary">No saved files</p>
                                                <p className="text-sm">Save files from project reviews or attachments to see them here.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    savedFiles.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())).map(file => (
                                        <tr key={file.id} className="hover:bg-brand-50/30 dark:hover:bg-brand-900/5 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center text-text-secondary">
                                                        {getIcon(file.assetType)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-text-primary truncate">{file.name}</p>
                                                        <p className="text-xs text-text-secondary uppercase">{file.type}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">{file.assetType}</td>
                                            <td className="px-6 py-4">{(file.size / (1024 * 1024)).toFixed(2)} MB</td>
                                            <td className="px-6 py-4">{new Date(file.createdAt).toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <a href={file.url} download={file.name}>
                                                        <Button variant="outline" size="sm">
                                                            <FileDown className="w-4 h-4 mr-2" /> Download
                                                        </Button>
                                                    </a>
                                                    <button 
                                                        onClick={() => {
                                                            if (confirm('Are you sure you want to delete this saved file?')) {
                                                                deleteSavedFile(file.id);
                                                            }
                                                        }}
                                                        className="p-1.5 text-text-secondary hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* New Folder Modal */}
      {newFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
             <div className="bg-surface rounded-xl shadow-xl p-6 w-full max-w-sm animate-in zoom-in-95 border border-border-color">
                 <h3 className="text-lg font-bold mb-4 text-text-primary">Create New Folder</h3>
                 <form onSubmit={handleCreateFolder}>
                     <input 
                        autoFocus
                        type="text" 
                        placeholder="Folder Name"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        className="w-full px-3 py-2 border border-border-color rounded-lg mb-4 focus:ring-2 focus:ring-brand-500 outline-none bg-background text-text-primary"
                     />
                     <div className="flex justify-end gap-2">
                         <Button type="button" variant="ghost" onClick={() => setNewFolderModal(false)}>Cancel</Button>
                         <Button type="submit">Create</Button>
                     </div>
                 </form>
             </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
             <div className="bg-surface rounded-xl shadow-xl p-6 w-full max-w-sm animate-in zoom-in-95 border border-border-color">
                 <h3 className="text-lg font-bold mb-4 text-text-primary">Rename Project</h3>
                 <form onSubmit={handleRenameProject}>
                     <input 
                        autoFocus
                        type="text" 
                        value={renameModal.currentName}
                        onChange={(e) => setRenameModal({ ...renameModal, currentName: e.target.value })}
                        className="w-full px-3 py-2 border border-border-color rounded-lg mb-4 focus:ring-2 focus:ring-brand-500 outline-none bg-background text-text-primary"
                     />
                     <div className="flex justify-end gap-2">
                         <Button type="button" variant="ghost" onClick={() => setRenameModal({ ...renameModal, isOpen: false })}>Cancel</Button>
                         <Button type="submit">Save</Button>
                     </div>
                 </form>
             </div>
        </div>
      )}

      {/* Move Project Modal */}
      {moveModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
             <div className="bg-surface rounded-xl shadow-xl p-6 w-full max-w-sm animate-in zoom-in-95 border border-border-color">
                 <h3 className="text-lg font-bold mb-4 text-text-primary">Move Project</h3>
                 <div className="space-y-1 max-h-60 overflow-y-auto mb-4">
                     <button 
                        onClick={() => { moveProject(moveModal.projectId, undefined); setMoveModal({ ...moveModal, isOpen: false }); }}
                        className="w-full text-left px-3 py-2 rounded hover:bg-brand-50/50 dark:hover:bg-brand-900/10 flex items-center gap-2 text-text-primary"
                     >
                         <LayoutGrid className="w-4 h-4 text-text-secondary" /> All Projects (Root)
                     </button>
                     {folders.map(f => (
                         <button 
                            key={f.id}
                            onClick={() => { moveProject(moveModal.projectId, f.id); setMoveModal({ ...moveModal, isOpen: false }); }}
                            className="w-full text-left px-3 py-2 rounded hover:bg-brand-50/50 dark:hover:bg-brand-900/10 flex items-center gap-2 text-text-primary"
                         >
                             <Folder className="w-4 h-4 text-brand-500 fill-brand-100 dark:fill-brand-900/40" /> {f.name}
                         </button>
                     ))}
                 </div>
                 <div className="flex justify-end gap-2">
                     <Button type="button" variant="ghost" onClick={() => setMoveModal({ ...moveModal, isOpen: false })}>Cancel</Button>
                 </div>
             </div>
        </div>
      )}

    </div>
  );
};