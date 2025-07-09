'use client';
import React, { useState, useEffect } from 'react';
import { BarChart3, PieChart, TrendingUp, Activity, Layers, MapPin, Users, Target, ArrowUp, ArrowDown, AlertTriangle, Navigation, Building } from 'lucide-react';
import { 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  LineChart, 
  Line,
  Area,
  AreaChart,
  ComposedChart
} from 'recharts';

const DataAnalyticsPage = () => {
  const [zones, setZones] = useState([]);
  const [wards, setWards] = useState([]);
  const [roads, setRoads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState('area');

  const chartColors = [
    '#10b981', '#3b82f6', '#8b5cf6', '#f97316',
    '#14b8a6', '#6366f1', '#f43f5e', '#f59e0b',
    '#06b6d4', '#84cc16', '#ef4444', '#8b5cf6'
  ];

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);
        
        // Fetch zones data
        const zonesRes = await fetch('http://localhost:8080/api/zones/alldata');
        if (!zonesRes.ok) throw new Error('Failed to fetch zones');
        const zonesData = await zonesRes.json();

        // Fetch wards data
        const wardsRes = await fetch('http://localhost:8080/api/ward/all');
        if (!wardsRes.ok) throw new Error('Failed to fetch wards');
        const wardsData = await wardsRes.json();

        // Fetch roads data
        const roadsRes = await fetch('http://localhost:8080/api/road/all');
        if (!roadsRes.ok) throw new Error('Failed to fetch roads');
        const roadsData = await roadsRes.json();

        // Process zones with ward counts
        const zonesWithWards = await Promise.all(
          zonesData.map(async (zone, index) => {
            const wardRes = await fetch(`http://localhost:8080/api/road/countWards?zoneNo=${zone.zoneNo}`);
            const wardCount = wardRes.ok ? await wardRes.json() : 0;

            // Calculate additional metrics from wards and roads
            const zoneWards = wardsData.filter(ward => ward.wardNo && roadsData.some(road => road.wardNo === ward.wardNo && road.zoneNo === zone.zoneNo));
            const zoneRoads = roadsData.filter(road => road.zoneNo === zone.zoneNo);
            
            const totalRoadLength = zoneRoads.reduce((sum, road) => sum + (road.lengthMet || 0), 0);
            const avgRoadWidth = zoneRoads.length > 0 ? zoneRoads.reduce((sum, road) => sum + (road.rowMeter || 0), 0) / zoneRoads.length : 0;

            return {
              id: zone.gid,
              zoneName: zone.zoneName,
              zoneNo: zone.zoneNo,
              totalNoOfWards: wardCount,
              area: zone.areaSqKm,
              chartColor: chartColors[index % chartColors.length],
              density: parseFloat((wardCount / zone.areaSqKm).toFixed(2)),
              efficiency: parseFloat(((wardCount * 100) / zone.areaSqKm).toFixed(2)),
              totalRoads: zoneRoads.length,
              totalRoadLength: parseFloat(totalRoadLength.toFixed(2)),
              avgRoadWidth: parseFloat(avgRoadWidth.toFixed(2)),
              roadDensity: parseFloat((totalRoadLength / zone.areaSqKm).toFixed(2))
            };
          })
        );

        setZones(zonesWithWards);
        setWards(wardsData);
        setRoads(roadsData);
      } catch (err) {
        console.error('Error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-600 text-lg">Loading Analytics Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-red-800 text-center mb-2">Error Loading Data</h3>
          <p className="text-red-700 text-center">{error}</p>
        </div>
      </div>
    );
  }

  // Calculate metrics
  const totalZones = zones.length;
  const totalArea = zones.reduce((sum, z) => sum + z.area, 0);
  const totalWards = zones.reduce((sum, z) => sum + z.totalNoOfWards, 0);
  const totalRoads = zones.reduce((sum, z) => sum + z.totalRoads, 0);
  const totalRoadLength = zones.reduce((sum, z) => sum + z.totalRoadLength, 0);
  const avgDensity = zones.reduce((sum, z) => sum + z.density, 0) / totalZones;
  const avgRoadDensity = zones.reduce((sum, z) => sum + z.roadDensity, 0) / totalZones;

  // Road condition analysis
  const roadConditions = roads.reduce((acc, road) => {
    const condition = road.condition || 'Unknown';
    acc[condition] = (acc[condition] || 0) + 1;
    return acc;
  }, {});

  const roadConditionData = Object.entries(roadConditions).map(([condition, count], index) => ({
    name: condition,
    value: count,
    fill: chartColors[index % chartColors.length]
  }));

  // Road ownership analysis
  const roadOwnership = roads.reduce((acc, road) => {
    const ownership = road.ownership || 'Unknown';
    acc[ownership] = (acc[ownership] || 0) + 1;
    return acc;
  }, {});

  const roadOwnershipData = Object.entries(roadOwnership).map(([ownership, count], index) => ({
    name: ownership,
    value: count,
    fill: chartColors[index % chartColors.length]
  }));

  // Data for charts
  const pieChartData = zones.map(zone => ({
    name: zone.zoneName,
    value: zone.area,
    fill: zone.chartColor
  }));

  const barChartData = zones.map(zone => ({
    name: zone.zoneName,
    area: parseFloat(zone.area.toFixed(2)),
    wards: zone.totalNoOfWards,
    roads: zone.totalRoads,
    density: zone.density,
    roadLength: zone.totalRoadLength,
    roadDensity: zone.roadDensity
  }));

  const areaChartData = zones.map((zone, index) => ({
    name: zone.zoneName,
    area: zone.area,
    wards: zone.totalNoOfWards,
    roads: zone.totalRoads,
    cumulative: zones.slice(0, index + 1).reduce((sum, z) => sum + z.area, 0)
  }));

  // Ward area analysis
  const wardAreaData = wards.slice(0, 10).map(ward => ({
    name: ward.wardName,
    area: parseFloat((ward.area / 1000000).toFixed(2)) // Convert to km²
  }));

  // Find extremes
  const largestZone = zones.reduce((max, zone) => zone.area > max.area ? zone : max, zones[0]);
  const smallestZone = zones.reduce((min, zone) => zone.area < min.area ? zone : min, zones[0]);
  const mostWards = zones.reduce((max, zone) => zone.totalNoOfWards > max.totalNoOfWards ? zone : max, zones[0]);
  const mostRoads = zones.reduce((max, zone) => zone.totalRoads > max.totalRoads ? zone : max, zones[0]);
  const highestDensity = zones.reduce((max, zone) => zone.density > max.density ? zone : max, zones[0]);
  const longestRoadZone = zones.reduce((max, zone) => zone.totalRoadLength > max.totalRoadLength ? zone : max, zones[0]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-8 h-8 text-blue-600" />
                <h1 className="text-2xl font-bold text-slate-800">Analytics Dashboard</h1>
              </div>
            </div>
            <div className="text-sm text-slate-500">
              Ghaziabad Zone Analytics
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Layers className="w-6 h-6 text-blue-600" />
              </div>
              <ArrowUp className="w-4 h-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-slate-800 mb-1">{totalZones}</div>
            <div className="text-sm text-slate-500">Total Zones</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <MapPin className="w-6 h-6 text-emerald-600" />
              </div>
              <ArrowUp className="w-4 h-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-slate-800 mb-1">{totalArea.toFixed(1)}</div>
            <div className="text-sm text-slate-500">Total Area (km²)</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <ArrowUp className="w-4 h-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-slate-800 mb-1">{totalWards}</div>
            <div className="text-sm text-slate-500">Total Wards</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Navigation className="w-6 h-6 text-orange-600" />
              </div>
              <ArrowUp className="w-4 h-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-slate-800 mb-1">{totalRoads}</div>
            <div className="text-sm text-slate-500">Total Roads</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-teal-100 rounded-lg">
                <Activity className="w-6 h-6 text-teal-600" />
              </div>
              <ArrowUp className="w-4 h-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-slate-800 mb-1">{totalRoadLength.toFixed(1)}</div>
            <div className="text-sm text-slate-500">Road Length (m)</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Target className="w-6 h-6 text-indigo-600" />
              </div>
              <ArrowUp className="w-4 h-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-slate-800 mb-1">{avgDensity.toFixed(2)}</div>
            <div className="text-sm text-slate-500">Avg Density</div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Area Distribution Pie Chart */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <PieChart className="w-5 h-5 text-blue-500" />
                <h3 className="text-lg font-semibold text-slate-800">Area Distribution</h3>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <RechartsPieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value.toFixed(2)} km²`, 'Area']} />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>

          {/* Road Conditions Pie Chart */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <Navigation className="w-5 h-5 text-emerald-500" />
                <h3 className="text-lg font-semibold text-slate-800">Road Conditions</h3>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <RechartsPieChart>
                <Pie
                  data={roadConditionData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {roadConditionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [value, 'Roads']} />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Advanced Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Multi-metric Analysis */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-orange-500" />
                <h3 className="text-lg font-semibold text-slate-800">Zone Metrics Comparison</h3>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  fontSize={12}
                />
                <YAxis yAxisId="left" orientation="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="wards" fill="#10b981" name="Wards" />
                <Bar yAxisId="left" dataKey="roads" fill="#3b82f6" name="Roads" />
                <Line yAxisId="right" type="monotone" dataKey="density" stroke="#f97316" strokeWidth={3} name="Density" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Road Ownership Analysis */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <Building className="w-5 h-5 text-purple-500" />
                <h3 className="text-lg font-semibold text-slate-800">Road Ownership</h3>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={roadOwnershipData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  fontSize={12}
                />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Road Length Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Road Length by Zone */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-teal-500" />
                <h3 className="text-lg font-semibold text-slate-800">Road Length by Zone</h3>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  fontSize={12}
                />
                <YAxis />
                <Tooltip formatter={(value) => [value, 'Length (m)']} />
                <Bar dataKey="roadLength" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top 10 Wards by Area */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <MapPin className="w-5 h-5 text-indigo-500" />
                <h3 className="text-lg font-semibold text-slate-800">Top 10 Wards by Area</h3>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={wardAreaData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  fontSize={12}
                />
                <YAxis />
                <Tooltip formatter={(value) => [`${value} km²`, 'Area']} />
                <Bar dataKey="area" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Insights Panel */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Key Insights & Analytics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg">
              <div className="text-sm text-blue-600 mb-1">Largest Zone</div>
              <div className="font-semibold text-blue-800">{largestZone?.zoneName}</div>
              <div className="text-xs text-blue-600">{largestZone?.area.toFixed(2)} km²</div>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 rounded-lg">
              <div className="text-sm text-emerald-600 mb-1">Most Wards</div>
              <div className="font-semibold text-emerald-800">{mostWards?.zoneName}</div>
              <div className="text-xs text-emerald-600">{mostWards?.totalNoOfWards} wards</div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg">
              <div className="text-sm text-orange-600 mb-1">Most Roads</div>
              <div className="font-semibold text-orange-800">{mostRoads?.zoneName}</div>
              <div className="text-xs text-orange-600">{mostRoads?.totalRoads} roads</div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg">
              <div className="text-sm text-purple-600 mb-1">Longest Roads</div>
              <div className="font-semibold text-purple-800">{longestRoadZone?.zoneName}</div>
              <div className="text-xs text-purple-600">{longestRoadZone?.totalRoadLength.toFixed(1)} m</div>
            </div>
            <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-4 rounded-lg">
              <div className="text-sm text-teal-600 mb-1">Highest Density</div>
              <div className="font-semibold text-teal-800">{highestDensity?.zoneName}</div>
              <div className="text-xs text-teal-600">{highestDensity?.density} wards/km²</div>
            </div>
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 rounded-lg">
              <div className="text-sm text-indigo-600 mb-1">Smallest Zone</div>
              <div className="font-semibold text-indigo-800">{smallestZone?.zoneName}</div>
              <div className="text-xs text-indigo-600">{smallestZone?.area.toFixed(2)} km²</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataAnalyticsPage;