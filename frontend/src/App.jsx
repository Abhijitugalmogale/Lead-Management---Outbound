import React, { useState, useEffect } from 'react';
import './App.css';
import { Navbar } from './components/Navbar';
import { ReviewQueue } from './components/ReviewQueue';
import { DocumentUploader } from './components/DocumentUploader';
import { CollectionRunMonitor } from './components/CollectionRunMonitor';
import { SourceRegistry } from './components/SourceRegistry';
import { api } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('queue');
  const [pendingCount, setPendingCount] = useState(0);

  const refreshCount = async () => {
    try {
      const data = await api.getDiscoveredProjects({ review_status: 'pending_review' });
      if (data && typeof data.total === 'number') {
        setPendingCount(data.total);
      }
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    refreshCount();
  }, []);

  const handleStatsUpdate = (newCount) => {
    if (typeof newCount === 'number') {
      setPendingCount(newCount);
    } else {
      setPendingCount((prev) => Math.max(0, prev - 1));
    }
  };

  const handleUploadSuccess = () => {
    setActiveTab('queue');
    refreshCount();
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
