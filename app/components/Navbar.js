'use client';

import React, { useState } from 'react';
import { Menu, Search, MapPin, Bell, User } from 'lucide-react';
import { useSidebar } from './context/SidebarContext';
import { useRouter } from 'next/navigation';

const Navbar = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('ward');
  const { toggleSidebar } = useSidebar();
  const router = useRouter();

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      const query = parseInt(searchQuery);
      if (!isNaN(query)) {
        if (searchType === 'ward') {
          router.push(`/wards/${query}`);
        } else if (searchType === 'zone') {
          router.push(`/zones/${query}`);
        }
      }
    }
  };

  return (
    <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-50">
      <div className="flex items-center justify-between px-2 sm:px-4 py-3">
        {/* Left section - Menu and Logo */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          <button 
            onClick={toggleSidebar}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <Menu className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600" />
          </button>
          <div className="flex items-center space-x-2">
            <MapPin className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-600" />
            {/* Hide MapExplorer text on mobile (screens smaller than sm) */}
            <span className="hidden sm:block text-xl font-bold text-slate-800">Ghaziabad Gis System</span>
          </div>
        </div>

        {/* Center section - Search (responsive) */}
        <div className="flex-1 max-w-2xl mx-2 sm:mx-4 lg:mx-8">
          <div className="relative">
            <Search className="absolute left-2 sm:left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
            <input
              type="number"
              placeholder={`Search ${searchType} no...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
              className="w-full pl-8 sm:pl-12 pr-16 sm:pr-28 py-2 sm:py-2.5 bg-slate-100 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-black text-sm sm:text-base"
            />
            <select
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
              className="absolute right-1 sm:right-2 top-1/2 transform -translate-y-1/2 bg-white border border-slate-300 rounded px-1 sm:px-2 py-0.5 sm:py-1 text-xs sm:text-sm text-black"
            >
              <option value="ward">Ward</option>
              <option value="zone">Zone</option>
            </select>
          </div>
        </div>

        {/* Right section - Action buttons */}
        <div className="flex items-center space-x-1 sm:space-x-2">
          <button className="p-1.5 sm:p-2 hover:bg-slate-100 rounded-full transition-colors">
            <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600" />
          </button>
          <button className="p-1.5 sm:p-2 hover:bg-slate-100 rounded-full transition-colors">
            <User className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;