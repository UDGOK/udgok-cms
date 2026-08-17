'use client';

import { useEffect, useRef, useState } from 'react';

interface GeoState {
  status: 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  error?: string;
}

interface GeoPhotoCaptureProps {
  onCapture: (file: File, meta: { latitude?: number; longitude?: number; takenAt?: Date }) => void;
  label?: string;
}

/**
 * Camera capture with GPS tagging. On a phone, this opens the rear
 * camera directly. After the user takes the photo, we read the current
 * GPS coordinates and attach them to the file metadata.
 *
 * The browser captures the photo via the file input + capture attribute;
 * the GPS comes from navigator.geolocation. We capture the GPS at the
 * moment the file is selected, not the moment the camera shutter fires
 * (which we can't observe from JS), so the location is within a few
 * seconds of the actual photo.
 */
export function GeoPhotoCapture({ onCapture, label = 'Take photo' }: GeoPhotoCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [geo, setGeo] = useState<GeoState>({ status: 'idle' });

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGeo({ status: 'unavailable' });
    }
  }, []);

  function requestLocation() {
    if (!('geolocation' in navigator)) {
      setGeo({ status: 'unavailable' });
      return;
    }
    setGeo({ status: 'requesting' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({
          status: 'granted',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        setGeo({ status: 'denied', error: err.message });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // If we don't have a location yet, try to grab one quickly
    if (geo.status !== 'granted' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const meta = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            takenAt: new Date(),
          };
          setGeo({
            status: 'granted',
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
          onCapture(file, meta);
        },
        () => {
          // No GPS, just send the file
          onCapture(file, { takenAt: new Date() });
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
      );
    } else {
      onCapture(file, {
        latitude: geo.latitude,
        longitude: geo.longitude,
        takenAt: new Date(),
      });
    }

    // Reset the input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFileChange}
        className="hidden"
        id="geo-photo-input"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-4 py-3 bg-orange text-paper border-2 border-orange text-[11px] font-extrabold uppercase tracking-[0.1em] flex-1"
        >
          📷 {label}
        </button>
        <button
          type="button"
          onClick={requestLocation}
          className={`px-3 py-3 border-2 text-[10px] font-extrabold uppercase tracking-[0.1em] ${
            geo.status === 'granted'
              ? 'border-success text-success'
              : geo.status === 'denied'
              ? 'border-error text-error'
              : 'border-line text-ink-50 hover:border-ink hover:text-ink'
          }`}
          title={
            geo.status === 'granted'
              ? `Location: ${geo.latitude?.toFixed(4)}, ${geo.longitude?.toFixed(4)}`
              : 'Add GPS coordinates'
          }
        >
          {geo.status === 'granted' ? '📍' : '📍+'}
        </button>
      </div>
      {geo.status === 'granted' ? (
        <div className="text-[10px] font-mono text-success mt-1.5">
          ✓ GPS: {geo.latitude?.toFixed(5)}, {geo.longitude?.toFixed(5)}
          {geo.accuracy ? ` (±${Math.round(geo.accuracy)}m)` : ''}
        </div>
      ) : geo.status === 'denied' ? (
        <div className="text-[10px] font-mono text-error mt-1.5">⚠ Location denied — photo will upload without GPS</div>
      ) : null}
    </div>
  );
}
