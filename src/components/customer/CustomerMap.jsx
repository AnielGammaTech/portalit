import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { client } from '@/api/client';
import { MapPin } from 'lucide-react';

const ENV_MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';
const DEFAULT_STYLE = 'dark-v11';

/**
 * Geocode an address string to [lng, lat] using Mapbox Geocoding API.
 */
async function geocodeAddress(address, token) {
  if (!address || !token) return null;
  try {
    const encoded = encodeURIComponent(address);
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${token}&limit=1`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) return null;
    return feature.center; // [lng, lat]
  } catch {
    return null;
  }
}

/**
 * Build a Mapbox Static Images API URL with markers.
 */
function buildStaticMapUrl(coordinates, token, mapStyle, width = 800, height = 200) {
  if (!coordinates.length || !token) return null;

  // Build pin markers
  const pins = coordinates
    .map(([lng, lat]) => `pin-s+f97316(${lng},${lat})`)
    .join(',');

  // Auto-fit to bounds if multiple, or center on single point
  let viewport;
  if (coordinates.length === 1) {
    const [lng, lat] = coordinates[0];
    viewport = `${lng},${lat},13`;
  } else {
    viewport = 'auto';
  }

  const style = mapStyle || DEFAULT_STYLE;
  return `https://api.mapbox.com/styles/v1/mapbox/${style}/static/${pins}/${viewport}/${width}x${height}@2x?access_token=${token}&padding=40`;
}

export default function CustomerMap({ addresses = [] }) {
  const [mapUrl, setMapUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const cacheRef = useRef({});

  // Fetch mapbox settings from the Settings table
  const { data: mapboxSettings } = useQuery({
    queryKey: ['mapbox_settings'],
    queryFn: async () => {
      const settingsList = await client.entities.Settings.list();
      if (settingsList.length > 0) {
        return {
          token: settingsList[0].mapbox_token || '',
          style: settingsList[0].mapbox_style || DEFAULT_STYLE,
        };
      }
      return { token: '', style: DEFAULT_STYLE };
    },
    staleTime: 5 * 60 * 1000, // cache for 5 minutes
  });

  const token = mapboxSettings?.token || ENV_MAPBOX_TOKEN;
  const mapStyle = mapboxSettings?.style || DEFAULT_STYLE;

  useEffect(() => {
    if (!token || addresses.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadMap() {
      setLoading(true);

      // Geocode all addresses (with simple cache)
      const coordinates = [];
      for (const addr of addresses) {
        if (!addr) continue;
        if (cacheRef.current[addr]) {
          coordinates.push(cacheRef.current[addr]);
          continue;
        }
        const coords = await geocodeAddress(addr, token);
        if (coords && !cancelled) {
          cacheRef.current[addr] = coords;
          coordinates.push(coords);
        }
      }

      if (cancelled) return;

      if (coordinates.length > 0) {
        const url = buildStaticMapUrl(coordinates, token, mapStyle);
        setMapUrl(url);
      }
      setLoading(false);
    }

    loadMap();
    return () => { cancelled = true; };
  }, [addresses.join('|'), token, mapStyle]);

  if (!token || addresses.length === 0) return null;

  if (loading) {
    return (
      <div className="mt-4 rounded-hero-md overflow-hidden bg-zinc-800/50 h-[160px] animate-pulse flex items-center justify-center">
        <MapPin className="w-5 h-5 text-zinc-500" />
      </div>
    );
  }

  if (!mapUrl) return null;

  return (
    <div className="mt-4 rounded-hero-md overflow-hidden border border-border/30 relative group">
      <img
        src={mapUrl}
        alt="Customer location"
        className="w-full h-[160px] object-cover"
        loading="lazy"
      />
      <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm rounded-md px-2 py-1 flex items-center gap-1.5">
        <MapPin className="w-3 h-3 text-orange-400" />
        <span className="text-[10px] text-white/80 font-medium">
          {addresses.length === 1 ? addresses[0] : `${addresses.length} locations`}
        </span>
      </div>
    </div>
  );
}
