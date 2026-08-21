/* eslint-disable @typescript-eslint/no-explicit-any */

let loaderPromise: Promise<any> | null = null;
let callbackCounter = 0;

export function loadGoogleMaps(): Promise<any> {
  if (typeof window !== 'undefined' && (window as any).google?.maps) {
    return Promise.resolve((window as any).google);
  }
  if (loaderPromise) return loaderPromise;

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(new Error('VITE_GOOGLE_MAPS_API_KEY is not set'));
  }

  loaderPromise = new Promise((resolve, reject) => {
    const w = window as any;
    const callbackName = `__gmapsInit_${Date.now()}_${callbackCounter++}`;

    const cleanup = () => {
      try { delete w[callbackName]; } catch { w[callbackName] = undefined; }
    };

    w[callbackName] = () => {
      cleanup();
      if (w.google?.maps) {
        resolve(w.google);
      } else {
        loaderPromise = null;
        reject(new Error('Google Maps callback fired but google.maps is undefined'));
      }
    };

    const params = new URLSearchParams({
      key: apiKey,
      libraries: 'geometry',
      v: 'weekly',
      loading: 'async',
      callback: callbackName,
    });

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      cleanup();
      loaderPromise = null;
      reject(new Error('Google Maps script failed to load'));
    };
    document.head.appendChild(script);
  });

  return loaderPromise;
}

export function createMotorcycleIcon(google: any, size = 30, color = '#dc2626', headingDeg = 0): any {
  const s = size;
  const pad = Math.round(s * 0.24);
  const total = s + pad * 2;
  const c = total / 2;
  const r = s / 2;

  const tipLen = pad * 0.9;
  const tipHalf = r * 0.34;
  const tipX1 = c - tipHalf;
  const tipX2 = c + tipHalf;
  const tipBaseY = c - r + 1.5;
  const tipTopY = tipBaseY - tipLen;

  const fwY = c - r * 0.62;
  const rwY = c + r * 0.62;
  const wheelHalfW = r * 0.13;
  const wheelHalfL = r * 0.26;
  const tankY = c - r * 0.2;
  const seatY = c + r * 0.18;
  const bodyHalfW = r * 0.17;
  const barHalfW = r * 0.34;

  const svg = `<svg width="${total}" height="${total}" viewBox="0 0 ${total} ${total}" xmlns="http://www.w3.org/2000/svg">
  <g transform="rotate(${headingDeg}, ${c}, ${c})">
    <circle cx="${c}" cy="${c}" r="${r}" fill="${color}" stroke="white" stroke-width="2.5"/>
    <polygon points="${c},${tipTopY} ${tipX1},${tipBaseY} ${tipX2},${tipBaseY}" fill="${color}" stroke="white" stroke-width="2" stroke-linejoin="round"/>
    <line x1="${c}" y1="${tipBaseY}" x2="${c}" y2="${tipTopY + tipLen * 0.35}" stroke="white" stroke-width="1.4"/>
    <g fill="white" stroke="none">
      <rect x="${c - wheelHalfW}" y="${fwY - wheelHalfL}" width="${wheelHalfW * 2}" height="${wheelHalfL * 2}" rx="${wheelHalfW}"/>
      <rect x="${c - wheelHalfW}" y="${rwY - wheelHalfL}" width="${wheelHalfW * 2}" height="${wheelHalfL * 2}" rx="${wheelHalfW}"/>
      <rect x="${c - barHalfW}" y="${fwY - wheelHalfL * 0.2}" width="${barHalfW * 2}" height="${wheelHalfW * 1.1}" rx="${wheelHalfW * 0.5}" opacity="0.92"/>
      <path d="M${c - bodyHalfW},${tankY} L${c + bodyHalfW},${tankY} L${c + bodyHalfW * 1.25},${seatY} L${c - bodyHalfW * 1.25},${seatY} Z" opacity="0.95"/>
      <ellipse cx="${c}" cy="${tankY - r * 0.04}" rx="${bodyHalfW * 0.85}" ry="${r * 0.07}" opacity="0.55"/>
      <rect x="${c - bodyHalfW * 0.7}" y="${seatY + r * 0.02}" width="${bodyHalfW * 1.4}" height="${r * 0.16}" rx="${r * 0.05}" opacity="0.7"/>
    </g>
  </g>
  </svg>`;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(total, total),
    anchor: new google.maps.Point(c, c),
  };
}

// Generic colored circle marker (for police stations)
export function createCircleIcon(google: any, radius: number, color: string, fillOpacity = 0.75): any {
  const size = radius * 2 + 4;
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="${color}" fill-opacity="${fillOpacity}" stroke="${color}" stroke-width="1.5"/>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
  };
}

// Blue device marker (for TrackingDashboard)
export function createDeviceIcon(google: any): any {
  const svg = `<svg width="28" height="44" viewBox="0 0 28 44" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 0C6.27 0 0 6.27 0 14c0 9.5 14 30 14 30s14-20.5 14-30C28 6.27 21.73 0 14 0z" fill="#2563eb" stroke="white" stroke-width="2"/>
    <circle cx="14" cy="14" r="5" fill="white"/>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(28, 44),
    anchor: new google.maps.Point(14, 44),
  };
}
