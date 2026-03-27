import { openDB, DBSchema } from 'idb';
import { Project, Annotation, Folder, User, SavedFile } from './types';

interface AXProofDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
  };
  annotations: {
    key: string;
    value: Annotation;
    indexes: { 'by-version': string };
  };
  assets: {
    key: string; // versionId or attachmentId
    value: Blob; // The original file (zip, video, image)
  };
  folders: {
    key: string;
    value: Folder;
  };
  users: {
    key: string; // email
    value: User;
  };
  saved_files: {
    key: string;
    value: SavedFile;
  };
}

const DB_NAME = 'axproof-db';
const DB_VERSION = 4; // Incremented for saved_files store

export const initDB = async () => {
  return openDB<AXProofDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('annotations')) {
        const store = db.createObjectStore('annotations', { keyPath: 'id' });
        store.createIndex('by-version', 'assetVersionId');
      }
      if (!db.objectStoreNames.contains('assets')) {
        db.createObjectStore('assets');
      }
      if (!db.objectStoreNames.contains('folders')) {
        db.createObjectStore('folders', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('users')) {
        db.createObjectStore('users', { keyPath: 'email' });
      }
      if (!db.objectStoreNames.contains('saved_files')) {
        db.createObjectStore('saved_files', { keyPath: 'id' });
      }
    },
  });
};

export const db = {
  async getProjects() {
    const db = await initDB();
    return db.getAll('projects');
  },
  async saveProject(project: Project) {
    const db = await initDB();
    return db.put('projects', project);
  },
  async deleteProject(id: string) {
    const db = await initDB();
    return db.delete('projects', id);
  },
  async getAnnotations() {
    const db = await initDB();
    return db.getAll('annotations');
  },
  async saveAnnotation(annotation: Annotation) {
    const db = await initDB();
    return db.put('annotations', annotation);
  },
  async saveAsset(id: string, file: Blob) {
    const db = await initDB();
    return db.put('assets', file, id);
  },
  async getAsset(id: string) {
    const db = await initDB();
    return db.get('assets', id);
  },
  async deleteAsset(id: string) {
    const db = await initDB();
    return db.delete('assets', id);
  },
  async deleteAnnotation(id: string) {
    const db = await initDB();
    return db.delete('annotations', id);
  },
  async getFolders() {
    const db = await initDB();
    return db.getAll('folders');
  },
  async saveFolder(folder: Folder) {
    const db = await initDB();
    return db.put('folders', folder);
  },
  async deleteFolder(id: string) {
    const db = await initDB();
    return db.delete('folders', id);
  },
  async getUser(email: string) {
    const db = await initDB();
    return db.get('users', email);
  },
  async saveUser(user: User) {
    const db = await initDB();
    return db.put('users', user);
  },
  async getSavedFiles() {
    const db = await initDB();
    return db.getAll('saved_files');
  },
  async saveSavedFile(file: SavedFile) {
    const db = await initDB();
    return db.put('saved_files', file);
  },
  async deleteSavedFile(id: string) {
    const db = await initDB();
    await db.delete('saved_files', id);
    await db.delete('assets', id);
  }
};