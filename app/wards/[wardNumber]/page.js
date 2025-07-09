'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Map from 'ol/Map';
import View from 'ol/View';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import { OSM, XYZ } from 'ol/source';
import { Vector as VectorSource } from 'ol/source';
import { WKT } from 'ol/format';
import { Stroke, Style, Fill } from 'ol/style';
import 'ol/ol.css';


const colorMap = {
  Good: 'green',
  Moderate: 'orange',
  Poor: 'red'
};

const WardPage = () => {
  const { wardNumber } = useParams();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [roadData, setRoadData] = useState([]);
  const [zoneData, setZoneData] = useState([]);
  const [wardData, setWardData] = useState([]);
  const [selectedConditions, setSelectedConditions] = useState(['Good', 'Moderate', 'Poor']);
  const [selectedRoad, setSelectedRoad] = useState(null);
  const [showTable, setShowTable] = useState(true);
  const [baseMapType, setBaseMapType] = useState('OSM');
  const [searchRoad, setSearchRoad] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const roadFeatureMapRef = useRef({});


  useEffect(() => {
    const fetchRoads = async () => {
      try {
        const res = await fetch(`http://localhost:8080/api/multiwardroads/ward?wardNo=${wardNumber}`);
        const data = await res.json();
        setRoadData(data);
      } catch (err) {
        console.error('Error fetching road data:', err);
      }
    };

    const fetchZones = async () => {
      try {
        const res1 = await fetch('http://localhost:8080/api/zones/byZoneNo?zoneNo=1');
        const res2 = await fetch('http://localhost:8080/api/zones/byZoneNo?zoneNo=2');
        const data1 = await res1.json();
        const data2 = await res2.json();
        setZoneData([data1, data2]);
      } catch (err) {
        console.error('Error fetching zones:', err);
      }
    };

    const fetchWard = async () => {
      try {
        const res = await fetch(`http://localhost:8080/api/ward/all`);
        const data = await res.json();
        setWardData(data);
      } catch (err) {
        console.error('Error fetching ward:', err);
      }
    };

    fetchRoads();
    fetchZones();
    fetchWard();
  }, [wardNumber]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInstanceRef.current) mapInstanceRef.current.setTarget(null);

    const baseLayer = new TileLayer({
      source:
        baseMapType === 'Topo'
          ? new XYZ({ url: 'https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png' })
          : baseMapType === 'Satellite'
          ? new XYZ({ url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' })
          : new OSM(),
    });

    const view = new View({
      center: [77.45, 28.7],
      zoom: 13,
      projection: 'EPSG:4326'
    });

    const map = new Map({ target: mapRef.current, layers: [baseLayer], view });
    mapInstanceRef.current = map;

    const wkt = new WKT();

    zoneData.forEach((zone) => {
      const wktStr = Array.isArray(zone) ? zone[0]?.wkt : zone?.wkt;
      if (!wktStr) return;
      const feature = wkt.readFeature(wktStr.replace(/^"+|"+$/g, ''), {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:4326'
      });
      feature.setStyle(new Style({
        stroke: new Stroke({ color: '#ff0000', width: 2 }),
        fill: new Fill({ color: 'rgba(255,0,0,0.1)' })
      }));
      const zoneLayer = new VectorLayer({ source: new VectorSource({ features: [feature] }) });
      map.addLayer(zoneLayer);
    });

    wardData.forEach((ward) => {
      if (!ward.wkt || ward.wardNo !== wardNumber) return;
      try {
        const feature = wkt.readFeature(ward.wkt.replace(/^"+|"+$/g, ''), {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:4326'
        });
        feature.setStyle(new Style({
          stroke: new Stroke({ color: '#00008B', width: 3 }),
          fill: new Fill({ color: 'rgba(0,0,139,0.2)' })
        }));
        const wardLayer = new VectorLayer({ source: new VectorSource({ features: [feature] }) });
        map.addLayer(wardLayer);
      } catch (err) {
        console.error('Error parsing ward WKT:', err);
      }
    });
    roadFeatureMapRef.current = {}; // reset
    const features = roadData.map((r) => {
      if (!r.wkt || !selectedConditions.includes(r.condition) || !r.roadName) return null;
     const feature = wkt.readFeature(r.wkt.replace(/^"+|"+$/g, ''), {
  dataProjection: 'EPSG:4326',
  featureProjection: 'EPSG:4326'
});

      const isMatch = searchRoad.trim() && r.roadName.toLowerCase().includes(searchRoad.trim().toLowerCase());
      feature.setStyle(new Style({
        stroke: new Stroke({ color: colorMap[r.condition] || 'gray', width: isMatch ? 4 : 2 })
      }));
      feature.setId(r.gid);
      feature.setProperties(r);
      roadFeatureMapRef.current[r.gid] = feature;

      return feature;
    }).filter(Boolean);

    const vectorSource = new VectorSource({ features });
    const vectorLayer = new VectorLayer({ source: vectorSource });
    map.addLayer(vectorLayer);

    if (searchRoad.trim()) {
      const match = features.find(f => f.get('roadName')?.toLowerCase().includes(searchRoad.trim().toLowerCase()));
      if (match) {
        const extent = match.getGeometry().getExtent();
        map.getView().fit(extent, { padding: [100, 100, 100, 100], maxZoom: 17 });
      }
    }

    map.on('singleclick', (evt) => {
      const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f);
      if (feature && feature.getProperties().roadName) {
        feature.setStyle(new Style({
          stroke: new Stroke({ color: colorMap[feature.getProperties().condition], width: 4 })
        }));
        setSelectedRoad(feature.getProperties());
      } else {
        setSelectedRoad(null);
      }
    });
  }, [roadData, zoneData, wardData, selectedConditions, baseMapType, searchRoad, wardNumber]);

  const toggleCondition = (condition) => {
    setSelectedConditions((prev) =>
      prev.includes(condition)
        ? prev.filter((c) => c !== condition)
        : [...prev, condition]
    );
  };

  useEffect(() => {
    const matched = roadData
      .filter(r => r.roadName?.toLowerCase().includes(searchRoad.toLowerCase()))
      .map(r => r.roadName);
    setSuggestions(matched.slice(0, 5));
  }, [searchRoad, roadData]);

  return (
    <div className="p-4">
      <div className="flex flex-wrap text-black items-center gap-4 mb-4">
        <h2 className="text-xl font-bold text-black">Ward {wardNumber}</h2>
        <div className="relative">
          <input
            type="text"
            placeholder="Search Road Name"
            value={searchRoad}
            onChange={(e) => setSearchRoad(e.target.value)}
            className="border p-1 rounded w-64"
          />
          {searchRoad && suggestions.length > 0 && (
            <ul className="absolute z-10 bg-white border w-64 rounded shadow">
              {suggestions.map((sug, idx) => (
                <li
                  key={idx}
                  onClick={() => setSearchRoad(sug)}
                  className="px-3 py-1 hover:bg-gray-200 cursor-pointer"
                >
                  {sug}
                </li>
              ))}
            </ul>
          )}
        </div>
        <select
          value={baseMapType}
          onChange={(e) => setBaseMapType(e.target.value)}
          className="border p-1 rounded"
        >
          <option value="OSM">OSM</option>
          <option value="Topo">Topo Map</option>
          <option value="Satellite">Satellite</option>
        </select>
      </div>

      <div className="mb-4 space-x-4">
        {['Good', 'Moderate', 'Poor'].map((cond) => (
          <label key={cond} className="inline-flex items-center space-x-1">
            <input type="checkbox" checked={selectedConditions.includes(cond)} onChange={() => toggleCondition(cond)} />
            <span style={{ color: colorMap[cond] }}>{cond}</span>
          </label>
        ))}
        <button onClick={() => setShowTable(!showTable)} className="ml-4 text-blue-600 underline">
          {showTable ? 'Hide Table' : 'Show Table'}
        </button>
      </div>

      <div ref={mapRef} className="w-full h-[500px] rounded border shadow bg-gray-100 mb-4" />

      {selectedRoad && (
        <div className="p-2 bg-yellow-100 border rounded mb-4 text-black">
          <strong>Selected Road Info:</strong><br />
          Road: {selectedRoad.roadName}<br />
          Length: {selectedRoad.lengthWithinWard?.toFixed(2)} m<br />
          Condition: {selectedRoad.condition}<br />
          Type: {selectedRoad.carriageM} / {selectedRoad.category}
        </div>
      )}

      {showTable && (
        <div className="overflow-auto border rounded p-2 bg-white shadow text-black">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-200 text-left">
                <th className="p-2">Road Name</th>
                <th className="p-2">Length (m)</th>
                <th className="p-2">Condition</th>
                <th className="p-2">Ownership</th>
                <th className="p-2">Surface</th>
                <th className='p-2'>Category</th>
                <th className='p-2'>Zone No</th>
                <th className="p-2">GIS ID</th>
              </tr>
            </thead>
            <tbody>
              {roadData
                .filter(r => selectedConditions.includes(r.condition))
                .map(r => (
<tr
  key={r.gid}
  className="border-t cursor-pointer hover:bg-gray-100"
  onClick={() => {
    const feature = roadFeatureMapRef.current[r.gid];
    if (feature) {
      feature.setStyle(new Style({
        stroke: new Stroke({ color: 'black', width: 4 })
      }));
    }
  }}
>
                    <td className="p-2">{r.roadName}</td>
                    <td className="p-2">{r.lengthWithinWard?.toFixed(2)}</td>
                    <td className="p-2" style={{ color: colorMap[r.condition] }}>{r.condition}</td>
                    <td className="p-2">{r.ownership}</td>
                    <td className="p-2">{r.carriageM}</td>
                    <td className='p-2'>{r.category}</td>
                    <td className='p-2'>{r.zoneNo}</td>
                    <td className='p-2'>{r.gisId}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default WardPage;
