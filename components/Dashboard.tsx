import React, { useState, useRef, useEffect } from 'react';
import { useAXProof } from '../context/ZflowContext';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Clock, CheckCircle, AlertCircle, Plus, Search, FileVideo, FileImage, FileCode, Folder, FileText, ChevronDown, MoreVertical, Edit2, Trash2, FolderInput, FolderOpen, LayoutGrid, List, LogOut, Sun, Moon, FileDown, Globe, FolderPlus, Move, Edit3 } from 'lucide-react';
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
      case AssetType.HTML: return <FileCode className="w-5 h-5 text-brand-500" />;
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
      <div className="w-72 bg-surface border-r border-border-color flex flex-col shrink-0 transition-all duration-300 ease-in-out">
        <div className="p-8">
             <div className="flex items-center gap-3 mb-10">
                 <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/20">
                    <span className="text-white font-bold text-2xl">A</span>
                 </div>
                 <span className="font-bold text-2xl text-text-primary tracking-tight">AXProof</span>
             </div>

             <Button className="w-full justify-center shadow-md hover:shadow-lg transition-all" onClick={() => setIsUploadOpen(true)}>
                <Plus className="w-5 h-5 mr-2" /> New Project
             </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 space-y-8">
            <div>
                <h3 className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em] mb-4 px-4 opacity-70">Library</h3>
                <div className="space-y-1">
                  <button 
                      onClick={() => { setActiveTab('PROJECTS'); setActiveFolderId(null); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${activeTab === 'PROJECTS' && activeFolderId === null ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 shadow-sm' : 'text-text-secondary hover:bg-brand-50/50 dark:hover:bg-brand-500/5 hover:text-text-primary'}`}
                  >
                      <LayoutGrid className="w-4 h-4" /> All Projects
                  </button>
                  <button 
                      onClick={() => { setActiveTab('FILES'); setActiveFolderId(null); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${activeTab === 'FILES' ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 shadow-sm' : 'text-text-secondary hover:bg-brand-50/50 dark:hover:bg-brand-500/5 hover:text-text-primary'}`}
                  >
                      <FileText className="w-4 h-4" /> My Files
                  </button>
                </div>
            </div>

            <div>
                <div className="flex items-center justify-between px-4 mb-4">
                    <h3 className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em] opacity-70">Folders</h3>
                    <button onClick={() => setNewFolderModal(true)} className="text-text-secondary hover:text-brand-500 transition-colors p-1 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-md">
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
                <div className="space-y-1">
                    {folders.map(folder => (
                        <div key={folder.id} className="group flex items-center justify-between pr-2 rounded-xl hover:bg-brand-50/50 dark:hover:bg-brand-500/5 transition-all duration-200">
                            <button 
                                onClick={() => { setActiveTab('PROJECTS'); setActiveFolderId(folder.id); }}
                                className={`flex-1 flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${activeFolderId === folder.id ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                            >
                                <Folder className={`w-4 h-4 ${activeFolderId === folder.id ? 'fill-brand-500/20 text-brand-500' : 'text-text-secondary group-hover:text-brand-400'}`} /> 
                                <span className="truncate">{folder.name}</span>
                            </button>
                            <button onClick={() => handleDeleteFolder(folder.id)} className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-red-500 transition-all p-1.5">
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))}
                    {folders.length === 0 && (
                        <div className="px-4 py-3 text-xs text-text-secondary italic opacity-60">No folders created</div>
                    )}
                </div>
            </div>
        </div>

        <div className="p-6 border-t border-border-color bg-surface/50 backdrop-blur-sm">
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-brand-50/50 dark:hover:bg-brand-500/5 transition-all cursor-pointer group">
                    <img src={currentUser.avatar} alt="" className="w-10 h-10 rounded-full bg-brand-50 dark:bg-brand-500/10 border-2 border-transparent group-hover:border-brand-500/30 transition-all" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-text-primary truncate">{currentUser.name}</p>
                        <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider opacity-70">Workspace Admin</p>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={logout} 
                    className="flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-text-secondary hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-100 dark:hover:border-red-900/30"
                    title="Sign out"
                  >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign out</span>
                  </button>
                  <RepairButton />
                </div>
            </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-background/50">
        <div className="p-10 max-w-7xl mx-auto space-y-10">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <h1 className="text-3xl font-extrabold text-text-primary tracking-tight">
                      {activeTab === 'FILES' ? 'My Files' : activeFolderId ? folders.find(f => f.id === activeFolderId)?.name : 'All Projects'}
                  </h1>
                  <p className="text-text-secondary text-sm font-medium opacity-80">
                      {activeTab === 'FILES' ? `Manage your saved assets and reports` : activeFolderId ? `${filteredProjects.length} projects in folder` : `Overview of all creative assets`}
                  </p>
                </div>

                <div className="flex items-center gap-6">
                  {/* Theme Toggle */}
                  <button 
                      onClick={toggleTheme}
                      className="relative flex items-center gap-2 p-1 rounded-full bg-surface border border-border-color shadow-sm hover:shadow-md transition-all duration-300"
                  >
                      <div className={`absolute inset-1 w-8 h-8 rounded-full bg-brand-500 transition-all duration-300 ${theme === 'dark' ? 'translate-x-full' : 'translate-x-0'}`} />
                      <div className={`relative z-10 w-8 h-8 flex items-center justify-center transition-colors duration-300 ${theme === 'light' ? 'text-white' : 'text-text-secondary'}`}>
                        <Sun className="w-4 h-4" />
                      </div>
                      <div className={`relative z-10 w-8 h-8 flex items-center justify-center transition-colors duration-300 ${theme === 'dark' ? 'text-white' : 'text-text-secondary'}`}>
                        <Moon className="w-4 h-4" />
                      </div>
                  </button>
                
                  {/* Stats (only show on All Projects view for summary) */}
                  {activeTab === 'PROJECTS' && !activeFolderId && (
                      <div className="flex gap-3">
                          <div className="bg-surface px-5 py-3 rounded-2xl border border-border-color shadow-sm flex items-center gap-4 transition-all hover:shadow-md hover:-translate-y-0.5">
                              <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-xl"><Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>
                              <div>
                                  <p className="text-[10px] text-text-secondary uppercase font-bold tracking-widest opacity-70">In Review</p>
                                  <p className="text-xl font-black text-text-primary leading-none mt-1">{inReview}</p>
                              </div>
                          </div>
                          <div className="bg-surface px-5 py-3 rounded-2xl border border-border-color shadow-sm flex items-center gap-4 transition-all hover:shadow-md hover:-translate-y-0.5">
                              <div className="p-2 bg-brand-50 dark:bg-brand-500/10 rounded-xl"><AlertCircle className="w-5 h-5 text-brand-600 dark:text-brand-400" /></div>
                              <div>
                                  <p className="text-[10px] text-text-secondary uppercase font-bold tracking-widest opacity-70">Changes</p>
                                  <p className="text-xl font-black text-text-primary leading-none mt-1">{changes}</p>
                              </div>
                          </div>
                          <div className="bg-surface px-5 py-3 rounded-2xl border border-border-color shadow-sm flex items-center gap-4 transition-all hover:shadow-md hover:-translate-y-0.5">
                              <div className="p-2 bg-green-50 dark:bg-green-500/10 rounded-xl"><CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" /></div>
                              <div>
                                  <p className="text-[10px] text-text-secondary uppercase font-bold tracking-widest opacity-70">Approved</p>
                                  <p className="text-xl font-black text-text-primary leading-none mt-1">{approved}</p>
                              </div>
                          </div>
                      </div>
                  )}
                </div>
            </div>

            <UploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} />

            {activeTab === 'PROJECTS' ? (
                /* Projects List */
                <div className="bg-surface rounded-3xl shadow-xl shadow-black/5 border border-border-color overflow-hidden min-h-[400px] transition-all duration-300">
                    <div className="p-6 border-b border-border-color flex justify-between items-center gap-6 bg-surface/50 backdrop-blur-md">
                        <div className="relative flex-1 max-w-md group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary group-focus-within:text-brand-500 transition-colors" />
                            <input 
                            type="text" 
                            placeholder="Search projects by name or client..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 py-2.5 border border-border-color rounded-2xl text-sm focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none bg-background/50 text-text-primary placeholder-text-secondary/40 transition-all"
                            />
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-text-secondary">
                        <thead className="bg-background/50 text-text-secondary font-bold text-[10px] uppercase tracking-widest">
                        <tr>
                            <th className="px-8 py-4 w-[40%]">Project Name</th>
                            <th className="px-8 py-4">Client</th>
                            <th className="px-8 py-4">Version</th>
                            <th className="px-8 py-4">Status</th>
                            <th className="px-8 py-4 text-right">Action</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-border-color/50">
                        {filteredProjects.length === 0 ? (
                            <tr>
                            <td colSpan={5} className="px-8 py-20 text-center">
                                <div className="flex flex-col items-center justify-center text-text-secondary">
                                    <div className="w-20 h-20 bg-brand-50 dark:bg-brand-500/10 rounded-full flex items-center justify-center mb-6">
                                      <FolderOpen className="w-10 h-10 text-brand-200 dark:text-brand-500/30" />
                                    </div>
                                    <p className="text-lg font-bold text-text-primary">No projects found</p>
                                    <p className="text-sm opacity-60 mt-1">Try adjusting your search or create a new project.</p>
                                    <Button className="mt-8" onClick={() => setIsUploadOpen(true)}>
                                        <Plus className="w-5 h-5 mr-2" /> Create Project
                                    </Button>
                                </div>
                            </td>
                            </tr>
                        ) : (
                            filteredProjects.map(project => {
                            const currentVersion = project.versions.find(v => v.id === project.currentVersionId);
                            return (
                                <tr key={project.id} className="hover:bg-brand-50/20 dark:hover:bg-brand-500/5 transition-all duration-200 group">
                                <td className="px-8 py-5">
                                    <div className="flex items-center gap-4">
                                    {project.thumbnail ? (
                                        <div className="relative">
                                          <img src={project.thumbnail} alt="" className="w-12 h-12 rounded-xl object-cover bg-brand-50 dark:bg-brand-500/10 shadow-sm group-hover:shadow-md transition-all" />
                                          <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-black/5 dark:ring-white/5" />
                                        </div>
                                    ) : (
                                        <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center text-brand-500 shadow-sm group-hover:shadow-md transition-all">
                                        {currentVersion && getIcon(currentVersion.assetType)}
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <Link to={`/project/${project.id}`} className="font-bold text-text-primary hover:text-brand-500 transition-colors truncate block text-base">
                                            {project.name}
                                        </Link>
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-text-secondary uppercase tracking-wider opacity-60 mt-0.5">
                                          <span className="flex items-center gap-1">
                                            {currentVersion && React.cloneElement(getIcon(currentVersion.assetType) as React.ReactElement, { className: 'w-3 h-3' })}
                                            {currentVersion?.assetType}
                                          </span>
                                          <span className="w-1 h-1 rounded-full bg-border-color" />
                                          <span className="truncate max-w-[150px]">{currentVersion?.fileName || 'asset'}</span>
                                        </div>
                                    </div>
                                    </div>
                                </td>
                                <td className="px-8 py-5 font-medium text-text-primary/80">{project.clientName}</td>
                                <td className="px-8 py-5">
                                    <span className="bg-brand-50 dark:bg-brand-500/10 px-2.5 py-1 rounded-lg text-[10px] font-black font-mono text-brand-600 dark:text-brand-400 border border-brand-100 dark:border-brand-500/20">V{currentVersion?.versionNumber}</span>
                                </td>
                                <td className="px-8 py-5">
                                    <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
                                    <select
                                        value={project.status}
                                        onChange={(e) => updateProjectStatus(project.id, e.target.value as ProjectStatus)}
                                        className={`
                                            appearance-none pl-4 pr-10 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest cursor-pointer focus:outline-none focus:ring-4 focus:ring-brand-500/10 transition-all border
                                            ${project.status === ProjectStatus.APPROVED ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/50' : ''}
                                            ${project.status === ProjectStatus.CHANGES_REQUIRED ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50' : ''}
                                            ${project.status === ProjectStatus.IN_REVIEW ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50' : ''}
                                            ${project.status === ProjectStatus.WAITING_FOR_REVIEW ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800/50' : ''}
                                        `}
                                        >
                                        <option value={ProjectStatus.WAITING_FOR_REVIEW}>Waiting for Review</option>
                                        <option value={ProjectStatus.IN_REVIEW}>In Review</option>
                                        <option value={ProjectStatus.CHANGES_REQUIRED}>Changes Required</option>
                                        <option value={ProjectStatus.APPROVED}>Approved</option>
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                            <ChevronDown className={`w-3.5 h-3.5 ${
                                            project.status === ProjectStatus.APPROVED ? 'text-green-700 dark:text-green-400' : 
                                            project.status === ProjectStatus.CHANGES_REQUIRED ? 'text-red-700 dark:text-red-400' : 
                                            project.status === ProjectStatus.WAITING_FOR_REVIEW ? 'text-purple-700 dark:text-purple-400' : 'text-blue-700 dark:text-blue-400'
                                            }`} />
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-5 text-right relative">
                                    <div className="flex items-center justify-end gap-3">
                                        <Link to={`/project/${project.id}`}>
                                            <Button variant="outline" size="sm" className="rounded-xl font-bold uppercase tracking-wider text-[10px]">Review</Button>
                                        </Link>
                                        
                                        <div className="relative">
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActionMenuOpen(actionMenuOpen === project.id ? null : project.id);
                                                }}
                                                className="p-2 text-text-secondary hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-xl transition-all"
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
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Google Drive Temporary Storage Info */}
                    <div className="bg-brand-50/50 dark:bg-brand-500/5 border border-brand-100 dark:border-brand-500/10 rounded-2xl p-6 flex items-center justify-between gap-6 shadow-sm">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 bg-white dark:bg-surface rounded-2xl flex items-center justify-center shadow-md ring-1 ring-black/5 dark:ring-white/5">
                                <Globe className="w-7 h-7 text-brand-500" />
                            </div>
                            <div>
                                <h4 className="text-lg font-black text-text-primary tracking-tight">Temporary Google Drive Storage</h4>
                                <p className="text-sm text-text-secondary opacity-70">Use this shared folder to temporarily save and share your review files.</p>
                            </div>
                        </div>
                        <a 
                            href="https://drive.google.com/drive/folders/1RWqqHe9-_am2IgZwFCmnyAj_zP76aFko?usp=sharing" 
                            target="_blank" 
                            rel="noopener noreferrer"
                        >
                            <Button variant="outline" className="bg-white dark:bg-surface hover:shadow-md transition-all">
                                <FolderOpen className="w-4 h-4 mr-2" /> Open Drive Folder
                            </Button>
                        </a>
                    </div>

                    <div className="saas-card overflow-hidden min-h-[500px]">
                        <div className="p-6 border-b border-border-color flex justify-between items-center gap-6 bg-surface/50">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary opacity-50" />
                                <input 
                                    type="text" 
                                    placeholder="Search files..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 border border-border-color rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none bg-background/50 text-text-primary placeholder-text-secondary/40 transition-all"
                                />
                            </div>
                        </div>
                        
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-text-secondary">
                                <thead className="bg-brand-50/30 dark:bg-brand-500/5 text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-60">
                                    <tr>
                                        <th className="px-8 py-4 w-[40%]">File Name</th>
                                        <th className="px-8 py-4">Type</th>
                                        <th className="px-8 py-4">Size</th>
                                        <th className="px-8 py-4">Saved On</th>
                                        <th className="px-8 py-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-color">
                                    {savedFiles.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-8 py-24 text-center">
                                                <div className="flex flex-col items-center justify-center text-text-secondary">
                                                    <div className="w-20 h-20 bg-brand-50 dark:bg-brand-500/5 rounded-full flex items-center justify-center mb-6">
                                                        <FileText className="w-10 h-10 text-brand-200 dark:text-brand-800" />
                                                    </div>
                                                    <p className="text-xl font-black text-text-primary tracking-tight mb-2">No saved files</p>
                                                    <p className="text-sm opacity-60 max-w-xs mx-auto">Save files from project reviews or attachments to see them here.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        savedFiles.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase())).map(file => (
                                            <tr key={file.id} className="hover:bg-brand-50/30 dark:hover:bg-brand-500/5 transition-all group">
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center text-brand-600 dark:text-brand-400 shadow-sm ring-1 ring-black/5 dark:ring-white/5">
                                                            {getIcon(file.assetType)}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-bold text-text-primary truncate">{file.name}</p>
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-50">{file.type}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 bg-background border border-border-color rounded-lg">{file.assetType}</span>
                                                </td>
                                                <td className="px-8 py-5 font-mono text-xs">{(file.size / (1024 * 1024)).toFixed(2)} MB</td>
                                                <td className="px-8 py-5 text-xs opacity-70">{new Date(file.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                                <td className="px-8 py-5 text-right">
                                                    <div className="flex items-center justify-end gap-3">
                                                        <a href={file.url} download={file.name}>
                                                            <Button variant="outline" size="sm" className="h-9 rounded-lg">
                                                                <FileDown className="w-4 h-4 mr-2" /> Download
                                                            </Button>
                                                        </a>
                                                        <button 
                                                            onClick={() => {
                                                                if (confirm('Are you sure you want to delete this saved file?')) {
                                                                    deleteSavedFile(file.id);
                                                                }
                                                            }}
                                                            className="p-2 text-text-secondary hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
             <div className="bg-surface rounded-3xl shadow-2xl p-8 w-full max-w-md animate-in zoom-in-95 duration-300 border border-border-color">
                 <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-brand-50 dark:bg-brand-500/10 rounded-2xl flex items-center justify-center">
                        <FolderPlus className="w-6 h-6 text-brand-500" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-text-primary tracking-tight">New Folder</h3>
                        <p className="text-xs text-text-secondary opacity-60">Organize your projects into folders.</p>
                    </div>
                 </div>
                 <form onSubmit={handleCreateFolder}>
                     <div className="space-y-2 mb-8">
                        <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-60 ml-1">Folder Name</label>
                        <input 
                            autoFocus
                            type="text" 
                            placeholder="Enter folder name..."
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            className="w-full px-4 py-3.5 border border-border-color rounded-2xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none bg-background/50 text-text-primary placeholder-text-secondary/30 transition-all font-medium"
                        />
                     </div>
                     <div className="flex justify-end gap-3">
                         <Button type="button" variant="ghost" onClick={() => setNewFolderModal(false)} className="rounded-xl px-6">Cancel</Button>
                         <Button type="submit" className="rounded-xl px-8 shadow-lg shadow-brand-500/20">Create Folder</Button>
                     </div>
                 </form>
             </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
             <div className="bg-surface rounded-3xl shadow-2xl p-8 w-full max-w-md animate-in zoom-in-95 duration-300 border border-border-color">
                 <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-brand-50 dark:bg-brand-500/10 rounded-2xl flex items-center justify-center">
                        <Edit3 className="w-6 h-6 text-brand-500" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-text-primary tracking-tight">Rename Project</h3>
                        <p className="text-xs text-text-secondary opacity-60">Update the project name.</p>
                    </div>
                 </div>
                 <form onSubmit={handleRenameProject}>
                     <div className="space-y-2 mb-8">
                        <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-60 ml-1">Project Name</label>
                        <input 
                            autoFocus
                            type="text" 
                            value={renameModal.currentName}
                            onChange={(e) => setRenameModal({ ...renameModal, currentName: e.target.value })}
                            className="w-full px-4 py-3.5 border border-border-color rounded-2xl focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none bg-background/50 text-text-primary placeholder-text-secondary/30 transition-all font-medium"
                        />
                     </div>
                     <div className="flex justify-end gap-3">
                         <Button type="button" variant="ghost" onClick={() => setRenameModal({ ...renameModal, isOpen: false })} className="rounded-xl px-6">Cancel</Button>
                         <Button type="submit" className="rounded-xl px-8 shadow-lg shadow-brand-500/20">Save Changes</Button>
                     </div>
                 </form>
             </div>
        </div>
      )}

      {/* Move Project Modal */}
      {moveModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
             <div className="bg-surface rounded-3xl shadow-2xl p-8 w-full max-w-md animate-in zoom-in-95 duration-300 border border-border-color">
                 <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-brand-50 dark:bg-brand-500/10 rounded-2xl flex items-center justify-center">
                        <Move className="w-6 h-6 text-brand-500" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-text-primary tracking-tight">Move Project</h3>
                        <p className="text-xs text-text-secondary opacity-60">Select a destination folder.</p>
                    </div>
                 </div>
                 <div className="space-y-2 max-h-72 overflow-y-auto mb-8 pr-2 custom-scrollbar">
                     <button 
                        onClick={() => { moveProject(moveModal.projectId, undefined); setMoveModal({ ...moveModal, isOpen: false }); }}
                        className="w-full text-left px-4 py-3.5 rounded-2xl hover:bg-brand-50/50 dark:hover:bg-brand-500/5 flex items-center gap-3 text-text-primary transition-all group"
                     >
                         <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center group-hover:bg-surface transition-all">
                            <LayoutGrid className="w-4 h-4 text-text-secondary opacity-50" />
                         </div>
                         <span className="font-bold">All Projects (Root)</span>
                     </button>
                     {folders.map(f => (
                         <button 
                            key={f.id}
                            onClick={() => { moveProject(moveModal.projectId, f.id); setMoveModal({ ...moveModal, isOpen: false }); }}
                            className="w-full text-left px-4 py-3.5 rounded-2xl hover:bg-brand-50/50 dark:hover:bg-brand-500/5 flex items-center gap-3 text-text-primary transition-all group"
                         >
                             <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center group-hover:bg-surface transition-all">
                                <Folder className="w-4 h-4 text-brand-500 fill-brand-100 dark:fill-brand-900/40" />
                             </div>
                             <span className="font-bold">{f.name}</span>
                         </button>
                     ))}
                 </div>
                 <div className="flex justify-end">
                    <Button type="button" variant="ghost" onClick={() => setMoveModal({ ...moveModal, isOpen: false })} className="rounded-xl px-6">Cancel</Button>
                 </div>
             </div>
        </div>
      )}

    </div>
  );
};