import React, { useState, useRef, useEffect } from 'react';
import { useAXProof } from '../context/ZflowContext';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Clock, CheckCircle, AlertCircle, Plus, Search, FileVideo, FileImage, FileCode, Folder, FileText, ChevronDown, MoreVertical, Edit2, Trash2, FolderInput, FolderOpen, LayoutGrid, List, LogOut, Sun, Moon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { UploadModal } from './UploadModal';
import { AssetType, ProjectStatus } from '../types';

export const Dashboard: React.FC = () => {
  const { projects, folders, currentUser, updateProjectStatus, createFolder, deleteFolder, deleteProject, renameProject, moveProject, logout, theme, toggleTheme } = useAXProof();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
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
      default: return <Folder className="w-5 h-5 text-gray-500" />;
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
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden transition-colors">
      
      {/* Sidebar */}
      <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col shrink-0 transition-colors">
        <div className="p-6">
             <div className="flex items-center gap-2 mb-8">
                 <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-xl">A</span>
                 </div>
                 <span className="font-bold text-xl text-gray-900 dark:text-white tracking-tight">AXProof</span>
             </div>

             <Button className="w-full justify-start" onClick={() => setIsUploadOpen(true)}>
                <Plus className="w-4 h-4 mr-2" /> New Project
             </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 space-y-6">
            <div>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-2">Library</h3>
                <button 
                    onClick={() => setActiveFolderId(null)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeFolderId === null ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                >
                    <LayoutGrid className="w-4 h-4" /> All Projects
                </button>
            </div>

            <div>
                <div className="flex items-center justify-between px-2 mb-2">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Folders</h3>
                    <button onClick={() => setNewFolderModal(true)} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
                <div className="space-y-1">
                    {folders.map(folder => (
                        <div key={folder.id} className="group flex items-center justify-between pr-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            <button 
                                onClick={() => setActiveFolderId(folder.id)}
                                className={`flex-1 flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeFolderId === folder.id ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' : 'text-gray-600 dark:text-gray-400'}`}
                            >
                                <Folder className={`w-4 h-4 ${activeFolderId === folder.id ? 'fill-brand-200 dark:fill-brand-800 text-brand-500' : 'fill-gray-100 dark:fill-gray-600 text-gray-400 dark:text-gray-500'}`} /> 
                                <span className="truncate">{folder.name}</span>
                            </button>
                            <button onClick={() => handleDeleteFolder(folder.id)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity p-1">
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                    {folders.length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-400 italic">No folders created</div>
                    )}
                </div>
            </div>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
                <img src={currentUser.avatar} alt="" className="w-9 h-9 rounded-full bg-gray-200" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{currentUser.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Workspace Admin</p>
                </div>
                <button 
                  onClick={logout} 
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Sign out"
                >
                    <LogOut className="w-5 h-5" />
                </button>
            </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {activeFolderId ? folders.find(f => f.id === activeFolderId)?.name : 'All Projects'}
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                    {activeFolderId ? `${filteredProjects.length} projects in folder` : `Overview of all creative assets`}
                </p>
                </div>

                <div className="flex flex-col items-end gap-4">
                  {/* Theme Toggle */}
                  <button 
                      onClick={toggleTheme}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                  >
                      {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                      <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                  </button>
                
                  {/* Stats (only show on All Projects view for summary) */}
                  {!activeFolderId && (
                      <div className="flex gap-4">
                          <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-3 transition-colors">
                              <div className="p-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-full"><Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" /></div>
                              <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">In Review</p>
                                  <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">{inReview}</p>
                              </div>
                          </div>
                          <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-3 transition-colors">
                              <div className="p-1.5 bg-orange-50 dark:bg-orange-900/30 rounded-full"><AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" /></div>
                              <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">Changes</p>
                                  <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">{changes}</p>
                              </div>
                          </div>
                          <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex items-center gap-3 transition-colors">
                              <div className="p-1.5 bg-green-50 dark:bg-green-900/30 rounded-full"><CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" /></div>
                              <div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-bold">Approved</p>
                                  <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">{approved}</p>
                              </div>
                          </div>
                      </div>
                  )}
                </div>
            </div>

            <UploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} />

            {/* Projects List */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden min-h-[400px] transition-colors">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                        type="text" 
                        placeholder="Search projects by name or client..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-gray-600 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none bg-gray-700 dark:bg-gray-900 text-[#FFFFFF] placeholder-gray-400"
                        />
                    </div>
                    {/* Sort or other controls could go here */}
                </div>
                
                <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                    <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-medium">
                    <tr>
                        <th className="px-6 py-3 w-[40%]">Project Name</th>
                        <th className="px-6 py-3">Client</th>
                        <th className="px-6 py-3">Version</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3 text-right">Action</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {filteredProjects.length === 0 ? (
                        <tr>
                        <td colSpan={5} className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                                <FolderOpen className="w-12 h-12 mb-3 text-gray-300 dark:text-gray-600" />
                                <p className="text-base font-medium text-gray-900 dark:text-gray-200">No projects found</p>
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
                            <tr key={project.id} className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors group">
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                {project.thumbnail ? (
                                    <img src={project.thumbnail} alt="" className="w-10 h-10 rounded object-cover bg-gray-200 dark:bg-gray-700 shadow-sm" />
                                ) : (
                                    <div className="w-10 h-10 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400">
                                    {currentVersion && getIcon(currentVersion.assetType)}
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <Link to={`/project/${project.id}`} className="font-medium text-gray-900 dark:text-white hover:text-brand-600 dark:hover:text-brand-400 truncate block">
                                        {project.name}
                                    </Link>
                                    <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                                    {currentVersion && getIcon(currentVersion.assetType)}
                                    <span>{currentVersion?.assetType}</span>
                                    <span className="text-gray-300 dark:text-gray-600">|</span>
                                    <span className="truncate max-w-[150px]">{currentVersion?.fileName || 'asset'}</span>
                                    </div>
                                </div>
                                </div>
                            </td>
                            <td className="px-6 py-4">{project.clientName}</td>
                            <td className="px-6 py-4">
                                <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs font-mono text-gray-600 dark:text-gray-300">v{currentVersion?.versionNumber}</span>
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
                                            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                                        >
                                            <MoreVertical className="w-4 h-4" />
                                        </button>

                                        {actionMenuOpen === project.id && (
                                            <div ref={actionMenuRef} className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 z-20 animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
                                                <button 
                                                    onClick={() => {
                                                        setRenameModal({ isOpen: true, projectId: project.id, currentName: project.name });
                                                        setActionMenuOpen(null);
                                                    }}
                                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                                                >
                                                    <Edit2 className="w-4 h-4" /> Rename
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        setMoveModal({ isOpen: true, projectId: project.id });
                                                        setActionMenuOpen(null);
                                                    }}
                                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                                                >
                                                    <FolderInput className="w-4 h-4" /> Move to Folder
                                                </button>
                                                <div className="h-px bg-gray-100 dark:bg-gray-700 my-1" />
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
        </div>
      </div>

      {/* New Folder Modal */}
      {newFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
             <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-sm animate-in zoom-in-95 border border-gray-200 dark:border-gray-700">
                 <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Create New Folder</h3>
                 <form onSubmit={handleCreateFolder}>
                     <input 
                        autoFocus
                        type="text" 
                        placeholder="Folder Name"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-600 rounded-lg mb-4 focus:ring-2 focus:ring-brand-500 outline-none bg-gray-700 text-[#FFFFFF]"
                     />
                     <div className="flex justify-end gap-2">
                         <Button type="button" variant="ghost" onClick={() => setNewFolderModal(false)} className="dark:text-gray-300 dark:hover:text-white">Cancel</Button>
                         <Button type="submit">Create</Button>
                     </div>
                 </form>
             </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
             <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-sm animate-in zoom-in-95 border border-gray-200 dark:border-gray-700">
                 <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Rename Project</h3>
                 <form onSubmit={handleRenameProject}>
                     <input 
                        autoFocus
                        type="text" 
                        value={renameModal.currentName}
                        onChange={(e) => setRenameModal({ ...renameModal, currentName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-600 rounded-lg mb-4 focus:ring-2 focus:ring-brand-500 outline-none bg-gray-700 text-[#FFFFFF]"
                     />
                     <div className="flex justify-end gap-2">
                         <Button type="button" variant="ghost" onClick={() => setRenameModal({ ...renameModal, isOpen: false })} className="dark:text-gray-300 dark:hover:text-white">Cancel</Button>
                         <Button type="submit">Save</Button>
                     </div>
                 </form>
             </div>
        </div>
      )}

      {/* Move Project Modal */}
      {moveModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
             <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-sm animate-in zoom-in-95 border border-gray-200 dark:border-gray-700">
                 <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Move Project</h3>
                 <div className="space-y-1 max-h-60 overflow-y-auto mb-4">
                     <button 
                        onClick={() => { moveProject(moveModal.projectId, undefined); setMoveModal({ ...moveModal, isOpen: false }); }}
                        className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-200"
                     >
                         <LayoutGrid className="w-4 h-4 text-gray-500" /> All Projects (Root)
                     </button>
                     {folders.map(f => (
                         <button 
                            key={f.id}
                            onClick={() => { moveProject(moveModal.projectId, f.id); setMoveModal({ ...moveModal, isOpen: false }); }}
                            className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-200"
                         >
                             <Folder className="w-4 h-4 text-yellow-500 fill-yellow-100" /> {f.name}
                         </button>
                     ))}
                 </div>
                 <div className="flex justify-end gap-2">
                     <Button type="button" variant="ghost" onClick={() => setMoveModal({ ...moveModal, isOpen: false })} className="dark:text-gray-300 dark:hover:text-white">Cancel</Button>
                 </div>
             </div>
        </div>
      )}

    </div>
  );
};