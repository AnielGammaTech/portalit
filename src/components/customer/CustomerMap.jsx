import React, { useState, useEffect } from 'react';
import { client } from '@/api/client';
import { MapPin } from 'lucide-react';

export default function CustomerMap({ addresses = [] }) {
  const [mapUrl, setMapUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const filteredAddresses = addresses.filter(Boolean);
    if (filteredAddresses.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    let objectUrl = null;

    async function loadMap() {
      setLoading(true);
      setMapUrl(null);
      try {
        objectUrl = await client.integrations.mapbox.getStaticMapUrl({
          addresses: filteredAddresses,
          width: 800,
          height: 200,
        });
        if (!cancelled) setMapUrl(objectUrl);
      } catch {
        if (!cancelled) setMapUrl(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadMap();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [addresses.join('|')]);

  if (addresses.length === 0) return null;

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
