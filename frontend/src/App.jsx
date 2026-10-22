import React, { useState } from 'react';
import './App.css';
import { Navbar } from './components/Navbar';
import { ReviewQueue } from './components/ReviewQueue';
import { DocumentUploader } from './components/DocumentUploader';
import { CollectionRunMonitor } from './components/CollectionRunMonitor';
import { SourceRegistry } from './components/SourceRegistry';

export default function App() {
  const [activeTab, setActiveTab] = useState('queue');
  const [pendingCount, setPendingCount] = useState(4);

  const handleStatsUpdate = () => {
    setPendingCount((prev) => Math.max(0, prev - 1));
  };

  const handleUploadSuccess = () => {
    // Switch to queue after successful upload
    setActiveTab('queue');
    setPendingCount((prev) => prev + 5);
  };

  return (
    <div className="app-wrapper">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingCount={pendingCount}
      />

      {/* Main Tab Content */}
      <main className="main-content">
        {activeTab === 'queue' && (
          <ReviewQueue onStatsUpdate={handleStatsUpdate} />
        )}

        {activeTab === 'upload' && (
          <DocumentUploader onUploadSuccess={handleUploadSuccess} />
        )}

        {activeTab === 'runs' && (
          <CollectionRunMonitor />
        )}

        {activeTab === 'sources' && (
          <SourceRegistry />
        )}
      </main>
    </div>
  );
}
