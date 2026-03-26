
export enum AssetType {
  VIDEO = 'VIDEO',
  IMAGE = 'IMAGE',
  HTML = 'HTML',
  PDF = 'PDF',
  GIF = 'GIF'
}

export enum ProjectStatus {
  IN_REVIEW = 'IN_REVIEW',
  CHANGES_REQUIRED = 'CHANGES_REQUIRED',
  APPROVED = 'APPROVED',
  WAITING_FOR_REVIEW = 'WAITING_FOR_REVIEW'
}

export enum AnnotationStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED'
}

export enum AnnotationType {
  PIN = 'PIN',
  BOX = 'BOX'
}

export interface User {
  id: string;
  name: string;
  email: string; // Added
  password?: string; // Added (Local only)
  avatar: string;
  role: 'ADMIN' | 'REVIEWER' | 'CLIENT' | 'VIEWER';
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  url: string; // Blob URL
  size: number;
}

export interface Annotation {
  id: string;
  assetVersionId: string;
  pinNumber: number;
  type: AnnotationType;
  x: number; // Percentage 0-100 (Left for BOX)
  y: number; // Percentage 0-100 (Top for BOX)
  width?: number; // Percentage 0-100 (for BOX)
  height?: number; // Percentage 0-100 (for BOX)
  timestamp?: number; // Seconds for video
  text: string;
  authorId: string;
  createdAt: string;
  status: AnnotationStatus;
  replies: Reply[];
  screenshot?: string; // Data URL or placeholder
  filePath?: string; // For multi-file assets (e.g. ZIP), which file is this on?
  attachments?: Attachment[]; // Added
}

export interface Reply {
  id: string;
  text: string;
  authorId: string;
  createdAt: string;
}

export interface AssetFile {
  name: string;
  path: string;
  url: string;
  type: AssetType;
}

export interface AssetVersion {
  id: string;
  versionNumber: number;
  assetType: AssetType;
  url: string; // Blob URL or remote URL (Main entry point)
  uploadDate: string;
  fileSize: string;
  dimensions?: string; // e.g. "1920x1080"
  fileName?: string;
  status: 'IN_REVIEW' | 'APPROVED' | 'CHANGES_REQUIRED' | 'WAITING_FOR_REVIEW';
  approvedBy?: string;
  approvedAt?: string;
  changesRequestedBy?: string;
  changesRequestedAt?: string;
  previousVersionId?: string;
  files?: AssetFile[]; // If this is a ZIP/Package, list of extractable files
}

export interface Project {
  id: string;
  name: string;
  clientName: string;
  status: ProjectStatus;
  thumbnail: string;
  versions: AssetVersion[];
  currentVersionId: string;
  createdAt: string;
  folderId?: string;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: string;
}

export interface StoreState {
  currentUser: User;
  projects: Project[];
  annotations: Record<string, Annotation[]>; // Keyed by assetVersionId
}

export type ViewMode = 'REVIEW' | 'COMPARE';