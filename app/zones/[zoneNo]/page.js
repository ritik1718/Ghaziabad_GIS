'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { useSidebar } from '@/app/components/context/SidebarContext';

// Dynamically import the map component with no SSR
const MapComponent = dynamic(() => import('@/app/components/mapComponent'), {
  ssr: false,
  loading: () => <div className="w-full h-[500px] rounded shadow border bg-gray-200 flex items-center justify-center">Loading map...</div>
});

const ZonePage = () => {
  const { zoneNo } = useParams();
  const [zoneData, setZoneData] = useState(null);
  const [error, setError] = useState(null);
  
  const { 
    setCurrentZoneWards, 
    setCurrentZoneNo, 
    setIsLoadingWards, 
    clearWardData 
  } = useSidebar();

  // Fetch zone data
  useEffect(() => {
    const fetchZone = async () => {
      try {
        console.log('Fetching zone data for zoneNo:', zoneNo);
        
        const res = await fetch(`http://localhost:8080/api/zones/byZoneNo?zoneNo=${zoneNo}`);
        
        if (!res.ok) {
          throw new Error(`Failed to fetch zone data: ${res.status} ${res.statusText}`);
        }
        
        const data = await res.json();
        console.log('API Response:', data);
        console.log('API Response type:', typeof data);
        console.log('API Response is array:', Array.isArray(data));
        
        // Handle both array and single object responses
        const zoneInfo = Array.isArray(data) ? data[0] : data;
        console.log('Setting zone data:', zoneInfo);
        
        if (!zoneInfo) {
          throw new Error('No zone data found');
        }
        
        setZoneData(zoneInfo);
      } catch (err) {
        console.error('Error fetching zone:', err);
        setError(err.message);
      }
    };

    if (zoneNo) {
      fetchZone();
    }
  }, [zoneNo]);

  // Fetch wards after zone data is loaded
  useEffect(() => {
    const fetchWards = async () => {
      if (!zoneData) return;
      
      setIsLoadingWards(true);
      try {
        console.log('Fetching wards for zone:', zoneNo);
        const res = await fetch(`http://localhost:8080/api/road/allWardsByZoneNo?zoneNo=${zoneNo}`);
        
        if (!res.ok) {
          throw new Error(`Failed to fetch wards: ${res.status} ${res.statusText}`);
        }
        
        const wardData = await res.json();
        console.log('Ward data:', wardData);
        
        setCurrentZoneWards(wardData || []);
        setCurrentZoneNo(zoneNo);
      } catch (error) {
        console.error('Error fetching wards:', error);
        setCurrentZoneWards([]);
      } finally {
        setIsLoadingWards(false);
      }
    };

    fetchWards();
  }, [zoneData, zoneNo]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearWardData();
    };
  }, []);

  if (error) {
    return <div className="text-red-600 p-4">Error: {error}</div>;
  }

  if (!zoneData) {
    return <div className="p-4">Loading zone data...</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold text-slate-800 mb-2">
        Zone {zoneData.zoneNo}: {zoneData.zoneName}
      </h2>
      <p className="text-slate-600 text-sm mb-4">
        Area: {zoneData.areaSqKm?.toFixed(2)} km²
      </p>
      
      <MapComponent zoneData={zoneData} />
    </div>
  );
};

export default ZonePage;