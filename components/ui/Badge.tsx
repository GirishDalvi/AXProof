import React from 'react';
import { ProjectStatus, AnnotationStatus } from '../../types';

interface BadgeProps {
  status: ProjectStatus | AnnotationStatus | string;
}

export const Badge: React.FC<BadgeProps> = ({ status }) => {
  let colorClass = 'bg-surface text-text-secondary border border-border-color';

  switch (status) {
    case ProjectStatus.APPROVED:
    case AnnotationStatus.RESOLVED:
      colorClass = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      break;
    case ProjectStatus.CHANGES_REQUIRED:
      colorClass = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      break;
    case ProjectStatus.IN_REVIEW:
    case AnnotationStatus.OPEN:
      colorClass = 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      break;
    case ProjectStatus.WAITING_FOR_REVIEW:
      colorClass = 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      break;
    case AnnotationStatus.IN_PROGRESS:
      colorClass = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      break;
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
};