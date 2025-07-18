'use client';

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import { OSM, XYZ } from 'ol/source';
import { Vector as VectorSource } from 'ol/source';
import { WKT } from 'ol/format';
import { Style, Stroke, Fill, Circle as CircleStyle } from 'ol/style';
import { Draw } from 'ol/interaction';
import { getLength, getArea } from 'ol/sphere';
import Overlay from 'ol/Overlay';
import 'ol/ol.css';
import { utils, writeFile } from 'xlsx';
// Note: You'll need to install recharts for the data visualization
// npm install recharts
import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Cell, ResponsiveContainer } from 'recharts';

// --- Configuration ---
const colorMap = { Good: '#28a745', Moderate: '#ffc107', Poor: '#dc3545' };
const baseMaps = {
  OSM: new OSM(),
  Satellite: new XYZ({ url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' }),
  Dark: new XYZ({ url: 'https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png' }),
  Light: new XYZ({ url: 'https://{a-c}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png' }),
  Topo: new XYZ({ url: 'https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png' }),
};
const SOURCE_PROJECTION = 'EPSG:32644';
const MAP_PROJECTION = 'EPSG:4326';

// --- Main Component ---
const AllRoadsPage = () => {
    // --- State Management ---
    const [wardData, setWardData] = useState([]);
    const [roadData, setRoadData] = useState([]);
    const [multiWardRoads, setMultiWardRoads] = useState([]);
    const [carriageTypes, setCarriageTypes] = useState([]);

    // UI & Filter State
    const [selectedRoads, setSelectedRoads] = useState([]);
    const [showWards, setShowWards] = useState(true);
    const [showRoads, setShowRoads] = useState(true);
    const [showMultiWardRoads, setShowMultiWardRoads] = useState(true);
    const [conditionFilter, setConditionFilter] = useState(['Good', 'Moderate', 'Poor']);
    const [selectedCarriage, setSelectedCarriage] = useState('');
    const [measureMode, setMeasureMode] = useState(null);
    const [baseMapType, setBaseMapType] = useState('OSM');

    // Map & Layer Refs
    const mapRef = useRef(null);
    const popupRef = useRef(null);
    const tooltipRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const wardLayerRef = useRef(null);
    const roadLayerRef = useRef(null);
    const measureLayerRef = useRef(null);
    const popupOverlayRef = useRef(null);

    // --- Data Fetching ---
    useEffect(() => {
        const fetchData = async (url, setter, postProcess) => {
            try {
                const res = await fetch(url);
                const data = await res.json();
                setter(data);
                if (postProcess) postProcess(data);
            } catch (err) { console.error(`Failed to fetch from ${url}:`, err); }
        };
        fetchData('http://localhost:8080/api/ward/all', setWardData);
        fetchData('http://localhost:8080/api/road/all', setRoadData, (data) => {
            setCarriageTypes([...new Set(data.map(r => r.carriageM).filter(Boolean))]);
        });
        fetchData('http://localhost:8080/api/road/multi-ward-roads', setMultiWardRoads);
    }, []);

    // --- Map Initialization & Event Handling ---
    useEffect(() => {
        if (!mapRef.current) return;

        if (!mapInstanceRef.current) {
            wardLayerRef.current = new VectorLayer({ source: new VectorSource(), zIndex: 1 });
            roadLayerRef.current = new VectorLayer({ source: new VectorSource(), zIndex: 2 });
            measureLayerRef.current = new VectorLayer({ source: new VectorSource(), zIndex: 3 });

            popupOverlayRef.current = new Overlay({
                element: popupRef.current,
                autoPan: { animation: { duration: 250 } },
            });

            const tooltipOverlay = new Overlay({
                element: tooltipRef.current,
                offset: [15, 0],
                positioning: 'center-left',
            });

            mapInstanceRef.current = new Map({
                target: mapRef.current,
                layers: [new TileLayer({ source: baseMaps[baseMapType] }), wardLayerRef.current, roadLayerRef.current, measureLayerRef.current],
                overlays: [popupOverlayRef.current, tooltipOverlay],
                view: new View({ center: [77.45, 28.7], zoom: 12, projection: MAP_PROJECTION }),
                controls: [],
            });

            mapInstanceRef.current.on('pointermove', (e) => {
                if (e.dragging) {
                    tooltipRef.current.style.display = 'none';
                    return;
                }
                const feature = mapInstanceRef.current.forEachFeatureAtPixel(e.pixel, f => f, { hitTolerance: 5 });
                const isRoad = feature && (feature.get('type') === 'road' || feature.get('type') === 'multi-road');

                tooltipRef.current.style.display = isRoad ? '' : 'none';
                if (isRoad) {
                    const props = feature.getProperties();
                    tooltipRef.current.innerHTML = `<b>${props.roadName}</b>`;
                    tooltipOverlay.setPosition(e.coordinate);
                }
            });
        }

        const map = mapInstanceRef.current;
        const clickHandler = (e) => {
            if (measureMode) return;
            const feature = map.forEachFeatureAtPixel(e.pixel, f => f, { hitTolerance: 10 });

            if (feature && (feature.get('type') === 'road' || feature.get('type') === 'multi-road')) {
                const props = feature.getProperties();
                const isSelected = selectedRoads.some(r => r.gid === props.gid);

                setSelectedRoads(prev => isSelected ? prev.filter(r => r.gid !== props.gid) : [...prev, props]);

                if (!isSelected) {
                    const content = `
                        <div class="font-bold text-black">${props.roadName}</div>
                        <div class="text-sm text-black">Condition: ${props.condition}</div>
                    `;
                    popupRef.current.innerHTML = content;
                    popupOverlayRef.current.setPosition(e.coordinate);
                } else {
                    popupOverlayRef.current.setPosition(undefined);
                }
            }
        };

        map.on('singleclick', clickHandler);
        return () => map.un('singleclick', clickHandler);

    }, [measureMode, selectedRoads]);

    useEffect(() => {
        if (!mapInstanceRef.current) return;
        mapInstanceRef.current.getLayers().getArray()[0].setSource(baseMaps[baseMapType]);
    }, [baseMapType]);

    const visibleFeatures = useMemo(() => {
        const wkt = new WKT();
        const createFeature = (item, type, sourceProj) => {
            try {
                if(!item.wkt) return null;
                const feature = wkt.readFeature(item.wkt.replace(/^"+|"+$/g, ''), {
                    dataProjection: sourceProj, featureProjection: MAP_PROJECTION
                });
                feature.setProperties({ ...item, type });
                feature.setId(item.gid);
                return feature;
            } catch { return null; }
        };

        const wards = !showWards ? [] : wardData.map(w => createFeature(w, 'ward', 'EPSG:4326'));
        const roads = !showRoads ? [] : roadData.filter(r => conditionFilter.includes(r.condition) && (selectedCarriage === '' || r.carriageM === selectedCarriage)).map(r => createFeature(r, 'road', 'EPSG:4326'));
        const multiWards = !showMultiWardRoads ? [] : multiWardRoads.filter(r => conditionFilter.includes(r.condition) && (selectedCarriage === '' || r.carriageM === selectedCarriage)).map(r => createFeature(r, 'multi-road', SOURCE_PROJECTION));
            
        return { wards: wards.filter(Boolean), roads: [...roads, ...multiWards].filter(Boolean) };
    }, [wardData, roadData, multiWardRoads, showWards, showRoads, showMultiWardRoads, conditionFilter, selectedCarriage]);

    const styleFunction = useCallback((feature) => {
        const props = feature.getProperties();
        if (props.type === 'ward') {
            return new Style({
                stroke: new Stroke({ color: '#003366', width: 3 }),
                fill: new Fill({ color: 'rgba(0,0,0,0.05)' })
            });
        }
        if (['road', 'multi-road'].includes(props.type)) {
            const isSelected = selectedRoads.some(r => r.gid === props.gid);
            let color = isSelected ? '#0d6efd' : (colorMap[props.condition] || 'gray');
            return new Style({
                stroke: new Stroke({ color, width: isSelected ? 6 : (props.type === 'multi-road' ? 4 : 2) })
            });
        }
    }, [selectedRoads]);

    useEffect(() => {
        wardLayerRef.current?.getSource().clear();
        wardLayerRef.current?.getSource().addFeatures(visibleFeatures.wards);
        wardLayerRef.current?.setStyle(styleFunction);

        roadLayerRef.current?.getSource().clear();
        roadLayerRef.current?.getSource().addFeatures(visibleFeatures.roads);
        roadLayerRef.current?.setStyle(styleFunction);
    }, [visibleFeatures, styleFunction]);
    
    useEffect(() => {
        if (!mapInstanceRef.current) return;
        mapInstanceRef.current.getInteractions().getArray().filter(i => i instanceof Draw).forEach(i => mapInstanceRef.current.removeInteraction(i));
        measureLayerRef.current.getSource().clear();

        if (measureMode) {
            const draw = new Draw({
                source: measureLayerRef.current.getSource(), type: measureMode,
                style: new Style({
                    stroke: new Stroke({ color: '#ff00ff', width: 3 }), fill: new Fill({ color: 'rgba(255, 0, 255, 0.2)' }),
                    image: new CircleStyle({ radius: 7, fill: new Fill({ color: '#ff00ff' }) })
                })
            });
            mapInstanceRef.current.addInteraction(draw);
            draw.on('drawend', e => {
                const geom = e.feature.getGeometry();
                const output = measureMode === 'LineString' ? `Length: ${(getLength(geom, { projection: MAP_PROJECTION }) / 1000).toFixed(2)} km` : `Area: ${(getArea(geom, { projection: MAP_PROJECTION }) / 1000000).toFixed(2)} sq. km`;
                alert(output);
                setMeasureMode(null);
            });
        }
    }, [measureMode]);

    const handleTableRowClick = (road) => {
        setSelectedRoads([road]);
        const feature = roadLayerRef.current.getSource().getFeatureById(road.gid);
        if (feature) {
            mapInstanceRef.current.getView().fit(feature.getGeometry().getExtent(), {
                padding: [100, 100, 100, 100], duration: 500, maxZoom: 16
            });
        }
    };
    
    const handleSnapshot = () => {
        mapInstanceRef.current.once('rendercomplete', () => {
            const mapCanvas = document.createElement('canvas');
            const size = mapInstanceRef.current.getSize();
            mapCanvas.width = size[0];
            mapCanvas.height = size[1];
            const mapContext = mapCanvas.getContext('2d');
            Array.from(mapInstanceRef.current.getViewport().querySelectorAll('.ol-layer canvas, .ol-layer svg')).forEach(canvas => {
                if (canvas.width > 0) {
                    const opacity = canvas.style.opacity || canvas.parentNode.style.opacity;
                    mapContext.globalAlpha = opacity === '' ? 1 : Number(opacity);
                    const transform = canvas.style.transform;
                    if (transform) {
                        const matrix = transform.match(/^matrix\(([^)]+)\)$/)[1].split(',').map(Number);
                        mapContext.setTransform.apply(mapContext, matrix);
                    }
                    mapContext.drawImage(canvas, 0, 0);
                    mapContext.setTransform(1, 0, 0, 1, 0, 0);
                }
            });
            const link = document.createElement('a');
            link.href = mapCanvas.toDataURL();
            link.download = 'map-snapshot.png';
            link.click();
        });
        mapInstanceRef.current.renderSync();
    };

    const handleExportVisible = () => {
        const dataToExport = visibleFeatures.roads.map(f => f.getProperties());
        if (dataToExport.length === 0) { alert("No visible roads to export."); return; }
        const worksheet = utils.json_to_sheet(dataToExport.map(r => ({ RoadName: r.roadName, Condition: r.condition, Length_m: r.lengthMet?.toFixed(2), Carriage_Type: r.carriageM, Category: r.category })));
        const workbook = utils.book_new();
        utils.book_append_sheet(workbook, worksheet, 'Visible Roads');
        writeFile(workbook, 'visible_roads.xlsx');
    };

    const handleExportSelected = () => {
        if (selectedRoads.length === 0) { alert("No roads are selected to export."); return; }
        const worksheet = utils.json_to_sheet(selectedRoads.map(r => ({ RoadName: r.roadName, Condition: r.condition, Length_m: r.lengthMet?.toFixed(2), Carriage_Type: r.carriageM, Category: r.category })));
        const workbook = utils.book_new();
        utils.book_append_sheet(workbook, worksheet, 'Selected Roads');
        writeFile(workbook, 'selected_roads.xlsx');
    };
    
    const roadsForGraph = useMemo(() => {
        if (selectedRoads.length > 0) return selectedRoads;
        return visibleFeatures.roads.map(feature => feature.getProperties());
    }, [selectedRoads, visibleFeatures]);

    return (
        <div className="p-4 space-y-4">
            <h2 className="text-2xl font-bold text-center text-black">All Roads Dashboard</h2>
            <div className="p-4 bg-gray-50 rounded-lg shadow-sm border space-y-4">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <span className="font-semibold text-black">Layer Visibility:</span>
                    <Checkbox label="Show Wards" checked={showWards} onChange={e => setShowWards(e.target.checked)} />
                    <Checkbox label="Show Roads" checked={showRoads} onChange={e => setShowRoads(e.target.checked)} />
                    <Checkbox label="Multi-Ward Roads" checked={showMultiWardRoads} onChange={e => setShowMultiWardRoads(e.target.checked)} />
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <span className="font-semibold text-black">Road Condition:</span>
                    <Checkbox label="Good" checked={conditionFilter.includes('Good')} onChange={() => setConditionFilter(p => p.includes('Good') ? p.filter(i => i !== 'Good') : [...p, 'Good'])} />
                    <Checkbox label="Moderate" checked={conditionFilter.includes('Moderate')} onChange={() => setConditionFilter(p => p.includes('Moderate') ? p.filter(i => i !== 'Moderate') : [...p, 'Moderate'])} />
                    <Checkbox label="Poor" checked={conditionFilter.includes('Poor')} onChange={() => setConditionFilter(p => p.includes('Poor') ? p.filter(i => i !== 'Poor') : [...p, 'Poor'])} />
                </div>
                <div className="flex flex-wrap items-center gap-4">
                    <select value={baseMapType} onChange={e => setBaseMapType(e.target.value)} className="border rounded p-2 text-sm text-black bg-white">{Object.keys(baseMaps).map(name => <option key={name} value={name}>{name}</option>)}</select>
                    <select value={selectedCarriage} onChange={e => setSelectedCarriage(e.target.value)} className="border rounded p-2 text-sm text-black bg-white"><option value="">All Carriage Types</option>{carriageTypes.map(type => <option key={type} value={type}>{type}</option>)}</select>
                    <select value={measureMode || ''} onChange={e => setMeasureMode(e.target.value || null)} className="border rounded p-2 text-sm text-black bg-white"><option value="">Measure Tool</option><option value="LineString">Distance</option><option value="Polygon">Area</option></select>
                    <button onClick={handleExportVisible} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">Export Visible</button>
                    <button onClick={handleExportSelected} disabled={selectedRoads.length === 0} className="bg-teal-600 text-white px-4 py-2 rounded text-sm hover:bg-teal-700 disabled:bg-gray-400">Export Selected</button>
                    <button onClick={handleSnapshot} className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">Snapshot</button>
                </div>
            </div>
            <div ref={mapRef} className="w-full h-[600px] rounded-lg shadow-md border bg-gray-200 relative">
                 <div ref={popupRef} className="bg-white p-2 rounded-md shadow-lg border border-gray-300"></div>
                 <div ref={tooltipRef} className="bg-black/60 text-white text-xs p-1 rounded-md pointer-events-none"></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-1 bg-white p-4 rounded-lg shadow-sm border"><DataVisualizationPanel graphData={roadsForGraph} /></div>
                <div className="lg:col-span-2 bg-white p-4 rounded-lg shadow-sm border">
                    <h3 className="text-lg font-semibold mb-3 text-black">Multi-Ward Roads ({multiWardRoads.length})</h3>
                    <div className="overflow-auto max-h-96">
                        <table className="w-full text-sm text-left"><thead className="text-xs text-black uppercase bg-gray-100 sticky top-0"><tr><th className="px-4 py-2">Name</th><th className="px-4 py-2">Condition</th><th className="px-4 py-2">Length (m)</th></tr></thead>
                            <tbody>{multiWardRoads.map((road) => (<tr key={road.gid} className="bg-white border-b hover:bg-gray-100 cursor-pointer" onClick={() => handleTableRowClick(road)}><td className="px-4 py-2 text-black">{road.roadName}</td><td className="px-4 py-2 text-black">{road.condition}</td><td className="px-4 py-2 text-black">{road.lengthMet?.toFixed(2)}</td></tr>))}</tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Checkbox = ({ label, ...props }) => (<label className="flex items-center space-x-2 text-sm text-black"><input type="checkbox" className="accent-blue-600" {...props} /><span>{label}</span></label>);
const DataVisualizationPanel = ({ graphData }) => {
    const vizData = useMemo(() => {
        if(!graphData || graphData.length === 0) return { pieData: [], barData: [] };
        const conditionCounts = graphData.reduce((acc, road) => { const condition = road.condition || 'N/A'; acc[condition] = (acc[condition] || 0) + 1; return acc; }, {});
        const lengthByCondition = graphData.reduce((acc, road) => { const condition = road.condition || 'N/A'; acc[condition] = (acc[condition] || 0) + (road.lengthMet || 0); return acc; }, {});
        const pieData = Object.entries(conditionCounts).map(([name, value]) => ({ name, value }));
        const barData = Object.entries(lengthByCondition).map(([name, length]) => ({ name, length: parseFloat(length.toFixed(2)) }));
        return { pieData, barData };
    }, [graphData]);
    if (!graphData || graphData.length === 0) return <div className="flex items-center justify-center h-full text-center text-black">No data to display. Apply filters or select roads on the map.</div>;
    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-center text-black">Data Analysis</h3>
            <div>
                <h4 className="text-md font-semibold mb-2 text-center text-black">Roads by Condition</h4>
                <ResponsiveContainer width="100%" height={200}><PieChart><Pie data={vizData.pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>{vizData.pieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={colorMap[entry.name] || '#808080'} />))}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>
            </div>
            <div>
                <h4 className="text-md font-semibold mb-2 text-center text-black">Total Length (m) by Condition</h4>
                <ResponsiveContainer width="100%" height={200}><BarChart data={vizData.barData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="length">{vizData.barData.map((entry, index) => (<Cell key={`cell-${index}`} fill={colorMap[entry.name] || '#808080'} />))}</Bar></BarChart></ResponsiveContainer>
            </div>
        </div>
    );
};

export default AllRoadsPage;
