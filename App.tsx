import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AXProofProvider, useAXProof } from './context/ZflowContext';
import { Dashboard } from './components/Dashboard';
import { ReviewRoom } from './components/ReviewRoom';
import { Login } from './components/Login';

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { currentUser, isLoading } = useAXProof();
    if (isLoading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
    if (!currentUser) return <Login />;
    return children;
};

const App: React.FC = () => {
  return (
    <AXProofProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={
              <ProtectedRoute>
                  <Dashboard />
              </ProtectedRoute>
          } />
          <Route path="/project/:id" element={
              <ProtectedRoute>
                  <ReviewRoom />
              </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AXProofProvider>
  );
};

export default App;