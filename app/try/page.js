'use client';

import React, { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import { OSM } from 'ol/source';
import { Vector as VectorSource } from 'ol/source';
import { WKT } from 'ol/format';
import { fromLonLat } from 'ol/proj';
import { Style, Stroke, Fill } from 'ol/style';

const ZonePage = () => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [zonesData, setZonesData] = useState([]);
  const [error, setError] = useState(null);

  // Fetch both zones
  useEffect(() => {
    const fetchZones = async () => {
      try {
        const zoneNos = ['1', '2'];
        const responses = await Promise.all(
          zoneNos.map(no =>
            fetch(`http://localhost:8080/api/zones/byZoneNo?zoneNo=${no}`).then(res => res.json())
          )
        );
        console.log('Zones data:', responses);
        setZonesData(responses);
      } catch (err) {
        console.error('Error fetching zones:', err);
        setError('Failed to fetch zone data');
      }
    };

    fetchZones();
  }, []);

  // Draw map after zones are fetched
  useEffect(() => {
    if (!mapRef.current || zonesData.length === 0) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.setTarget(null);
      mapInstanceRef.current = null;
    }

    const tileLayer = new TileLayer({
      source: new OSM(),
    });

    const vectorSource = new VectorSource();
    const wktFormat = new WKT();

    zonesData.forEach((zone, index) => {
      if (!zone?.wkt) return;

      const cleanedWkt = zone.wkt.replace(/^"+|"+$/g, '');
      try {
        const feature = wktFormat.readFeature(cleanedWkt, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857',
        });

        feature.setStyle(
          new Style({
            stroke: new Stroke({
              color: index === 0 ? '#FF0000' : '#0000FF',
              width: 2,
            }),
            fill: new Fill({
              color: index === 0 ? 'rgba(255, 0, 0, 0.2)' : 'rgba(0, 0, 255, 0.2)',
            }),
          })
        );

        vectorSource.addFeature(feature);
      } catch (e) {
        console.error(`Error parsing WKT for zone ${zone.zoneNo}`, e);
      }
    });

    const vectorLayer = new VectorLayer({
      source: vectorSource,
    });

    const map = new Map({
      target: mapRef.current,
      layers: [tileLayer, vectorLayer],
      view: new View({
        center: fromLonLat([77.431, 28.712]),
        zoom: 12,
      }),
    });

    mapInstanceRef.current = map;

    if (vectorSource.getFeatures().length > 0) {
      const extent = vectorSource.getExtent();
      map.getView().fit(extent, {
        padding: [50, 50, 50, 50],
        maxZoom: 16,
        duration: 1000,
      });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setTarget(null);
        mapInstanceRef.current = null;
      }
    };
  }, [zonesData]);

  if (error) {
    return <div className="p-4 text-red-600">{error}</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold text-slate-800 mb-2">
        Zones: {zonesData.map(z => z.zoneNo).join(', ')}
      </h2>
      <p className="text-slate-600 text-sm mb-4">
        Areas:{' '}
        {zonesData
          .map(z => `Zone ${z.zoneNo} - ${z.areaSqKm?.toFixed(2)} km²`)
          .join(' | ')}
      </p>
      <div
        ref={mapRef}
        className="w-full h-[500px] rounded shadow border bg-gray-200"
        style={{ minHeight: '500px' }}
      />
    </div>
  );
};

export default ZonePage;
