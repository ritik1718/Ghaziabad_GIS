'use client';

import React, { useEffect, useRef, useState } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import { OSM } from 'ol/source';
import { Vector as VectorSource } from 'ol/source';
import { WKT } from 'ol/format';
import { Style, Stroke, Fill, Circle as CircleStyle } from 'ol/style';
import { Draw } from 'ol/interaction';
import { getLength, getArea } from 'ol/sphere';
import Overlay from 'ol/Overlay';
import 'ol/ol.css';
import * as XLSX from 'xlsx';


const colorMap = {
  Good: 'green',
  Moderate: 'orange',
  Poor: 'red'
};

const carriageColorMap = {
  'Single Carriageway': '#3498db',
  'Double Carriageway': '#9b59b6',
  'Mixed': '#2ecc71'
};


const AllRoadsPage = () => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tooltipRef = useRef(null);
  const [wardData, setWardData] = useState([]);
  const [roadData, setRoadData] = useState([]);
  const [multiWardRoads, setMultiWardRoads] = useState([]);
  const [selectedWard, setSelectedWard] = useState(null);
  const [selectedRoads, setSelectedRoads] = useState([]);
  const [showWards, setShowWards] = useState(true);
  const [showRoads, setShowRoads] = useState(true);
  const [showMultiWardRoads, setShowMultiWardRoads] = useState(true);
  const [conditionFilter, setConditionFilter] = useState(['Good', 'Moderate', 'Poor']);
  const [onlySelected, setOnlySelected] = useState(false);
  const [measureMode, setMeasureMode] = useState(null);
  const [carriageTypes, setCarriageTypes] = useState([]);
