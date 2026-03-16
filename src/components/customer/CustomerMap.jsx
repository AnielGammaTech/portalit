import React, { useState, useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

/**
 * Geocode an address string to [lng, lat] using Mapbox Geocoding API.
 */
async function geocodeAddress(address) {
  if (!address || !MAPBOX_TOKEN) return null;
  try {
    const encoded = encodeURIComponent(address);
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${MAPBOX_TOKEN}&limit=1`
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
 * Build a Mapbox Static Images API URL for a dark-themed map with markers.
 */
function buildStaticMapUrl(coordinates, width = 800, height = 200) {
  if (!coordinates.length || !MAPBOX_TOKEN) return null;

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

  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${pins}/${viewport}/${width}x${height}@2x?access_token=${MAPBOX_TOKEN}&padding=40`;
}

export default function CustomerMap({ addresses = [] }) {
  const [mapUrl, setMapUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const cacheRef = useRef({});

  useEffect(() => {
    if (!MAPBOX_TOKEN || addresses.length === 0) {
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
        const coords = await geocodeAddress(addr);
        if (coords && !cancelled) {
          cacheRef.current[addr] = coords;
          coordinates.push(coords);
        }
      }

      if (cancelled) return;

      if (coordinates.length > 0) {
        const url = buildStaticMapUrl(coordinates);
        setMapUrl(url);
      }
      setLoading(false);
    }

    loadMap();
    return () => { cancelled = true; };
  }, [addresses.join('|')]);

  if (!MAPBOX_TOKEN || addresses.length === 0) return null;

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
