'use client';
import React, { useState, useEffect } from 'react';
import { ChevronRight, Layers, MapPin, BarChart3 } from 'lucide-react';
import Link from 'next/link';

const HomePage = () => {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const colors = [
    'bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500',
    'bg-teal-500', 'bg-indigo-500', 'bg-rose-500', 'bg-amber-500',
    'bg-cyan-500', 'bg-lime-500'
  ];

  useEffect(() => {
    const fetchZonesWithWards = async () => {
      try {
        setLoading(true);
        const res = await fetch('http://localhost:8080/api/zones/alldata');
        if (!res.ok) throw new Error('Failed to fetch zones');

        const zonesData = await res.json();

        const zonesWithWards = await Promise.all(
          zonesData.map(async (zone, index) => {
            const wardRes = await fetch(`http://localhost:8080/api/road/countWards?zoneNo=${zone.zoneNo}`);
            const wardCount = wardRes.ok ? await wardRes.json() : 0;

            return {
              id: zone.gid,
              name: `Zone ${zone.zoneNo} - ${zone.zoneName}`,
              zoneName: zone.zoneName,
              zoneNo: zone.zoneNo,
              totalNoOfWards: wardCount,
              area: zone.areaSqKm,
              color: colors[index % colors.length],
              wkt: zone.wkt
            };
          })
        );

        setZones(zonesWithWards);
      } catch (err) {
        console.error('Error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchZonesWithWards();
  }, []);

  const totalZones = zones.length;
  const totalArea = zones.reduce((sum, z) => sum + z.area, 0);
  const totalWards = zones.reduce((sum, z) => sum + z.totalNoOfWards, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-red-800">Error</h3>
        <p className="text-sm text-red-700 mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center space-x-2 mb-6 bg-white p-4 rounded-lg shadow-sm">
        <span className="text-slate-600 font-medium">Ghaziabad</span>
      </div>

      <div className="mb-6">
        <div className="flex items-center space-x-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-4 rounded-lg">
          <Layers className="w-6 h-6" />
          <div>
            <h2 className="text-2xl font-bold">City Overview</h2>
            <p className="text-emerald-100">Explore zones within Ghaziabad</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {zones.map((zone) => (
 <Link
  key={zone.id}
  href={`/zones/${zone.id}`} // ✅ Clean route
>

            <div className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-all cursor-pointer transform hover:-translate-y-1">
              <div className={`h-2 ${zone.color} rounded-t-lg`}></div>
              <div className="p-6">
                <h3 className="font-semibold text-slate-800 mb-2">{zone.name}</h3>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-500">{zone.area.toFixed(2)} km²</span>
                  </div>
                  <div className={`w-4 h-4 ${zone.color} rounded-full`}></div>
                </div>
                <div className="text-xs text-slate-400 mb-2">
                  Total no of wards: <strong>{zone.totalNoOfWards}</strong>
                </div>
                <div className="mt-4 flex justify-between items-center">
                  <span className="text-xs text-slate-400 uppercase tracking-wide">Zone Details</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-12 bg-white p-6 rounded-lg shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600">{totalZones}</div>
            <div className="text-sm text-slate-500">Total Zones</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{totalArea.toFixed(1)}</div>
            <div className="text-sm text-slate-500">Total Area (km²)</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{(totalArea / totalZones).toFixed(1)}</div>
            <div className="text-sm text-slate-500">Avg Area/Zone</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{totalWards}</div>
            <div className="text-sm text-slate-500">Total Wards</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
