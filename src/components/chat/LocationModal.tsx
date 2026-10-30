'use client';

import React, { useState } from 'react';
import { MapPin, X, Navigation, Loader2, AlertCircle } from 'lucide-react';
import { ChatAttachment } from '@/types/chat';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendLocation: (attachment: ChatAttachment, note?: string) => Promise<void>;
}

function createLocationAttachment(
  coords: { lat: number; lng: number },
  label?: string
): ChatAttachment {
  const now = Date.now();
  const mapUrl = `https://www.google.com/maps?q=${coords.lat},${coords.lng}`;

  return {
    id: `loc-${now}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'location',
    name: label?.trim() || 'Shared Location',
    url: mapUrl,
    uploadedAt: now,
    expiresAt: now + 48 * 60 * 60 * 1000,
    locationData: {
      latitude: coords.lat,
      longitude: coords.lng,
      label: label?.trim() || 'Shared Location',
      mapUrl,
    },
  };
}

export const LocationModal: React.FC<LocationModalProps> = ({
  isOpen,
  onClose,
  onSendLocation,
}) => {
  const [label, setLabel] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const handleDetectLocation = () => {
    setError(null);
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        });
        if (!label) {
          setLabel('My Current Location');
        }
        setIsLocating(false);
      },
      (err) => {
        console.error('Geolocation error:', err);
        setError('Could not access current location. Please verify location permissions or enter coordinates.');
        setIsLocating(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSend = async () => {
    setError(null);
    if (!coords) {
      setError('Please detect or provide location coordinates.');
      return;
    }

    setIsSending(true);
    try {
      const attachment = createLocationAttachment(coords, label);
      await onSendLocation(attachment);
      handleClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send location.');
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setLabel('');
    setCoords(null);
    setError(null);
    setIsSending(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden p-6 sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-green-50 border border-green-200/80 flex items-center justify-center text-green-600 flex-shrink-0">
            <MapPin size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">
              Share Location
            </h3>
            <p className="text-xs text-gray-500">
              Share GPS coordinates or an address location preview.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
            <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        {/* GPS Detection Button */}
        <div className="mb-4">
          <button
            type="button"
            onClick={handleDetectLocation}
            disabled={isLocating}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-green-50 hover:bg-green-100 border border-green-200 rounded-2xl text-xs font-bold text-green-800 transition-colors cursor-pointer"
          >
            {isLocating ? (
              <>
                <Loader2 size={15} className="animate-spin text-green-700" />
                <span>Accessing GPS Location...</span>
              </>
            ) : (
              <>
                <Navigation size={15} className="text-green-700" />
                <span>Use My Current Device Location</span>
              </>
            )}
          </button>
        </div>

        {/* Form Fields */}
        <div className="space-y-3 mb-5">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Location Label / Address
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Office Headquarters or Delivery Point"
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Latitude
              </label>
              <input
                type="number"
                step="0.000001"
                value={coords?.lat || ''}
                onChange={(e) =>
                  setCoords((prev) => ({
                    lat: parseFloat(e.target.value) || 0,
                    lng: prev?.lng || 0,
                  }))
                }
                placeholder="e.g. 13.0827"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Longitude
              </label>
              <input
                type="number"
                step="0.000001"
                value={coords?.lng || ''}
                onChange={(e) =>
                  setCoords((prev) => ({
                    lat: prev?.lat || 0,
                    lng: parseFloat(e.target.value) || 0,
                  }))
                }
                placeholder="e.g. 80.2707"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSending}
            className="px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!coords || isSending}
            className="px-5 py-2.5 bg-black hover:bg-gray-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-40"
          >
            {isSending ? 'Sharing...' : 'Share Location'}
          </button>
        </div>
      </div>
    </div>
  );
};
