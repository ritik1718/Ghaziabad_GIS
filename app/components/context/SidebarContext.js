'use client';

import React, { createContext, useContext, useState } from 'react';

const SidebarContext = createContext();

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

export const SidebarProvider = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentZoneWards, setCurrentZoneWards] = useState([]);
  const [currentZoneNo, setCurrentZoneNo] = useState(null);
  const [isLoadingWards, setIsLoadingWards] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  const openSidebar = () => {
    setSidebarOpen(true);
  };

  const clearWardData = () => {
    setCurrentZoneWards([]);
    setCurrentZoneNo(null);
    setIsLoadingWards(false);
  };

  return (
    <SidebarContext.Provider value={{
      sidebarOpen,
      toggleSidebar,
      closeSidebar,
      openSidebar,
      currentZoneWards,
      setCurrentZoneWards,
      currentZoneNo,
      setCurrentZoneNo,
      isLoadingWards,
      setIsLoadingWards,
      clearWardData
    }}>
      {children}
    </SidebarContext.Provider>
  );
};

export default SidebarContext;