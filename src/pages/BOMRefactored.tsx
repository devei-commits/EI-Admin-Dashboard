import React, { useState } from 'react';
import logoFull from '../assets/logo/eilogofull.svg';

const BOMRefactored: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-blue-50 to-cyan-50">
      {/* Header */}
      <div className="border-b border-yellow-200 bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <img src={logoFull} alt="Esthetic Insights" className="h-10 object-contain" />
          <div>
            <h1 className="text-2xl font-extrabold bg-linear-to-r from-yellow-600 to-blue-600 bg-clip-text text-transparent font-archivo">
              BOM Management
            </h1>
            <p className="text-xs text-slate-500 font-outfit">Products Master Dashboard</p>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center min-h-150">
          <div className="text-center">
            <div className="mb-4">
              <svg className="animate-spin h-12 w-12 text-yellow-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <p className="text-slate-600 font-outfit">Loading Products Master...</p>
          </div>
        </div>
      )}

      {/* Iframe Container */}
      <div className={`relative w-full transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
        <iframe
          src="https://estheticinsights.com/ops/products-master.php"
          title="Products Master Dashboard"
          onLoad={handleIframeLoad}
          className="w-full border-0"
          style={{
            minHeight: 'calc(100vh - 120px)',
            display: isLoading ? 'none' : 'block',
          }}
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation"
        />
      </div>

      {/* Footer Info */}
      <div className="border-t border-yellow-200 bg-white mt-8 py-4 text-center">
        <p className="text-xs text-slate-500 font-outfit">
          Powered by Esthetic Insights © 2025
        </p>
      </div>
    </div>
  );
};

export default BOMRefactored;
