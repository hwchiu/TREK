import { memo } from 'react'
import { useAuthStore } from '../../store/authStore'
import { GoogleMapView } from './GoogleMapView'
import type { Place } from '../../types'

interface MapWrapperProps {
  places?: Place[]
  dayPlaces?: Place[]
  route?: Array<[number, number]> | null
  routeSegments?: Array<{ points: Array<[number, number]>; color?: string }> | null
  selectedPlaceId?: string | number | null
  onMarkerClick?: ((placeId: string | number) => void) | null
  onMapClick?: ((lat: number, lng: number) => void) | null
  onMapContextMenu?: ((lat: number, lng: number, e: MouseEvent) => void) | null
  center?: [number, number]
  zoom?: number
  fitKey?: unknown
  dayOrderMap?: Record<string | number, number[]> | number[][]
  leftWidth?: number
  rightWidth?: number
  hasInspector?: boolean
}

export const MapWrapper = memo(function MapWrapper(props: MapWrapperProps) {
  const { mapsApiKey } = useAuthStore()

  return (
    <GoogleMapView
      apiKey={mapsApiKey ?? ''}
      places={props.places}
      selectedPlaceId={props.selectedPlaceId}
      onMarkerClick={props.onMarkerClick}
      onMapClick={props.onMapClick}
      center={props.center}
      zoom={props.zoom}
      route={props.route ?? null}
    />
  )
})
