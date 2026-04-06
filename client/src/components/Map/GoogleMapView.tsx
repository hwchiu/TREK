import { memo, useEffect, useRef, useCallback } from 'react'
import { GoogleMap, useLoadScript, Marker, Polyline } from '@react-google-maps/api'
import type { Place } from '../../types'

interface GoogleMapViewProps {
  apiKey: string
  places?: Place[]
  selectedPlaceId?: string | number | null
  onMarkerClick?: ((placeId: string | number) => void) | null
  onMapClick?: ((lat: number, lng: number) => void) | null
  center?: [number, number]
  zoom?: number
  route?: Array<[number, number]> | null
}

const containerStyle = { width: '100%', height: '100%' }

export const GoogleMapView = memo(function GoogleMapView({
  apiKey,
  places = [],
  selectedPlaceId = null,
  onMarkerClick,
  onMapClick,
  center = [48.8566, 2.3522],
  zoom = 10,
  route = null,
}: GoogleMapViewProps) {
  const { isLoaded, loadError } = useLoadScript({ googleMapsApiKey: apiKey })
  const mapRef = useRef<google.maps.Map | null>(null)

  const mapCenter = { lat: center[0], lng: center[1] }

  // Fit bounds when places change
  useEffect(() => {
    if (!mapRef.current || places.length === 0) return
    const bounds = new google.maps.LatLngBounds()
    places.forEach(p => { if (p.lat && p.lng) bounds.extend({ lat: p.lat, lng: p.lng }) })
    if (!bounds.isEmpty()) mapRef.current.fitBounds(bounds)
  }, [places])

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (onMapClick && e.latLng) onMapClick(e.latLng.lat(), e.latLng.lng())
  }, [onMapClick])

  if (loadError) return (
    <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-500 text-sm">
      Failed to load Google Maps
    </div>
  )

  if (!isLoaded) return (
    <div className="w-full h-full flex items-center justify-center bg-slate-100">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={mapCenter}
      zoom={zoom}
      onLoad={map => { mapRef.current = map }}
      onClick={handleMapClick}
      options={{
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      }}
    >
      {places.map(place => {
        if (!place.lat || !place.lng) return null
        const isSelected = String(place.id) === String(selectedPlaceId)
        return (
          <Marker
            key={place.id}
            position={{ lat: place.lat, lng: place.lng }}
            title={place.name}
            onClick={() => onMarkerClick?.(place.id)}
            options={{
              zIndex: isSelected ? 1000 : 1,
              animation: isSelected ? google.maps.Animation.BOUNCE : undefined,
            }}
          />
        )
      })}

      {route && route.length > 1 && (
        <Polyline
          path={route.map(([lat, lng]) => ({ lat, lng }))}
          options={{ strokeColor: '#3b82f6', strokeWeight: 3, strokeOpacity: 0.8 }}
        />
      )}
    </GoogleMap>
  )
})
