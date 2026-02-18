import React from 'react';
import '../styles/MaterialTheme.css';

interface MaterialThemeWrapperProps {
  children: React.ReactNode;
}

/**
 * Wraps the application with Material Design global styles.
 * This component is an entry point for the custom theme without modifying the original App.tsx extensively.
 */
export const MaterialThemeWrapper: React.FC<MaterialThemeWrapperProps> = ({ children }) => {
  return <>{children}</>;
};
