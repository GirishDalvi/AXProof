import React from 'react';
import { ProjectStatus, AnnotationStatus } from '../../types';

interface BadgeProps {
  status: ProjectStatus | AnnotationStatus | string;
}

export const Badge: React.FC<BadgeProps> = ({ status }) => {
  let colorClass = 'bg-gray-100 text-gray-800';

  switch (status) {
    case ProjectStatus.APPROVED:
    case AnnotationStatus.RESOLVED:
      colorClass = 'bg-green-100 text-green-800';
      break;
    case ProjectStatus.CHANGES_REQUIRED:
      colorClass = 'bg-red-100 text-red-800';
      break;
    case ProjectStatus.IN_REVIEW:
    case AnnotationStatus.OPEN:
      colorClass = 'bg-blue-100 text-blue-800';
      break;
    case ProjectStatus.WAITING_FOR_REVIEW:
      colorClass = 'bg-purple-100 text-purple-800';
      break;
    case AnnotationStatus.IN_PROGRESS:
      colorClass = 'bg-yellow-100 text-yellow-800';
      break;
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
};