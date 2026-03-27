import React, { createContext, useContext, useState, useEffect } from 'react';
import JSZip from 'jszip';
import { Project, User, Annotation, AnnotationStatus, ProjectStatus, AssetVersion, AssetType, AssetFile, Folder, Attachment, SavedFile } from '../types';
import { MOCK_PROJECTS as INITIAL_PROJECTS, MOCK_ANNOTATIONS as INITIAL_ANNOTATIONS } from '../constants';
import { db } from '../db';
import { auth, storage } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface AXProofContextType {
  currentUser: User | null;
  login: (email: string, pass: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<void>;
  signup: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => void;
  projects: Project[];
  folders: Folder[];
  savedFiles: SavedFile[];
  annotations: Record<string, Annotation[]>;
  addAnnotation: (annotation: Annotation) => void;
  updateAnnotationStatus: (id: string, status: AnnotationStatus) => void;
  addReply: (annotationId: string, text: string) => void;
  getProject: (id: string) => Project | undefined;
  updateProjectStatus: (id: string, status: ProjectStatus) => void;
  createProject: (project: Project, file?: File) => void;
  deleteProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  moveProject: (id: string, folderId?: string) => void;
  createFolder: (name: string) => void;
  deleteFolder: (id: string) => void;
  approveVersion: (projectId: string, versionId: string) => void;
  requestChanges: (projectId: string, versionId: string) => void;
  markInReview: (projectId: string, versionId: string) => void;
  markWaitingForReview: (projectId: string, versionId: string) => void;
  uploadNewVersion: (projectId: string, content: File | string) => void;
  processFile: (file: File) => Promise<{ url: string; assetType: AssetType; files?: AssetFile[] }>;
  processUrl: (url: string) => Promise<{ url: string; assetType: AssetType }>;
  processAttachment: (file: File) => Promise<Attachment>;
  saveFileToApp: (file: File | Blob, name: string) => Promise<void>;
  deleteSavedFile: (id: string) => Promise<void>;
  rehydrateAsset: (projectId: string, versionId: string) => Promise<void>;
  warmupConnection: () => Promise<void>;
  isLoading: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const AXProofContext = createContext<AXProofContextType | undefined>(undefined);

export const AXProofProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [savedFiles, setSavedFiles] = useState<SavedFile[]>([]);
  const [annotations, setAnnotations] = useState<Record<string, Annotation[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [hydratedVersions, setHydratedVersions] = useState<Set<string>>(new Set());

  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('axproof_theme');
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('axproof_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // --- Connection Warmup ---
  const warmupConnection = async () => {
    console.log(`[${new Date().toISOString()}] Warming up connection to establish session cookies...`);
    try {
      // 1. Fetch root and health check with credentials to ensure cookies are set
      const timestamp = Date.now();
      await Promise.all([
        fetch(`/?t=${timestamp}`, { credentials: 'include' }).catch(() => {}),
        fetch(`/api/health?t=${timestamp}`, { credentials: 'include' }).catch(() => {})
      ]);

      // 2. Aggressive warmup: Use a hidden iframe to hit the health endpoint
      // This is often more effective at clearing proxy-level "Cookie checks"
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = `/api/health?t=${timestamp}&mode=warmup`;
      document.body.appendChild(iframe);
      
      await new Promise(resolve => {
        const timer = setTimeout(resolve, 3000);
        iframe.onload = () => { clearTimeout(timer); resolve(null); };
        iframe.onerror = () => { clearTimeout(timer); resolve(null); };
      });
      
      if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
      }

      // 3. Wait a bit for cookies to be processed by the browser
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log(`[${new Date().toISOString()}] Connection warmup complete.`);
    } catch (e) {
      console.error("Connection warmup failed", e);
    }
  };

  // Initialization: Load from DB or Seed Mock Data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
            setCurrentUser({
                id: user.uid,
                name: user.displayName || user.email?.split('@')[0] || 'User',
                email: user.email || '',
                avatar: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=random`,
                role: user.email?.toLowerCase() === 'gdalvi01@affinityx.com' ? 'ADMIN' : 'REVIEWER'
            });
        } else {
            setCurrentUser(null);
        }
    });

    const loadData = async () => {
      try {
        // Warm up the connection to establish cookies and avoid "Cookie check" interceptions
        await warmupConnection();

        let loadedProjects = await db.getProjects();
        let loadedAnnotations = await db.getAnnotations();
        let loadedFolders = await db.getFolders();
        let loadedSavedFiles = await db.getSavedFiles();

        // Check for session
        const storedUser = localStorage.getItem('axproof_user');
        if (storedUser) {
            setCurrentUser(JSON.parse(storedUser));
        }

        // Seed if empty
        if (loadedProjects.length === 0) {
          for (const p of INITIAL_PROJECTS) {
            await db.saveProject(p);
          }
          loadedProjects = INITIAL_PROJECTS;
        }

        if (loadedAnnotations.length === 0) {
            // Flatten mock annotations
            const flatAnnotations = Object.values(INITIAL_ANNOTATIONS).flat();
            for (const a of flatAnnotations) {
                await db.saveAnnotation(a);
            }
            loadedAnnotations = flatAnnotations;
        }

        // Rehydrate Saved Files
        const hydratedSavedFiles = await Promise.all(loadedSavedFiles.map(async (f) => {
            const blob = await db.getAsset(f.id);
            if (blob) {
                return { ...f, url: URL.createObjectURL(blob) };
            }
            return f;
        }));
        setSavedFiles(hydratedSavedFiles);

        // Rehydrate Assets (Regenerate Blob URLs for local files)
        const hydratedProjects = await Promise.all(loadedProjects.map(async (project) => {
             const updatedVersions = await Promise.all(project.versions.map(async (v) => {
                 // Check if we have a stored asset blob for this version
                 const blob = await db.getAsset(v.id);
                 if (blob) {
                     // If it's a ZIP, we don't rehydrate it on startup to avoid overwhelming the server/proxy
                     // and to avoid "Cookie check" errors during background startup requests.
                     // We only rehydrate simple files here.
                     const name = (blob as File).name || 'unknown';
                     const type = blob.type || '';
                     const isZip = name.endsWith('.zip') || type === 'application/zip' || type === 'application/x-zip-compressed';
                     
                     if (isZip) {
                         // For ZIPs, we'll rehydrate them on demand when they are viewed.
                         // We just need to ensure the 'files' array is populated if it was before.
                         // For now, we'll just return the version as is, and the UI will trigger rehydration.
                         return v;
                     }

                     // If we have a blob, we must regenerate the URLs because blob: URLs expire on refresh
                     try {
                         const processed = await processFileInternal(blob as File, v.id);
                         return {
                             ...v,
                             url: processed.url,
                             assetType: processed.files && processed.files.length > 0 ? processed.files[0].type : processed.assetType,
                             files: processed.files
                         };
                     } catch (e) {
                         console.error(`Failed to rehydrate asset for version ${v.id}:`, e);
                         return v;
                     }
                 }
                 return v;
             }));
             return { ...project, versions: updatedVersions };
        }));

        // Rehydrate Annotation Attachments
        const annotationsWithBlobs = await Promise.all(loadedAnnotations.map(async (ann) => {
             if (ann.attachments && ann.attachments.length > 0) {
                 const updatedAttachments = await Promise.all(ann.attachments.map(async (att) => {
                     const blob = await db.getAsset(att.id);
                     if (blob) {
                         return { ...att, url: URL.createObjectURL(blob) };
                     }
                     return att;
                 }));
                 return { ...ann, attachments: updatedAttachments };
             }
             return ann;
        }));

        // Transform annotations array back to Record map
        const annotationsMap: Record<string, Annotation[]> = {};
        annotationsWithBlobs.forEach(ann => {
            if (!annotationsMap[ann.assetVersionId]) {
                annotationsMap[ann.assetVersionId] = [];
            }
            annotationsMap[ann.assetVersionId].push(ann);
        });

        setProjects(hydratedProjects);
        setFolders(loadedFolders);
        setAnnotations(annotationsMap);
      } catch (e) {
        console.error("Failed to load data", e);
        // Fallback to mock data in memory if DB fails
        setProjects(INITIAL_PROJECTS);
        setAnnotations(INITIAL_ANNOTATIONS);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
    return () => unsubscribe();
  }, []);

  // --- Auth Management ---

  const login = async (email: string, pass: string): Promise<boolean> => {
      try {
          await signInWithEmailAndPassword(auth, email, pass);
          return true;
      } catch (error: any) {
          console.error("Login error:", error);
          if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
              throw new Error("Password or Email Incorrect");
          }
          throw error;
      }
  };

  const loginWithGoogle = async () => {
      try {
          const provider = new GoogleAuthProvider();
          await signInWithPopup(auth, provider);
      } catch (error: any) {
          console.error("Google login error:", error);
          throw error;
      }
  };

  const signup = async (email: string, pass: string, name: string, profilePhoto?: File) => {
      try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
          const user = userCredential.user;

          let photoURL = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
          if (profilePhoto) {
              const storageRef = ref(storage, `avatars/${user.uid}`);
              await uploadBytes(storageRef, profilePhoto);
              photoURL = await getDownloadURL(storageRef);
          }

          await updateProfile(user, {
              displayName: name,
              photoURL: photoURL
          });

          // Trigger state update
          setCurrentUser({
              id: user.uid,
              name: name,
              email: email,
              avatar: photoURL,
              role: email.toLowerCase() === 'gdalvi01@affinityx.com' ? 'ADMIN' : 'REVIEWER'
          });
      } catch (error: any) {
          console.error("Signup error:", error);
          if (error.code === 'auth/email-already-in-use') {
              throw new Error("User already exists. Sign in?");
          }
          throw error;
      }
  };

  const logout = async () => {
      try {
          await signOut(auth);
      } catch (error) {
          console.error("Logout error:", error);
      }
  };

  // --- Project Management ---

  const createProject = (project: Project, file?: File) => {
    setProjects(prev => {
        const newProjects = [project, ...prev];
        // Persist
        db.saveProject(project);
        if (file && project.versions.length > 0) {
            db.saveAsset(project.versions[0].id, file);
        }
        return newProjects;
    });
  };

  const deleteProject = async (id: string) => {
    const projectToDelete = projects.find(p => p.id === id);
    if (!projectToDelete) return;

    setProjects(prev => prev.filter(p => p.id !== id));
    await db.deleteProject(id);

    // Clean up annotations and assets for all versions
    for (const v of projectToDelete.versions) {
        // Delete annotations from state
        setAnnotations(prev => {
            const newMap = { ...prev };
            delete newMap[v.id];
            return newMap;
        });

        // Delete annotations from DB
        const versionAnns = annotations[v.id] || [];
        for (const ann of versionAnns) {
            await db.deleteAnnotation(ann.id);
            // Also delete attachment assets if any
            if (ann.attachments) {
                for (const att of ann.attachments) {
                    await db.deleteAsset(att.id);
                }
            }
        }

        // Delete asset blob from DB
        await db.deleteAsset(v.id);
    }
  };

  const renameProject = (id: string, name: string) => {
    setProjects(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, name } : p);
      const project = updated.find(p => p.id === id);
      if (project) db.saveProject(project);
      return updated;
    });
  };

  const moveProject = (id: string, folderId?: string) => {
     setProjects(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, folderId } : p);
      const project = updated.find(p => p.id === id);
      if (project) db.saveProject(project);
      return updated;
    });
  };

  // --- Folder Management ---

  const createFolder = (name: string) => {
    const newFolder: Folder = {
      id: `f-${Date.now()}`,
      name,
      createdAt: new Date().toISOString()
    };
    setFolders(prev => [...prev, newFolder]);
    db.saveFolder(newFolder);
  };

  const deleteFolder = (id: string) => {
    setFolders(prev => prev.filter(f => f.id !== id));
    // Move projects out of this folder (or delete them, but usually moving to root is safer)
    setProjects(prev => prev.map(p => p.folderId === id ? { ...p, folderId: undefined } : p));
    db.deleteFolder(id);
    // Update affected projects in DB
    projects.filter(p => p.folderId === id).forEach(p => {
        db.saveProject({ ...p, folderId: undefined });
    });
  };

  // --- Annotation & Asset Logic ---

  const addAnnotation = (annotation: Annotation) => {
    setAnnotations(prev => {
      const versionAnns = prev[annotation.assetVersionId] || [];
      const newMap = {
        ...prev,
        [annotation.assetVersionId]: [...versionAnns, annotation]
      };
      return newMap;
    });
    db.saveAnnotation(annotation);
    
    // Persist attachment blobs if any
    if (annotation.attachments) {
        // Blobs should have been saved during processAttachment, but we double check or handle here if needed.
        // Actually, processAttachment saves to DB. So we are good.
    }
  };

  const updateAnnotationStatus = (id: string, status: AnnotationStatus) => {
    setAnnotations(prev => {
      const newMap = { ...prev };
      let foundAnnotation: Annotation | undefined;
      for (const key in newMap) {
        newMap[key] = newMap[key].map(ann => {
          if (ann.id === id) {
              const updated = { ...ann, status };
              foundAnnotation = updated;
              return updated;
          }
          return ann;
        });
      }
      
      if (foundAnnotation) {
          db.saveAnnotation(foundAnnotation);
      }
      return newMap;
    });
  };

  const addReply = (annotationId: string, text: string) => {
     if (!currentUser) return;
     setAnnotations(prev => {
      const newMap = { ...prev };
      let foundAnnotation: Annotation | undefined;
      for (const key in newMap) {
        newMap[key] = newMap[key].map(ann => {
          if (ann.id === annotationId) {
            const updated = {
              ...ann,
              replies: [
                ...ann.replies,
                {
                  id: Date.now().toString(),
                  text,
                  authorId: currentUser.id,
                  createdAt: new Date().toISOString()
                }
              ]
            };
            foundAnnotation = updated;
            return updated;
          }
          return ann;
        });
      }

      if (foundAnnotation) {
          db.saveAnnotation(foundAnnotation);
      }
      return newMap;
    });
  };

  const getProject = (id: string) => projects.find(p => p.id === id);

  const updateProjectStatus = (id: string, status: ProjectStatus) => {
    setProjects(prev => {
        const updated = prev.map(p => p.id === id ? { ...p, status } : p);
        const p = updated.find(p => p.id === id);
        if (p) db.saveProject(p);
        return updated;
    });
  };

  const approveVersion = (projectId: string, versionId: string) => {
    if (!currentUser) return;
    setProjects(prev => {
        const updated = prev.map(p => {
            if (p.id !== projectId) return p;

            // Update the specific version
            const updatedVersions = p.versions.map(v => {
                if (v.id === versionId) {
                return {
                    ...v,
                    status: 'APPROVED' as const,
                    approvedBy: currentUser.name,
                    approvedAt: new Date().toISOString()
                };
                }
                return v;
            });

            // Update project status if this is the active version
            const newProjectStatus = versionId === p.currentVersionId ? ProjectStatus.APPROVED : p.status;

            return {
                ...p,
                status: newProjectStatus,
                versions: updatedVersions
            };
        });
        
        const p = updated.find(p => p.id === projectId);
        if (p) db.saveProject(p);
        return updated;
    });
  };

  const requestChanges = (projectId: string, versionId: string) => {
    if (!currentUser) return;
    setProjects(prev => {
        const updated = prev.map(p => {
        if (p.id !== projectId) return p;

        const updatedVersions = p.versions.map(v => {
            if (v.id === versionId) {
            return {
                ...v,
                status: 'CHANGES_REQUIRED' as const,
                changesRequestedBy: currentUser.name,
                changesRequestedAt: new Date().toISOString()
            };
            }
            return v;
        });

        return {
            ...p,
            status: ProjectStatus.CHANGES_REQUIRED,
            versions: updatedVersions
        };
        });
        
        const p = updated.find(p => p.id === projectId);
        if (p) db.saveProject(p);
        return updated;
    });
  };

  const markInReview = (projectId: string, versionId: string) => {
    if (!currentUser) return;
    setProjects(prev => {
        const updated = prev.map(p => {
        if (p.id !== projectId) return p;

        const updatedVersions = p.versions.map(v => {
            if (v.id === versionId) {
            return {
                ...v,
                status: 'IN_REVIEW' as const
            };
            }
            return v;
        });

        const newProjectStatus = versionId === p.currentVersionId ? ProjectStatus.IN_REVIEW : p.status;

        return {
            ...p,
            status: newProjectStatus,
            versions: updatedVersions
        };
        });
        
        const p = updated.find(p => p.id === projectId);
        if (p) db.saveProject(p);
        return updated;
    });
  };

  const markWaitingForReview = (projectId: string, versionId: string) => {
    if (!currentUser) return;
    setProjects(prev => {
        const updated = prev.map(p => {
        if (p.id !== projectId) return p;

        const updatedVersions = p.versions.map(v => {
            if (v.id === versionId) {
            return {
                ...v,
                status: 'WAITING_FOR_REVIEW' as const
            };
            }
            return v;
        });

        const newProjectStatus = versionId === p.currentVersionId ? ProjectStatus.WAITING_FOR_REVIEW : p.status;

        return {
            ...p,
            status: newProjectStatus,
            versions: updatedVersions
        };
        });
        
        const p = updated.find(p => p.id === projectId);
        if (p) db.saveProject(p);
        return updated;
    });
  };

  const getAssetType = (mimeType: string, fileName: string): AssetType => {
    if (mimeType.startsWith('video/')) return AssetType.VIDEO;
    if (mimeType === 'image/gif' || fileName.toLowerCase().endsWith('.gif')) return AssetType.GIF;
    if (mimeType.startsWith('image/')) return AssetType.IMAGE;
    if (mimeType === 'text/html' || fileName.endsWith('.html')) return AssetType.HTML;
    if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) return AssetType.PDF;
    return AssetType.IMAGE;
  };

  // Helper to determine type from file extension
  const getTypeFromExtension = (name: string): AssetType => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (['mp4', 'mov', 'webm'].includes(ext || '')) return AssetType.VIDEO;
    if (['gif'].includes(ext || '')) return AssetType.GIF;
    if (['jpg', 'jpeg', 'png', 'webp', 'svg'].includes(ext || '')) return AssetType.IMAGE;
    if (['html', 'htm'].includes(ext || '')) return AssetType.HTML;
    if (['pdf'].includes(ext || '')) return AssetType.PDF;
    return AssetType.HTML; // Fallback
  };

  const injectAdControls = (html: string) => {
    const script = `
<script>
(function() {
  window.__ad_paused = false;
  window.__ad_time = 0;
  let lastTime = performance.now();
  
  const originalRaf = window.requestAnimationFrame;
  const originalCancelRaf = window.cancelAnimationFrame;
  const originalSetTimeout = window.setTimeout;
  const originalClearTimeout = window.clearTimeout;
  const originalSetInterval = window.setInterval;
  const originalClearInterval = window.clearInterval;
  const originalDateNow = Date.now;
  const originalPerfNow = performance.now.bind(performance);

  let rafCallbacks = new Map();
  let rafId = 0;
  
  let timeouts = new Map();
  let timeoutId = 0;
  
  let intervals = new Map();
  let intervalId = 0;

  window.requestAnimationFrame = function(cb) {
    const id = ++rafId;
    rafCallbacks.set(id, cb);
    return id;
  };
  window.cancelAnimationFrame = function(id) {
    rafCallbacks.delete(id);
  };

  window.setTimeout = function(cb, delay, ...args) {
    const id = ++timeoutId;
    timeouts.set(id, { cb, delay, start: window.__ad_time, args });
    return id;
  };
  window.clearTimeout = function(id) {
    timeouts.delete(id);
  };

  window.setInterval = function(cb, delay, ...args) {
    const id = ++intervalId;
    intervals.set(id, { cb, delay, last: window.__ad_time, args });
    return id;
  };
  window.clearInterval = function(id) {
    intervals.delete(id);
  };

  Date.now = function() {
    return originalDateNow();
  };
  performance.now = function() {
    return window.__ad_time;
  };

  function tick() {
    const now = originalPerfNow();
    const dt = now - lastTime;
    lastTime = now;

    if (!window.__ad_paused) {
      window.__ad_time += dt;
      
      timeouts.forEach((t, id) => {
        if (window.__ad_time - t.start >= t.delay) {
          timeouts.delete(id);
          try { typeof t.cb === 'function' ? t.cb(...t.args) : eval(t.cb); } catch(e) { console.error(e); }
        }
      });

      intervals.forEach((t, id) => {
        if (window.__ad_time - t.last >= t.delay) {
          t.last = window.__ad_time;
          try { typeof t.cb === 'function' ? t.cb(...t.args) : eval(t.cb); } catch(e) { console.error(e); }
        }
      });
    }
    
    // Always execute RAF callbacks so the ad can render the current state
    const currentRafs = new Map(rafCallbacks);
    rafCallbacks.clear();
    currentRafs.forEach((cb, id) => {
      try { cb(window.__ad_time); } catch(e) { console.error(e); }
    });
    
    originalRaf(tick);
  }
  originalRaf(tick);

  window.addEventListener('message', (e) => {
    if (e.data.type === 'PAUSE') {
      window.__ad_paused = true;
      document.documentElement.style.setProperty('--ad-play-state', 'paused');
    } else if (e.data.type === 'PLAY') {
      window.__ad_paused = false;
      lastTime = originalPerfNow();
      document.documentElement.style.setProperty('--ad-play-state', 'running');
    } else if (e.data.type === 'SEEK') {
      window.__ad_time = e.data.time * 1000;
      // Note: seeking arbitrary JS is hard, but we update the time.
    }
  });

  const style = document.createElement('style');
  style.textContent = '*, *::before, *::after { animation-play-state: var(--ad-play-state, running) !important; }';
  document.head.appendChild(style);
})();
</script>
`;
    if (html.includes('<head>')) {
      return html.replace('<head>', '<head>' + script);
    } else {
      return script + html;
    }
  };

  const getMimeType = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'html': case 'htm': return 'text/html';
        case 'css': return 'text/css';
        case 'js': return 'application/javascript';
        case 'json': return 'application/json';
        case 'svg': return 'image/svg+xml';
        case 'png': return 'image/png';
        case 'jpg': case 'jpeg': return 'image/jpeg';
        case 'gif': return 'image/gif';
        case 'webp': return 'image/webp';
        case 'mp4': return 'video/mp4';
        case 'webm': return 'video/webm';
        case 'pdf': return 'application/pdf';
        case 'txt': return 'text/plain';
        default: return 'application/octet-stream';
    }
  };

  const processFileInternal = async (file: File | Blob, versionId?: string): Promise<{ url: string; assetType: AssetType; files?: AssetFile[] }> => {
    // Determine info based on file (if Blob, name might be missing, assume basic or pass meta)
    const name = (file as File).name || 'unknown';
    const type = file.type || '';
    
    // ZIP Handling
    if (name.endsWith('.zip') || type === 'application/zip' || type === 'application/x-zip-compressed') {
        // Client-side size check (32MB limit usually enforced by proxy)
        const MAX_SIZE = 32 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            throw new Error(`ZIP file is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum allowed size is 32MB. For larger creatives, please host them externally and use the "URL" upload option.`);
        }

        try {
            const formData = new FormData();
            // Generate a unique ID for this extraction to avoid conflicts, or use versionId if provided
            const extractId = versionId || Math.random().toString(36).substring(2, 15);
            formData.append('file', file, name);
            formData.append('id', extractId);

            console.log(`[${new Date().toISOString()}] Initiating ZIP upload to /api/upload-zip`, {
                name,
                size: file.size,
                extractId
            });

            // Helper to make the actual request
            const makeRequest = async () => {
                return await fetch('/api/upload-zip', {
                    method: 'POST',
                    body: formData,
                    credentials: 'include' // Ensure cookies are sent
                });
            };

            let response = await makeRequest();

            // Check for "Cookie check" interception (common in some proxied environments)
            // This happens when the proxy returns a 200 OK but with HTML content instead of JSON
            const initialContentType = response.headers.get('content-type');
            if (response.ok && initialContentType && initialContentType.includes('text/html')) {
                const text = await response.clone().text();
                if (text.includes('Cookie check') || text.includes('redirectToReturnUrl') || text.includes('<!doctype html>')) {
                    console.log(`[${new Date().toISOString()}] Cookie check detected, performing aggressive warmup...`);
                    // Perform aggressive warmup
                    await warmupConnection();
                    // Retry the original request
                    response = await makeRequest();
                    
                    // If it still returns HTML, try one more time after a longer wait
                    const secondContentType = response.headers.get('content-type');
                    if (response.ok && secondContentType && secondContentType.includes('text/html')) {
                        console.log(`[${new Date().toISOString()}] Cookie check still present, waiting longer for second retry...`);
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        response = await makeRequest();
                    }
                }
            }

            console.log(`[${new Date().toISOString()}] ZIP upload response status: ${response.status} ${response.statusText}`);
            const contentType = response.headers.get('content-type');
            console.log(`[${new Date().toISOString()}] ZIP upload response content-type: ${contentType}`);

            if (!response.ok) {
                let errorMsg = 'Failed to upload and extract ZIP';
                try {
                    const text = await response.text();
                    console.error("Server error response text:", text);
                    try {
                        const errData = JSON.parse(text);
                        if (errData.error) errorMsg += `: ${errData.error}`;
                        if (errData.details) errorMsg += ` (${errData.details})`;
                    } catch (e) {
                        if (response.status === 413) {
                            errorMsg = 'File is too large for the server. Please try a smaller ZIP file (under 32MB).';
                        } else {
                            errorMsg += ` (HTTP ${response.status}: ${response.statusText || 'Unknown Error'})`;
                        }
                    }
                } catch (e) {
                    // Ignore text read error
                }
                throw new Error(errorMsg);
            }

            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error("Expected JSON but got:", contentType, text.substring(0, 500));
                
                if (text.includes('Cookie check') || text.includes('redirectToReturnUrl') || text.includes('<!doctype html>')) {
                    throw new Error(`The platform is requesting a security check. Please try clicking the "Repair Connection" button in the sidebar or refreshing the page. (Cookie check intercepted)`);
                }
                
                throw new Error(`Server returned an invalid response format (${contentType || 'unknown'}). This usually indicates a server-side error or misconfiguration.`);
            }

            const data = await response.json();
            
            // We still want to parse the ZIP locally just to get the list of files for the UI
            // if needed, but for now we can just return the main URL.
            // Let's do a quick local parse just to populate the 'files' array for the UI
            const zip = await JSZip.loadAsync(file);
            const files: AssetFile[] = [];
            const entries = Object.keys(zip.files);
            
            for (const filename of entries) {
                const zipEntry = zip.files[filename];
                if (zipEntry.dir || filename.includes('__MACOSX') || filename.startsWith('.')) continue;
                const assetType = getTypeFromExtension(filename);
                files.push({
                    name: filename.split('/').pop() || filename,
                    path: filename,
                    url: `/uploads/${extractId}/${filename}`,
                    type: assetType
                });
            }

            return {
                url: data.url,
                assetType: AssetType.HTML,
                files
            };
        } catch (e) {
            console.error("Failed to process ZIP via backend", e);
            throw e;
        }
    }

    // Default single file handling
    let finalUrl = URL.createObjectURL(file);
    const assetType = getAssetType(type, name);

    if (assetType === AssetType.HTML && (name.endsWith('.html') || name.endsWith('.htm') || type === 'text/html')) {
        try {
            const text = await file.text();
            const injectedText = injectAdControls(text);
            const newBlob = new Blob([injectedText], { type: 'text/html' });
            finalUrl = URL.createObjectURL(newBlob);
        } catch (e) {
            console.error("Failed to inject ad controls into HTML file", e);
        }
    }

    return {
        url: finalUrl,
        assetType
    };
  };

  const processFile = (file: File) => processFileInternal(file);

  const processUrl = async (url: string): Promise<{ url: string; assetType: AssetType }> => {
    let validUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        validUrl = `https://${url}`;
    }

    return {
        url: validUrl,
        assetType: AssetType.HTML
    };
  };

  const processAttachment = async (file: File): Promise<Attachment> => {
      const id = `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      // Save Blob to DB
      await db.saveAsset(id, file);
      
      const url = URL.createObjectURL(file);
      return {
          id,
          name: file.name,
          type: file.type,
          size: file.size,
          url
      };
  };

  const saveFileToApp = async (file: File | Blob, name: string) => {
      const id = `sf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const type = file.type;
      const size = file.size;
      const assetType = getAssetType(type, name);
      
      await db.saveAsset(id, file);
      const savedFile: SavedFile = {
          id,
          name,
          type,
          size,
          url: URL.createObjectURL(file),
          assetType,
          createdAt: new Date().toISOString()
      };
      
      await db.saveSavedFile(savedFile);
      setSavedFiles(prev => [savedFile, ...prev]);
  };

  const deleteSavedFile = async (id: string) => {
      await db.deleteSavedFile(id);
      setSavedFiles(prev => prev.filter(f => f.id !== id));
  };

  const uploadNewVersion = async (projectId: string, content: File | string) => {
    let url = '';
    let assetType = AssetType.IMAGE;
    let files: AssetFile[] | undefined = undefined;
    let fileSize = '';
    let fileName = '';

    if (content instanceof File) {
        const result = await processFile(content);
        url = result.url;
        assetType = result.assetType;
        files = result.files;
        fileSize = `${(content.size / (1024 * 1024)).toFixed(2)} MB`;
        fileName = content.name;
    } else {
        // String / URL
        const result = await processUrl(content);
        url = result.url;
        assetType = result.assetType;
        fileSize = 'Link';
        fileName = content;
    }
    
    const newVersionId = `v-${Date.now()}`;
    const uploadDate = new Date().toISOString();
    
    setProjects(prev => {
      const updated = prev.map(p => {
        if (p.id !== projectId) return p;

        const currentHead = p.versions.find(v => v.id === p.currentVersionId);
        const nextVersionNumber = (currentHead?.versionNumber || 0) + 1;

        const newVersion: AssetVersion = {
            id: newVersionId,
            versionNumber: nextVersionNumber,
            assetType,
            url,
            uploadDate,
            fileSize,
            fileName,
            status: 'WAITING_FOR_REVIEW', // Changed to WAITING_FOR_REVIEW by default
            previousVersionId: p.currentVersionId,
            files
        };

        return {
            ...p,
            status: ProjectStatus.WAITING_FOR_REVIEW, // Sync project status
            currentVersionId: newVersionId,
            versions: [newVersion, ...p.versions]
        };
      });

      const p = updated.find(p => p.id === projectId);
      if (p) db.saveProject(p);
      
      // Save asset if it's a file
      if (content instanceof File) {
          db.saveAsset(newVersionId, content);
      }

      return updated;
    });
  };

  const rehydrateAsset = async (projectId: string, versionId: string) => {
    if (hydratedVersions.has(versionId)) return;

    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const version = project.versions.find(v => v.id === versionId);
    if (!version) return;

    // Check if we have a stored asset blob
    const blob = await db.getAsset(versionId);
    if (!blob) return;

    try {
      const processed = await processFileInternal(blob as File, versionId);
      
      setProjects(prev => prev.map(p => {
        if (p.id === projectId) {
          return {
            ...p,
            versions: p.versions.map(v => {
              if (v.id === versionId) {
                return {
                  ...v,
                  url: processed.url,
                  assetType: processed.files && processed.files.length > 0 ? processed.files[0].type : processed.assetType,
                  files: processed.files
                };
              }
              return v;
            })
          };
        }
        return p;
      }));
      setHydratedVersions(prev => new Set(prev).add(versionId));
    } catch (e) {
      console.error(`Failed to manually rehydrate asset ${versionId}:`, e);
      throw e;
    }
  };

  return (
    <AXProofContext.Provider value={{
      currentUser,
      login,
      signup,
      logout,
      projects,
      folders,
      annotations,
      addAnnotation,
      updateAnnotationStatus,
      addReply,
      getProject,
      updateProjectStatus,
      createProject,
      deleteProject,
      renameProject,
      moveProject,
      createFolder,
      deleteFolder,
      approveVersion,
      requestChanges,
      markInReview,
      markWaitingForReview,
      uploadNewVersion,
      processFile,
      processUrl,
      processAttachment,
      savedFiles,
      saveFileToApp,
      deleteSavedFile,
      rehydrateAsset,
      warmupConnection,
      isLoading,
      theme,
      toggleTheme
    }}>
      {children}
    </AXProofContext.Provider>
  );
};

export const useAXProof = () => {
  const context = useContext(AXProofContext);
  if (!context) {
    throw new Error('useAXProof must be used within an AXProofProvider');
  }
  return context;
};