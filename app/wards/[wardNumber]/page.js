'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Map from 'ol/Map';
import View from 'ol/View';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import { OSM, XYZ } from 'ol/source';
import { Vector as VectorSource } from 'ol/source';
import { WKT } from 'ol/format';
import { Stroke, Style } from 'ol/style';
import Overlay from 'ol/Overlay';
import { createEmpty, extend } from 'ol/extent';
import 'ol/ol.css';
import { utils, writeFile } from 'xlsx';

// --- Configuration ---
const colorMap = {
  Good: '#28a745',
  Moderate: '#ffc107',
  Poor: '#dc3545',
};

const baseMaps = {
  OSM: new OSM(),
  Satellite: new XYZ({ url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' }),
  Dark: new XYZ({ url: 'https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png' }),
  Streets: new XYZ({ url: 'https://{a-c}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png' }),
  Topo: new XYZ({ url: 'https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png' }),
};

// --- Main Component ---
const WardPage = () => {
  const { wardNumber } = useParams();
  const mapRef = useRef(null);
  const tableContainerRef = useRef(null);
  const tooltipRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const vectorLayerRef = useRef(null);

  // --- State Management ---
  const [roadData, setRoadData] = useState([]);
  const [weatherData, setWeatherData] = useState(null);
  const [selectedConditions, setSelectedConditions] = useState(['Good', 'Moderate', 'Poor']);
  const [selectedRoadGisIds, setSelectedRoadGisIds] = useState([]);
  const [baseMapType, setBaseMapType] = useState('OSM');
  const [searchRoad, setSearchRoad] = useState('');
  const [isTableVisible, setIsTableVisible] = useState(true);

  // --- Data Fetching ---
  useEffect(() => {
    const fetchRoadData = async () => {
      try {
        const res = await fetch(`http://localhost:8080/api/multiwardroads/ward?wardNo=${wardNumber}`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        setRoadData(await res.json());
      } catch (err) {
        console.error(`Error fetching road data:`, err);
      }
    };

    const fetchWeather = async () => {
      const API_KEY = 'YOUR_API_KEY_HERE'; // IMPORTANT: Replace with your OpenWeatherMap API key
      const lat = 28.7041; // Map center latitude
      const lon = 77.1025; // Map center longitude
      
      // To use live data, uncomment the fetch call and remove the mock data block.
      /*
      try {
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`);
        if (!res.ok) throw new Error('Weather data fetch failed');
        setWeatherData(await res.json());
      } catch (err) {
        console.error('Failed to fetch weather data:', err);
      }
      */

      // Mock weather data for demonstration as a live API key cannot be used here.
      setWeatherData({
          main: { temp: 34.5 },
          weather: [{ description: 'haze', icon: '50d' }],
      });
    };

    fetchRoadData();
    fetchWeather();
  }, [wardNumber]);

  // --- Style and Selection Logic ---
  const updateFeatureStyles = useCallback(() => {
    const roadSource = vectorLayerRef.current?.getSource();
    if (!roadSource) return;

    roadSource.getFeatures().forEach(feature => {
      const props = feature.get('properties');
      const isSelected = selectedRoadGisIds.includes(props.gisId);
      feature.setStyle(new Style({
        stroke: new Stroke({
          color: isSelected ? '#007bff' : (colorMap[props.condition] || 'gray'),
          width: isSelected ? 7 : 4,
        }),
      }));
    });
  }, [selectedRoadGisIds]);

  const toggleRoadSelection = (gisId) => {
    setSelectedRoadGisIds(prev =>
      prev.includes(gisId) ? prev.filter(id => id !== gisId) : [...prev, gisId]
    );
  };
  
  // --- Map Initialization ---
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const tooltipOverlay = new Overlay({
      element: tooltipRef.current,
      offset: [15, 0],
      positioning: 'center-left'
    });

    mapInstanceRef.current = new Map({
        target: mapRef.current,
        view: new View({ center: [77.45, 28.7], zoom: 13, projection: 'EPSG:4326' }),
        controls: [],
        overlays: [tooltipOverlay]
    });
    
    vectorLayerRef.current = new VectorLayer({ source: new VectorSource() });
    
    mapInstanceRef.current.addLayer(new TileLayer({ source: baseMaps[baseMapType] }));
    mapInstanceRef.current.addLayer(vectorLayerRef.current);

    mapInstanceRef.current.on('singleclick', (evt) => {
      const clickedFeature = mapInstanceRef.current?.forEachFeatureAtPixel(evt.pixel, f => f.get('type') === 'road' ? f : null);
      if (clickedFeature) {
        toggleRoadSelection(clickedFeature.get('properties').gisId);
      }
    });

    mapInstanceRef.current.on('pointermove', (e) => {
        if (e.dragging) {
            tooltipRef.current.style.display = 'none';
            return;
        }
        const feature = mapInstanceRef.current.forEachFeatureAtPixel(e.pixel, f => f.get('type') === 'road' ? f : null, { hitTolerance: 5 });
        
        if (feature) {
            const props = feature.get('properties');
            if (props) {
                tooltipRef.current.innerHTML = `<b>${props.roadName}</b><br>Condition: ${props.condition}`;
                tooltipRef.current.style.display = '';
                tooltipOverlay.setPosition(e.coordinate);
            }
        } else {
            tooltipRef.current.style.display = 'none';
        }
    });

  }, []);

  // Update base map layer
  useEffect(() => {
    mapInstanceRef.current?.getLayers().getArray()[0].setSource(baseMaps[baseMapType]);
  }, [baseMapType]);

  // Update map features
  useEffect(() => {
    if (!roadData.length || !vectorLayerRef.current) return;
    
    const wkt = new WKT();
    const roadSource = vectorLayerRef.current.getSource();
    roadSource.clear();
    const filteredRoads = roadData.filter(r => selectedConditions.includes(r.condition));

    const roadFeatures = filteredRoads.flatMap(item => {
        try {
            if (!item.wkt) return [];
            const feature = wkt.readFeature(item.wkt, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:4326' });
            feature.set('type', 'road');
            feature.set('properties', item);
            feature.setId(item.gisId);
            return [feature];
        } catch (e) { return []; }
    });
    
    roadSource.addFeatures(roadFeatures);
    
    if (roadFeatures.length > 0 && selectedRoadGisIds.length === 0) {
        const extent = roadSource.getExtent();
        if(extent && extent[0] !== Infinity){
            mapInstanceRef.current.getView().fit(extent, { padding: [50, 50, 50, 50], duration: 500 });
        }
    }
    
    updateFeatureStyles();
  }, [roadData, selectedConditions, updateFeatureStyles]);

  // Handle view fitting and table scrolling
  useEffect(() => {
    updateFeatureStyles();
    const roadSource = vectorLayerRef.current?.getSource();
    if (!mapInstanceRef.current || !roadSource || selectedRoadGisIds.length === 0) return;

    const extent = createEmpty();
    selectedRoadGisIds.forEach(id => {
        const feature = roadSource.getFeatureById(id);
        if (feature) extend(extent, feature.getGeometry().getExtent());
    });
    mapInstanceRef.current.getView().fit(extent, { padding: [150, 150, 150, 150], duration: 500, maxZoom: 18 });

    if (tableContainerRef.current) {
        const lastSelectedId = selectedRoadGisIds[selectedRoadGisIds.length - 1];
        document.getElementById(`road-row-${lastSelectedId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedRoadGisIds, updateFeatureStyles]);

  const handleSnapshot = () => {
    mapInstanceRef.current.once('rendercomplete', () => {
        const mapCanvas = document.createElement('canvas');
        const size = mapInstanceRef.current.getSize();
        mapCanvas.width = size[0];
        mapCanvas.height = size[1];
        const mapContext = mapCanvas.getContext('2d');
        Array.from(mapInstanceRef.current.getViewport().querySelectorAll('.ol-layer canvas')).forEach(canvas => {
            if (canvas.width > 0) {
                const opacity = canvas.parentNode.style.opacity;
                mapContext.globalAlpha = opacity === '' ? 1 : Number(opacity);
                const transform = canvas.style.transform;
                const matrix = transform.match(/^matrix\(([^]*)\)$/)[1].split(',').map(Number);
                CanvasRenderingContext2D.prototype.setTransform.apply(mapContext, matrix);
                mapContext.drawImage(canvas, 0, 0);
            }
        });
        const link = document.createElement('a');
        link.href = mapCanvas.toDataURL();
        link.download = `map-snapshot-ward-${wardNumber}.png`;
        link.click();
    });
    mapInstanceRef.current.renderSync();
  };
  
  const handleExportSelected = () => {
    const selectedData = roadData.filter(road => selectedRoadGisIds.includes(road.gisId));
    const worksheet = utils.json_to_sheet(selectedData);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'Selected Roads');
    writeFile(workbook, `selected-roads-ward-${wardNumber}.xlsx`);
  };

  const filteredRoadsForTable = roadData.filter(r => 
    selectedConditions.includes(r.condition) && 
    r.roadName?.toLowerCase().includes(searchRoad.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen bg-gray-100 text-black font-sans">
      <nav className="flex items-center justify-between p-2 bg-white shadow-md z-20 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-blue-600">Ward {wardNumber}</h1>
          {weatherData && (
            <div className="flex items-center gap-2 pl-4 border-l">
              <img src={`http://openweathermap.org/img/wn/${weatherData.weather[0].icon}.png`} alt="weather icon" className="h-10 w-10"/>
              <div>
                <div className="font-bold text-lg leading-tight">{weatherData.main.temp.toFixed(1)}°C</div>
                <div className="text-xs capitalize leading-tight">{weatherData.weather[0].description}</div>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-x-4">
            <input type="text" placeholder="Search road name..." value={searchRoad} onChange={(e) => setSearchRoad(e.target.value)} className="border p-2 rounded-md w-64 text-sm"/>
            <select value={baseMapType} onChange={(e) => setBaseMapType(e.target.value)} className="border p-2 rounded-md text-sm">
                {Object.keys(baseMaps).map(name => <option key={name} value={name}>{name}</option>)}
            </select>
        </div>
        <div className="flex items-center gap-x-4">
          {Object.entries(colorMap).map(([condition, color]) => (
            <label key={condition} className="inline-flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" checked={selectedConditions.includes(condition)} 
                onChange={() => setSelectedConditions(prev => prev.includes(condition) ? prev.filter(i => i !== condition) : [...prev, condition])}
                className="h-4 w-4 accent-blue-600"/>
              <span style={{ color }} className="font-semibold text-sm">{condition}</span>
            </label>
          ))}
        </div>
        <div className="flex items-center gap-2">
            <button onClick={handleSnapshot} className="bg-green-500 text-white px-3 py-1.5 rounded-md text-sm hover:bg-green-600">Snapshot</button>
            <button onClick={handleExportSelected} disabled={selectedRoadGisIds.length === 0} className="bg-blue-500 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-600 disabled:bg-gray-400">Export Selected</button>
            <button onClick={() => setIsTableVisible(!isTableVisible)} className="bg-gray-500 text-white px-3 py-1.5 rounded-md text-sm hover:bg-gray-600">{isTableVisible ? 'Hide Table' : 'Show Table'}</button>
        </div>
      </nav>

      <div className="flex flex-col flex-grow overflow-hidden">
        <div ref={mapRef} className="w-full flex-grow relative">
            <div ref={tooltipRef} className="bg-white text-black text-sm p-2 rounded-md shadow-lg border pointer-events-none" style={{ position: 'absolute', display: 'none', zIndex: 10 }}></div>
        </div>
        
        {isTableVisible && (
          <div className="flex flex-col bg-white border-t border-gray-300 shrink-0" style={{ height: '40%', maxHeight: '40vh' }}>
            <h3 className="p-3 text-lg font-semibold border-b border-gray-200 sticky top-0 bg-white z-10 shrink-0">
              Road Details ({filteredRoadsForTable.length})
            </h3>
            <div ref={tableContainerRef} className="overflow-y-auto flex-grow">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 z-10">
                  <tr className="text-left">
                    {['Name', 'Length (m)', 'Condition', 'Type', 'Category', 'Ownership'].map(h => 
                      <th key={h} className="p-2.5 font-semibold text-gray-600">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filteredRoadsForTable.map(road => (
                    <tr key={road.gisId} id={`road-row-${road.gisId}`}
                      className={`border-b border-gray-200 cursor-pointer transition-colors duration-200 ${selectedRoadGisIds.includes(road.gisId) ? 'bg-blue-100 ring-2 ring-blue-400' : 'hover:bg-gray-50'}`}
                      onClick={() => toggleRoadSelection(road.gisId)}>
                      <td className="p-2.5">{road.roadName}</td>
                      <td className="p-2.5">{road.lengthWithinWard?.toFixed(2)}</td>
                      <td className="p-2.5 font-bold" style={{ color: colorMap[road.condition] }}>{road.condition}</td>
                      <td className="p-2.5">{road.carriageM}</td>
                      <td className="p-2.5">{road.category}</td>
                      <td className="p-2.5">{road.ownership}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WardPage;
