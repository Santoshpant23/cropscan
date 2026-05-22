type MapPreviewProps = {
  latitude: number
  longitude: number
  zoomDelta?: number
  height?: string
  className?: string
}

function MapPreview({
  latitude,
  longitude,
  zoomDelta = 0.003,
  height = 'h-56',
  className = '',
}: MapPreviewProps) {
  const bbox = [
    longitude - zoomDelta,
    latitude - zoomDelta,
    longitude + zoomDelta,
    latitude + zoomDelta,
  ].join(',')
  const embedSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`
  const googleMapsHref = `https://www.google.com/maps?q=${latitude},${longitude}`
  const osmHref = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`

  return (
    <div className={`overflow-hidden rounded-md border border-stroke bg-surface-2 ${className}`}>
      <iframe
        title={`Map preview at ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`}
        src={embedSrc}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className={`block w-full border-0 ${height}`}
      />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-stroke bg-white px-3 py-2 text-xs">
        <span className="font-bold text-muted">
          {latitude.toFixed(5)}, {longitude.toFixed(5)}
        </span>
        <span className="flex items-center gap-3">
          <a
            href={googleMapsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-leaf-700 hover:underline"
          >
            Open in Google Maps
          </a>
          <a
            href={osmHref}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-muted hover:text-leaf-700 hover:underline"
          >
            OpenStreetMap
          </a>
        </span>
      </div>
    </div>
  )
}

export default MapPreview
