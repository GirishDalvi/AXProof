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
      colorClass = 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/50';
      break;
    case ProjectStatus.CHANGES_REQUIRED:
      colorClass = 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50';
      break;
    case ProjectStatus.IN_REVIEW:
    case AnnotationStatus.OPEN:
      colorClass = 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50';
      break;
    case ProjectStatus.WAITING_FOR_REVIEW:
      colorClass = 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800/50';
      break;
    case AnnotationStatus.IN_PROGRESS:
      colorClass = 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800/50';
      break;
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${colorClass}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
};