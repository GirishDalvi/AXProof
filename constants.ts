import { AssetType, ProjectStatus, User, Project, AnnotationStatus, Annotation, AnnotationType } from './types';

export const MOCK_USER: User = {
  id: 'u1',
  name: 'Alex Creative',
  email: 'alex@creative.com',
  avatar: 'https://i.pravatar.cc/150?u=u1',
  role: 'ADMIN'
};

export const MOCK_PROJECTS: Project[] = [];

export const MOCK_ANNOTATIONS: Record<string, Annotation[]> = {};
