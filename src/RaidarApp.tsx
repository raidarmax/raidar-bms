import { useState } from 'react';
import TrackingDashboard from './pages/TrackingDashboard';
import APIDocumentation from './pages/APIDocumentation';
import { Map, BookOpen } from 'lucide-react';

export default function RaidarApp() {
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'docs'>('dashboard');

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b shadow-sm">
        <div className="max-w-full px-6 py-3">
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage('dashboard')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                currentPage === 'dashboard'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Map className="w-5 h-5" />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => setCurrentPage('docs')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                currentPage === 'docs'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <BookOpen className="w-5 h-5" />
              <span>API Documentation</span>
            </button>
          </div>
        </div>
      </nav>

      {currentPage === 'dashboard' ? <TrackingDashboard /> : <APIDocumentation />}
    </div>
  );
}
