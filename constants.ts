import { AssetType, ProjectStatus, User, Project, AnnotationStatus, Annotation, AnnotationType } from './types';

export const MOCK_USER: User = {
  id: 'u1',
  name: 'Alex Creative',
  email: 'alex@creative.com',
  avatar: 'https://i.pravatar.cc/150?u=u1',
  role: 'ADMIN'
};

export const MOCK_PROJECTS: Project[] = [
  {
    id: 'p1',
    name: 'Nike Summer Campaign - Social',
    clientName: 'Nike',
    status: ProjectStatus.IN_REVIEW,
    thumbnail: 'https://picsum.photos/400/225?random=1',
    currentVersionId: 'v1-2',
    createdAt: '2023-10-25T10:00:00Z',
    versions: [
      {
        id: 'v1-2',
        versionNumber: 2,
        assetType: AssetType.VIDEO,
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        uploadDate: '2023-10-26T14:30:00Z',
        fileSize: '15.4 MB',
        dimensions: '1920x1080',
        fileName: 'social_cut_v2.mp4',
        status: 'IN_REVIEW'
      },
      {
        id: 'v1-1',
        versionNumber: 1,
        assetType: AssetType.VIDEO,
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        uploadDate: '2023-10-25T10:00:00Z',
        fileSize: '14.2 MB',
        dimensions: '1920x1080',
        fileName: 'social_cut_v1.mp4',
        status: 'IN_REVIEW'
      }
    ]
  },
  {
    id: 'p2',
    name: 'Q4 Financial Report Banner',
    clientName: 'Goldman Sachs',
    status: ProjectStatus.CHANGES_REQUIRED,
    thumbnail: 'https://picsum.photos/400/300?random=2',
    currentVersionId: 'v2-1',
    createdAt: '2023-10-24T09:00:00Z',
    versions: [
      {
        id: 'v2-1',
        versionNumber: 1,
        assetType: AssetType.IMAGE,
        url: 'https://picsum.photos/1200/800?random=2',
        uploadDate: '2023-10-24T09:00:00Z',
        fileSize: '2.1 MB',
        dimensions: '1200x800',
        fileName: 'banner_final.jpg',
        status: 'IN_REVIEW'
      }
    ]
  },
  {
    id: 'p3',
    name: 'Newsletter Template Oct',
    clientName: 'Spotify',
    status: ProjectStatus.APPROVED,
    thumbnail: 'https://picsum.photos/400/600?random=3',
    currentVersionId: 'v3-3',
    createdAt: '2023-10-20T11:00:00Z',
    versions: [
      {
        id: 'v3-3',
        versionNumber: 3,
        assetType: AssetType.HTML,
        url: 'about:blank', // Mock HTML
        uploadDate: '2023-10-27T16:00:00Z',
        fileSize: '450 KB',
        dimensions: 'Responsive',
        fileName: 'newsletter.html',
        status: 'IN_REVIEW' // Even though project is approved, let's keep version status flexible for mock
      }
    ]
  }
];

export const MOCK_ANNOTATIONS: Record<string, Annotation[]> = {
  'v1-2': [
    {
      id: 'a1',
      assetVersionId: 'v1-2',
      pinNumber: 1,
      type: AnnotationType.PIN,
      x: 20,
      y: 30,
      timestamp: 5.2,
      text: 'Logo needs to be larger here.',
      authorId: 'u2',
      createdAt: '2023-10-26T14:35:00Z',
      status: AnnotationStatus.OPEN,
      replies: []
    },
    {
      id: 'a2',
      assetVersionId: 'v1-2',
      pinNumber: 2,
      type: AnnotationType.BOX,
      x: 45,
      y: 45,
      width: 10,
      height: 10,
      timestamp: 12.5,
      text: 'Color grading is a bit too dark in this scene.',
      authorId: 'u1',
      createdAt: '2023-10-26T14:40:00Z',
      status: AnnotationStatus.RESOLVED,
      replies: [
        { id: 'r1', text: 'Fixed in next version', authorId: 'u3', createdAt: '2023-10-26T15:00:00Z'}
      ]
    }
  ],
  'v2-1': [
    {
      id: 'a3',
      assetVersionId: 'v2-1',
      pinNumber: 1,
      type: AnnotationType.PIN,
      x: 75,
      y: 20,
      text: 'Typo in the headline.',
      authorId: 'u1',
      createdAt: '2023-10-24T09:15:00Z',
      status: AnnotationStatus.OPEN,
      replies: []
    }
  ]
};