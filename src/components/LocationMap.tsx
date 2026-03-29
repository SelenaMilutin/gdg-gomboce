/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * LocationMap.tsx — Google Maps integration for location tracking
 * 
 * Requires VITE_GOOGLE_MAPS_API_KEY in .env.local
 */

import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, AlertCircle } from 'lucide-react';

// Extend window type for Google Maps API
declare global {
  interface Window {
    google: any;
    __mapsLoadersSignal?: Promise<void>;
  }
}

interface Location {
  latitude: number;
  longitude: number;
  lastUpdated?: Date;
}

interface LocationMapProps {
  location?: Location | null;
  isLive?: boolean;
  onRefresh?: () => void;
}

// Mock location for demo when no real location is available
const MOCK_LOCATION: Location = {
  latitude: 44.8176,
  longitude: 20.4568,
  lastUpdated: new Date(),
};

// Global promise to ensure API loads only once
let mapsScriptPromise: Promise<void> | null = null;

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  // Return existing promise if already loading/loaded
  if (mapsScriptPromise) {
    return mapsScriptPromise;
  }

  // Check if already in DOM
  if (document.querySelector(`script[src*="maps.googleapis.com"]`)) {
    return Promise.resolve();
  }

  mapsScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=maps,marker&v=beta`;
    script.async = true;
    script.defer = true;
    script.setAttribute('loading', 'async'); // Google Maps performance best-practice

    script.onload = () => resolve();
    script.onerror = () => {
      mapsScriptPromise = null; // Reset on error so it can retry
      reject(new Error('Failed to load Google Maps API'));
    };

    document.head.appendChild(script);
  });

  return mapsScriptPromise;
}

export default function LocationMap({ location = MOCK_LOCATION, isLive = false, onRefresh }: LocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [markerRef, setMarkerRef] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use mock location if none provided
  const displayLocation = location || MOCK_LOCATION;

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  // Load Google Maps API
  useEffect(() => {
    if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
      setError('Google Maps API key not configured. Please add VITE_GOOGLE_MAPS_API_KEY to .env.local');
      setIsLoading(false);
      return;
    }

    console.log('Loading Google Maps with location:', displayLocation);

    loadGoogleMapsScript(apiKey)
      .then(() => {
        console.log('Google Maps script loaded, initializing map...');
        return initMap();
      })
      .catch((err) => {
        console.error('Failed to load Google Maps:', err);
        setError('Failed to load Google Maps API');
        setIsLoading(false);
      });
  }, [apiKey, displayLocation?.latitude, displayLocation?.longitude]);

  const initMap = async () => {
    if (!mapRef.current) return;

    try {
      const google = window.google;
      const { Map } = await google.maps.importLibrary('maps') as any;
      const { AdvancedMarkerElement } = await google.maps.importLibrary('marker') as any;

      const mapInstance = new Map(mapRef.current, {
        center: { lat: displayLocation.latitude, lng: displayLocation.longitude },
        zoom: 15,
        mapId: 'LOCATION_MAP',
        mapTypeControl: true,
        fullscreenControl: true,
        streetViewControl: true,
      });

      const marker = new AdvancedMarkerElement({
        map: mapInstance,
        position: { lat: displayLocation.latitude, lng: displayLocation.longitude },
        title: 'Current Location',
      });

      setMap(mapInstance);
      setMarkerRef(marker);
      setIsLoading(false);

      // Force map resize to ensure it renders fully
      setTimeout(() => {
        google.maps.event.trigger(mapInstance, 'resize');
      }, 100);
    } catch (err) {
      console.error('Error initializing map:', err);
      setError('Failed to initialize map');
      setIsLoading(false);
    }
  };

  // Update marker position when location changes
  useEffect(() => {
    if (map && markerRef && displayLocation) {
      const newPosition = { lat: displayLocation.latitude, lng: displayLocation.longitude };
      markerRef.position = newPosition;
      map.panTo(newPosition);
    }
  }, [displayLocation?.latitude, displayLocation?.longitude]);

  return (
    <div className="w-full space-y-4">
      {/* Map Container */}
      <div className="relative w-full h-96 bg-[#F7FAFC] rounded-2xl shadow-lg border-2 border-[#5AB9B1] overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
            <div className="text-center">
              <div className="w-8 h-8 mx-auto mb-2 animate-spin rounded-full border-2 border-[#5AB9B1] border-t-transparent" />
              <p className="text-sm text-[#718096]">Loading map...</p>
            </div>
          </div>
        )}

        {error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[#FEF3C7]">
            <div className="text-center p-4">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-[#F6AD55]" />
              <p className="text-sm text-[#92400E] font-medium">{error}</p>
              <p className="text-xs text-[#B45309] mt-2">
                Add <code className="bg-white px-2 py-1 rounded">VITE_GOOGLE_MAPS_API_KEY</code> to .env.local
              </p>
            </div>
          </div>
        ) : (
          <div ref={mapRef} className="w-full h-full" />
        )}

        {/* Status Badge */}
        {isLive && !error && (
          <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 bg-red-500 text-white px-3 py-2 rounded-full shadow-lg">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-xs font-bold">LIVE</span>
          </div>
        )}

        {/* Last Updated */}
        {displayLocation?.lastUpdated && !error && (
          <div className="absolute top-4 left-4 z-10 text-xs text-[#718096] bg-white/80 px-3 py-1 rounded-full backdrop-blur-sm">
            {displayLocation.lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>

      {/* Coordinates & Info */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#E2E8F0] space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-[#718096] uppercase tracking-wider block mb-1">Latitude</label>
            <code className="text-lg font-mono font-bold text-[#2D3748]">{displayLocation?.latitude?.toFixed(6) || '—'}</code>
          </div>
          <div>
            <label className="text-xs font-bold text-[#718096] uppercase tracking-wider block mb-1">Longitude</label>
            <code className="text-lg font-mono font-bold text-[#2D3748]">{displayLocation?.longitude?.toFixed(6) || '—'}</code>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onRefresh}
            className="flex-1 flex items-center justify-center gap-2 bg-[#5AB9B1] text-white px-4 py-3 rounded-xl font-bold hover:bg-[#4A9D96] transition-colors"
          >
            <Navigation size={18} />
            Refresh
          </button>
          <button
            onClick={() => {
              if (displayLocation) {
                window.open(
                  `https://maps.google.com/?q=${displayLocation.latitude},${displayLocation.longitude}`,
                  '_blank'
                );
              }
            }}
            className="flex-1 flex items-center justify-center gap-2 bg-white border-2 border-[#5AB9B1] text-[#5AB9B1] px-4 py-3 rounded-xl font-bold hover:bg-[#E6FFFA] transition-colors"
          >
            <MapPin size={18} />
            Open Maps
          </button>
        </div>
      </div>

    </div>
  );
}
