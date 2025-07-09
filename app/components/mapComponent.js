import React, { useEffect, useRef } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import { OSM } from 'ol/source';
import { Vector as VectorSource } from 'ol/source';
import { WKT } from 'ol/format';
import { fromLonLat } from 'ol/proj';

const MapComponent = ({ zoneData }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Always create a basic map first
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setTarget(null);
      mapInstanceRef.current = null;
    }

    const tileLayer = new TileLayer({
      source: new OSM(),
    });

    const map = new Map({
      target: mapRef.current,
      layers: [tileLayer],
      view: new View({
        center: fromLonLat([77.431, 28.712]),
        zoom: 13,
      }),
    });

    mapInstanceRef.current = map;
    console.log('Basic map created');

    // Now try to add zone data if available
    if (!zoneData || !zoneData.wkt) {
      console.log('No zone data available yet');
      return;
    }

    try {
      console.log('Original WKT:', zoneData.wkt);
      const cleanedWkt = zoneData.wkt.replace(/^"+|"+$/g, '');
      console.log('Cleaned WKT:', cleanedWkt);
      
      const wktFormat = new WKT();
      const feature = wktFormat.readFeature(cleanedWkt, {
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857',
      });

      console.log('Feature created:', feature);

      const vectorSource = new VectorSource({
        features: [feature],
      });

      const vectorLayer = new VectorLayer({
        source: vectorSource,
        style: {
          'stroke-color': '#ff0000',
          'stroke-width': 3,
          'fill-color': 'rgba(255, 0, 0, 0.3)',
        },
      });

      map.addLayer(vectorLayer);

      const extent = feature.getGeometry().getExtent();
      console.log('Feature extent:', extent);
      
      setTimeout(() => {
        map.getView().fit(extent, {
          padding: [50, 50, 50, 50],
          maxZoom: 16,
          duration: 1000,
        });
        console.log('View fitted to extent');
      }, 100);

    } catch (e) {
      console.error('Zone data error:', e);
    }
  }, [zoneData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setTarget(null);
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div 
      ref={mapRef} 
      className="w-full h-[500px] rounded shadow border bg-gray-200" 
      style={{ minHeight: '500px' }}
    />
  );
};

export default MapComponent;