const [selectedCarriage, setSelectedCarriage] = useState('');


  useEffect(() => {
    const fetchWards = async () => {
      const res = await fetch('http://localhost:8080/api/ward/all');
      setWardData(await res.json());
    };

    const fetchRoads = async () => {
     const res = await fetch('http://localhost:8080/api/road/all');
const data = await res.json();
setRoadData(data);

const types = [...new Set(data.map(r => r.carriageM).filter(Boolean))];
setCarriageTypes(types);

    };

    const fetchMultiWardRoads = async () => {
      const res = await fetch('http://localhost:8080/api/road/multi-ward-roads');
      setMultiWardRoads(await res.json());
    };

    fetchWards();
    fetchRoads();
    fetchMultiWardRoads();
  }, []);

  useEffect(() => {
    if (!mapRef.current || wardData.length === 0) return;
    if (mapInstanceRef.current) mapInstanceRef.current.setTarget(null);

    const baseLayer = new TileLayer({ source: new OSM() });
    const wktFormat = new WKT();
    const wardSource = new VectorSource();
    const roadSource = new VectorSource();
    const measureSource = new VectorSource();

    // Wards
    wardData.forEach((ward) => {
      const show = onlySelected ? selectedWard?.gid === ward.gid : showWards;
      if (!ward.wkt || !show) return;
      try {
        const feature = wktFormat.readFeature(ward.wkt.replace(/^"+|"+$/g, ''), {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:4326'
        });
        feature.setProperties({ ...ward, type: 'ward' });
        feature.setStyle(new Style({
          stroke: new Stroke({ color: '#003366', width: selectedWard?.gid === ward.gid ? 6 : 3 }),
          fill: new Fill({ color: 'rgba(0,0,0,0.05)' })
        }));
        wardSource.addFeature(feature);
      } catch (err) {
        console.error('Ward parse error:', ward.wardNo);
      }
    });

    // Normal Roads
    roadData.forEach((road) => {
      const matchCondition = conditionFilter.includes(road.condition);
const matchCarriage = selectedCarriage === '' || road.carriageM === selectedCarriage;
const show = onlySelected
  ? selectedRoads.some(r => r.gid === road.gid)
  : showRoads && matchCondition && matchCarriage;

      if (!road.wkt || !show) return;
      try {
        const feature = wktFormat.readFeature(road.wkt.replace(/^"+|"+$/g, ''), {
          dataProjection: 'EPSG:32644',
          featureProjection: 'EPSG:4326'
        });
        feature.setProperties({ ...road, type: 'road' });
        feature.setStyle(new Style({
          stroke: new Stroke({
            color: colorMap[road.condition] || 'gray',
            width: selectedRoads.some(r => r.gid === road.gid) ? 5 : 2
          })
        }));
        roadSource.addFeature(feature);
      } catch (err) {
        console.error('Road parse error:', road.roadName);
      }
    });

    // Multi-Ward Roads
    if (showMultiWardRoads) {
      multiWardRoads.forEach((road) => {
        const matchCondition = conditionFilter.includes(road.condition);
        if (!road.wkt || !matchCondition) return;
        try {
          const feature = wktFormat.readFeature(road.wkt.replace(/^"+|"+$/g, ''), {
            dataProjection: 'EPSG:32644',
            featureProjection: 'EPSG:4326'
          });
          feature.setProperties({ ...road, type: 'multi-road' });
          feature.setStyle(new Style({
            stroke: new Stroke({
color: selectedCarriage
  ? carriageColorMap[road.carriageM] || 'gray'
  : colorMap[road.condition] || 'gray',
              width: 6
            })
          }));
          roadSource.addFeature(feature);
        } catch (err) {
          console.error('Multi-ward road parse error:', road.roadName);
        }
      });
    }

    const map = new Map({
      target: mapRef.current,
      layers: [
        baseLayer,
        new VectorLayer({ source: wardSource }),
        new VectorLayer({ source: roadSource }),
        new VectorLayer({ source: measureSource })
      ],
      view: new View({
        center: [77.45, 28.7],
        zoom: 12,
        projection: 'EPSG:4326'
      })
    });

    mapInstanceRef.current = map;

    // Tooltip overlay
    const tooltip = document.createElement('div');
    tooltip.className = 'absolute bg-white text-black text-xs px-2 py-1 border rounded shadow z-50';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.display = 'none';
    tooltipRef.current = new Overlay({ element: tooltip, offset: [10, 0], positioning: 'bottom-left' });
    map.addOverlay(tooltipRef.current);
    mapRef.current.appendChild(tooltip);

    map.on('pointermove', (e) => {
      const feature = map.forEachFeatureAtPixel(e.pixel, f => f);
      if (feature && ['road', 'multi-road'].includes(feature.get('type'))) {
        const props = feature.getProperties();
        tooltip.innerHTML = `<b>${props.roadName}</b><br/>Condition: ${props.condition}`;
        tooltip.style.display = 'block';
        tooltipRef.current.setPosition(e.coordinate);
      } else {
        tooltip.style.display = 'none';
      }
    });

    map.on('singleclick', (evt) => {
      const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f);
      if (!feature) return;
      const props = feature.getProperties();
      if (props.type === 'ward') {
        setSelectedWard(props);
      } else if (['road', 'multi-road'].includes(props.type)) {
        setSelectedRoads((prev) => {
          const exists = prev.find(r => r.gid === props.gid);
          return exists ? prev.filter(r => r.gid !== props.gid) : [...prev, props];
        });
      }
    });

    if (measureMode) {
      const draw = new Draw({
        source: measureSource,
        type: measureMode,
        style: new Style({
          stroke: new Stroke({ color: '#000', width: 2 }),
          fill: new Fill({ color: 'rgba(0, 0, 255, 0.1)' }),
          image: new CircleStyle({ radius: 5, fill: new Fill({ color: '#000' }) })
        })
      });

      draw.on('drawend', (e) => {
        const geom = e.feature.getGeometry().clone().transform('EPSG:4326', 'EPSG:3857');
        if (measureMode === 'LineString') {
          alert(`Length: ${(getLength(geom) / 1000).toFixed(2)} km`);
        } else if (measureMode === 'Polygon') {
          alert(`Area: ${(getArea(geom) / 10000).toFixed(2)} hectares`);
        }
        setMeasureMode(null);
        map.removeInteraction(draw);
      });

      map.addInteraction(draw);
    }
 }, [wardData, roadData, multiWardRoads, showWards, showRoads, showMultiWardRoads, conditionFilter, selectedWard?.gid, selectedRoads, onlySelected, measureMode, selectedCarriage]);

