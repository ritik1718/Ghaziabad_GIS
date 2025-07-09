'use client';
import React, { useEffect } from 'react';
import { Home, Layers, MapPin, BarChart3, Settings, Building } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSidebar } from './context/SidebarContext';

const Sidebar = () => {
  const pathname = usePathname();
  const { 
    sidebarOpen, 
    currentZoneWards, 
    currentZoneNo, 
    isLoadingWards,
    clearWardData 
  } = useSidebar();

  // Clear ward data when not on zone pages
  useEffect(() => {
    if (!pathname.startsWith('/zones/') || pathname === '/zones') {
      clearWardData();
    }
  }, [pathname]);

  const menuItems = [
    {
      icon: Home,
      label: 'Overview',
      href: '/',
      active: pathname === '/'
    },
    {
      icon: MapPin,
      label: 'Zones',
      href: '/allZone',
      active: pathname.startsWith('/allZone')
    },
    {
      icon: Layers,
      label: 'Layer Management',
      href: '/ward+roads',
      active: pathname === '/layers'
    },
    {
      icon: BarChart3,
      label: 'Analytics',
      href: '/data-analytics',
      active: pathname === '/analytics'
    },
    {
      icon: Settings,
      label: 'Settings',
      href: '/settings',
      active: pathname === '/settings'
    }
  ];

  // Check if we're on a specific zone page
  const isOnZonePage = pathname.startsWith('/zones/') && pathname !== '/zones';
  const showWards = isOnZonePage && currentZoneNo;

  return (
    <aside className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-white shadow-sm border-r border-slate-200 min-h-screen transition-all duration-300`}>
      <nav className="p-4 space-y-2">
        {menuItems.map((item, index) => (
          <Link
            key={index}
            href={item.href}
            className={`flex items-center ${sidebarOpen ? 'space-x-3 p-3' : 'justify-center p-3'} hover:bg-slate-100 rounded-lg cursor-pointer transition-colors ${
              item.active
                ? 'bg-emerald-50 text-emerald-700 border-r-2 border-emerald-500'
                : 'text-slate-700'
            }`}
            title={!sidebarOpen ? item.label : undefined}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span className="font-medium">{item.label}</span>}
          </Link>
        ))}

        {sidebarOpen && (
          <div className="mt-8">
            {/* Show Wards when on zone page */}
            {showWards ? (
              <div>
                <div className="flex items-center mb-3 px-3">
                  <Building className="w-4 h-4 mr-2 text-slate-500" />
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                    Zone {currentZoneNo} Wards
                  </h3>
                </div>
                
                {isLoadingWards ? (
                  <div className="px-3 py-2 text-sm text-slate-500">
                    Loading wards...
                  </div>
                ) : (
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {currentZoneWards.length > 0 ? (
                      currentZoneWards.map((ward, index) => {
                        // Extract first ward number for navigation
                        const firstWardNo = ward.wardNo.split(',')[0].trim();
                        
                        return (
                          <Link
                            key={index}
                            href={`/wards/${firstWardNo}`}
                            className="block text-sm text-slate-600 p-3 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors hover:text-emerald-600"
                            title={ward.wardName}
                          >
                            <div className="flex flex-col">
                              <span className="font-medium text-emerald-700">
                                Ward {ward.wardNo}
                              </span>
                              <span className="text-xs text-slate-500 mt-1 line-clamp-2">
                                {ward.wardName}
                              </span>
                            </div>
                          </Link>
                        );
                      })
                    ) : (
                      <div className="px-3 py-2 text-sm text-slate-500">
                        No wards found
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Show Quick Navigation when not on zone page */
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 px-3">
                  Quick Navigation
                </h3>
                <div className="space-y-1">
                  <Link
                    href="/zones"
                    className="block text-sm text-slate-600 p-3 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                  >
                    All Zones
                  </Link>
                  <Link
                    href="/recent"
                    className="block text-sm text-slate-600 p-3 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                  >
                    Recent Areas
                  </Link>
                  <Link
                    href="/favorites"
                    className="block text-sm text-slate-600 p-3 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                  >
                    Favorites
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </nav>
    </aside>
  );
};

export default Sidebar;