import { memo, useEffect, useRef, useState } from 'react'
import { Loader } from '@googlemaps/js-api-loader'
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

// Singleton loader — one Loader instance per API key to avoid duplicate script tags
const loaderCache = new Map<string, Loader>()
function getLoader(apiKey: string) {
  if (!loaderCache.has(apiKey)) {
    loaderCache.set(apiKey, new Loader({ apiKey, version: 'weekly', libraries: [] }))
  }
  return loaderCache.get(apiKey)!
}

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
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const polylineRef = useRef<google.maps.Polyline | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load the Maps JS API once
  useEffect(() => {
    let cancelled = false
    getLoader(apiKey).load()
      .then(() => { if (!cancelled) setIsLoaded(true) })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err))
      })
    return () => { cancelled = true }
  }, [apiKey])

  // Create map once the API is ready and the container is mounted
  useEffect(() => {
    if (!isLoaded || !containerRef.current || mapRef.current) return
    mapRef.current = new google.maps.Map(containerRef.current, {
      center: { lat: center[0], lng: center[1] },
      zoom,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
    })
    if (onMapClick) {
      mapRef.current.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) onMapClick(e.latLng.lat(), e.latLng.lng())
      })
    }
  }, [isLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync markers whenever places or selectedPlaceId changes
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    const bounds = new google.maps.LatLngBounds()
    let hasCoords = false

    places.forEach(place => {
      if (!place.lat || !place.lng) return
      hasCoords = true
      bounds.extend({ lat: place.lat, lng: place.lng })
      const isSelected = String(place.id) === String(selectedPlaceId)
      const marker = new google.maps.Marker({
        position: { lat: place.lat, lng: place.lng },
        map: mapRef.current!,
        title: place.name,
        zIndex: isSelected ? 1000 : 1,
        animation: isSelected ? google.maps.Animation.BOUNCE : undefined,
      })
      marker.addListener('click', () => onMarkerClick?.(place.id))
      markersRef.current.push(marker)
    })

    if (hasCoords && places.length > 1) mapRef.current.fitBounds(bounds)
    else if (hasCoords) mapRef.current.setCenter({ lat: places[0].lat!, lng: places[0].lng! })
  }, [isLoaded, places, selectedPlaceId, onMarkerClick])

  // Sync route polyline
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return
    polylineRef.current?.setMap(null)
    polylineRef.current = null
    if (route && route.length > 1) {
      polylineRef.current = new google.maps.Polyline({
        path: route.map(([lat, lng]) => ({ lat, lng })),
        map: mapRef.current,
        strokeColor: '#3b82f6',
        strokeWeight: 3,
        strokeOpacity: 0.8,
      })
    }
  }, [isLoaded, route])

  if (loadError) return (
    <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-500 text-sm p-4 text-center">
      <div>
        <div className="font-medium mb-1">Failed to load Google Maps</div>
        <div className="text-xs text-slate-400 mb-1">{loadError}</div>
        <div className="text-xs text-slate-400">Ensure Maps JavaScript API is enabled at console.cloud.google.com</div>
      </div>
    </div>
  )

  if (!isLoaded) return (
    <div className="w-full h-full flex items-center justify-center bg-slate-100">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
})