const handleExportToExcel = () => {
  const visibleRoads = [];

  // Normal Roads
  roadData.forEach((road) => {
    const matchCondition = conditionFilter.includes(road.condition);
    const matchCarriage = selectedCarriage === '' || road.carriageM === selectedCarriage;
    const isVisible = onlySelected
      ? selectedRoads.some((r) => r.gid === road.gid)
      : showRoads && matchCondition && matchCarriage;

    if (road.wkt && isVisible) {
      visibleRoads.push({ ...road, type: 'Normal' });
    }
  });

  // Multi-Ward Roads
  if (showMultiWardRoads) {
    multiWardRoads.forEach((road) => {
      const matchCondition = conditionFilter.includes(road.condition);
      if (road.wkt && matchCondition) {
        visibleRoads.push({ ...road, type: 'Multi-Ward' });
      }
    });
  }

  if (visibleRoads.length === 0) {
    alert("No roads are currently visible to export.");
    return;
  }

  const dataForExcel = visibleRoads.map((road) => ({
    RoadName: road.roadName,
    Zone: `${road.zoneNo ?? ''} - ${road.zoneName ?? ''}`,
    Ward: `${road.wardNo ?? ''} - ${road.wardName ?? ''}`,
    Condition: road.condition,
    LengthInMeters: road.lengthMet?.toFixed(2),
    CarriageType: road.carriageM,
    Category: road.category,
    Ownership: road.ownership,
    Type: road.type,
    GIS_ID: road.gid
  }));

  const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Visible Roads');
  XLSX.writeFile(workbook, 'visible_roads.xlsx');
};




  const toggleCondition = (cond) => {
    setConditionFilter(prev =>
      prev.includes(cond) ? prev.filter(c => c !== cond) : [...prev, cond]
    );
  };

  return (
    <div className="p-2 sm:p-4">
      <h2 className="text-xl sm:text-2xl font-bold text-center mb-3 sm:mb-4 text-slate-800">
        <span className="hidden sm:inline">All Roads in Ghaziabad Wards</span>
        <span className="sm:hidden">Roads in Ghaziabad</span>
      </h2>

      {/* Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap text-black gap-2 sm:gap-4 mb-3 sm:mb-4">
        <label className="flex items-center space-x-2">
          <input type="checkbox" checked={showWards} onChange={() => setShowWards(!showWards)} />
          <span className="text-sm sm:text-base">Show Wards</span>
        </label>
        <label className="flex items-center space-x-2">
          <input type="checkbox" checked={showRoads} onChange={() => setShowRoads(!showRoads)} />
          <span className="text-sm sm:text-base">Show Roads</span>
        </label>
        <label className="flex items-center space-x-2">
          <input type="checkbox" checked={showMultiWardRoads} onChange={() => setShowMultiWardRoads(!showMultiWardRoads)} />
          <span className="text-sm sm:text-base">Multi-Ward Roads</span>
        </label>
        {['Good', 'Moderate', 'Poor'].map(cond => (
          <label key={cond} className="flex items-center space-x-2">
            <input type="checkbox" checked={conditionFilter.includes(cond)} onChange={() => toggleCondition(cond)} />
            <span className="text-sm sm:text-base">{cond}</span>
          </label>
        ))}
        <label className="flex items-center space-x-2">
          <input type="checkbox" checked={onlySelected} onChange={() => setOnlySelected(!onlySelected)} />
          <span className="text-sm sm:text-base">Only Selected</span>
        </label>
        <select className="border rounded px-2 py-1 text-sm sm:text-base w-full sm:w-auto" onChange={(e) => setMeasureMode(e.target.value || null)}>
          <option value="">Measure Tool</option>
          <option value="Point">Point</option>
          <option value="LineString">Line (Distance)</option>
          <option value="Polygon">Polygon (Area)</option>
        </select>

     <button
  onClick={handleExportToExcel}
  className="bg-blue-600 text-white px-3 py-1 rounded text-sm sm:text-base hover:bg-blue-700 transition"
>
  Export Visible Roads
</button>



        <select
  className="border rounded px-2 py-1 text-sm sm:text-base w-full sm:w-auto"
  value={selectedCarriage}
  onChange={(e) => setSelectedCarriage(e.target.value)}
>
  <option value="">All Carriage Types</option>
  {carriageTypes.map((type, idx) => (
    <option key={idx} value={type}>
      {type}
    </option>
  ))}
</select>

      </div>

      {/* Legend */}
      <div className="mb-2 sm:mb-3 text-xs sm:text-sm text-black">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <span className="flex items-center">
            <span className="inline-block w-4 h-2 bg-green-500 mr-1"></span>
            <span>Good</span>
          </span>
          <span className="flex items-center">
            <span className="inline-block w-4 h-2 bg-orange-400 mr-1"></span>
            <span>Moderate</span>
          </span>
          <span className="flex items-center">
            <span className="inline-block w-4 h-2 bg-red-500 mr-1"></span>
            <span>Poor</span>
          </span>
        </div>
        <div className="text-xs text-gray-600 mt-1">
          <span className="hidden sm:inline">(Multi-ward roads have thicker lines)</span>
          <span className="sm:hidden">(Thicker = Multi-ward)</span>
        </div>
      </div>

      {/* Map */}
      <div className="w-full h-[400px] sm:h-[500px] lg:h-[600px] rounded shadow border bg-gray-100 mb-4 sm:mb-6 relative" ref={mapRef}></div>

      {/* Details */}
      <div className="space-y-4 lg:space-y-0 lg:flex lg:gap-4">
        {selectedWard && (
          <div className="flex-1 bg-white p-3 sm:p-4 shadow border rounded text-black">
            <h3 className="text-lg sm:text-xl font-semibold mb-2">
              <span className="hidden sm:inline">Selected Ward: {selectedWard.wardName}</span>
              <span className="sm:hidden">Ward: {selectedWard.wardName}</span>
            </h3>
            <div className="space-y-1 text-sm sm:text-base">
              <p><strong>Ward No:</strong> {selectedWard.wardNo}</p>
              <p><strong>Area:</strong> {parseFloat(selectedWard.area).toFixed(2)} m²</p>
              <p><strong>Extensions:</strong> {selectedWard.wardExten}</p>
              <p><strong>GIS ID:</strong> {selectedWard.gid}</p>
            </div>
          </div>
        )}

        {selectedRoads.length > 0 && (
          <div className="flex-1 bg-yellow-100 p-3 sm:p-4 shadow border rounded text-black">
            <h3 className="text-lg sm:text-xl font-semibold mb-2">
              <span className="hidden sm:inline">Selected Roads</span>
              <span className="sm:hidden">Roads ({selectedRoads.length})</span>
            </h3>
            <div className="space-y-3 max-h-64 sm:max-h-80 overflow-y-auto">
              {selectedRoads.map((road) => (
                <div key={road.gid} className="pb-2 border-b border-yellow-200 last:border-b-0">
                  <div className="space-y-1 text-sm sm:text-base">
                    <p><strong>Road:</strong> {road.roadName}</p>
                    <p><strong>Zone:</strong> {road.zoneNo} - {road.zoneName}</p>
                    <p><strong>Ward:</strong> {road.wardNo} - {road.wardName}</p>
                    <p><strong>Condition:</strong> {road.condition}</p>
                    <p><strong>Length:</strong> {road.lengthMet?.toFixed(2)} m</p>
                    <p><strong>Type:</strong> {road.carriageM} / {road.category}</p>
                    <p><strong>Ownership:</strong> {road.ownership}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Multi-Ward Road Table */}
      <div className="bg-white shadow border rounded p-3 sm:p-4 text-black mt-4 sm:mt-6">
        <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3">
          <span className="hidden sm:inline">Multi-Ward Roads</span>
          <span className="sm:hidden">Multi-Ward Roads ({multiWardRoads.length})</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="table-auto w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b">
                <th className="px-2 py-2 text-xs sm:text-sm font-medium">Road Name</th>
                <th className="px-2 py-2 text-xs sm:text-sm font-medium">Wards</th>
                <th className="px-2 py-2 text-xs sm:text-sm font-medium">Condition</th>
                <th className="px-2 py-2 text-xs sm:text-sm font-medium">Length (m)</th>
              </tr>
            </thead>
            <tbody>
              {multiWardRoads.map((road) => (
                <tr key={road.gid} className="border-b hover:bg-gray-50">
                  <td className="px-2 py-2 text-xs sm:text-sm">{road.roadName}</td>
                  <td className="px-2 py-2 text-xs sm:text-sm">{road.wardName}</td>
                  <td className="px-2 py-2 text-xs sm:text-sm">
                    <span className={`px-2 py-1 rounded text-xs ${
                      road.condition === 'Good' ? 'bg-green-100 text-green-800' :
                      road.condition === 'Moderate' ? 'bg-orange-100 text-orange-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {road.condition}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-xs sm:text-sm">{road.lengthMet?.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AllRoadsPage;