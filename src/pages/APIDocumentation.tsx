import { Code, Key, BookOpen, Server } from 'lucide-react';

export default function APIDocumentation() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <div className="flex items-center space-x-3 mb-6">
            <BookOpen className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-slate-800">Raidar Tracking API</h1>
          </div>

          <p className="text-slate-600 mb-8">
            Complete REST API for accessing vehicle tracking data and controlling devices.
          </p>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center">
              <Key className="w-6 h-6 mr-2 text-blue-600" />
              Authentication
            </h2>
            <div className="bg-slate-50 rounded-lg p-6">
              <p className="text-slate-700 mb-4">
                All API requests require an API key passed in the request header:
              </p>
              <pre className="bg-slate-800 text-slate-100 p-4 rounded overflow-x-auto">
                <code>X-API-Key: your-api-key-here</code>
              </pre>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-slate-800 mb-4 flex items-center">
              <Server className="w-6 h-6 mr-2 text-blue-600" />
              Base URL
            </h2>
            <div className="bg-slate-50 rounded-lg p-6">
              <pre className="bg-slate-800 text-slate-100 p-4 rounded">
                <code>http://localhost:3000/api</code>
              </pre>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center">
              <Code className="w-6 h-6 mr-2 text-blue-600" />
              Endpoints
            </h2>

            <div className="space-y-6">
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-green-50 px-6 py-3 border-b">
                  <span className="inline-block bg-green-500 text-white text-xs font-bold px-2 py-1 rounded mr-3">
                    GET
                  </span>
                  <span className="font-mono text-slate-800">/devices</span>
                </div>
                <div className="p-6">
                  <p className="text-slate-700 mb-4">Get all devices with their current status</p>
                  <div className="bg-slate-800 rounded p-4">
                    <pre className="text-slate-100 text-sm overflow-x-auto">
{`{
  "devices": [
    {
      "id": "uuid",
      "device_id": "terminal-id",
      "serial_number": "0123456789",
      "status": "online",
      "last_heartbeat": "2024-01-01T00:00:00Z",
      "vehicle": {
        "registration_number": "KXX 123X",
        "make": "Toyota",
        "model": "Hilux"
      }
    }
  ]
}`}
                    </pre>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="bg-green-50 px-6 py-3 border-b">
                  <span className="inline-block bg-green-500 text-white text-xs font-bold px-2 py-1 rounded mr-3">
                    GET
                  </span>
                  <span className="font-mono text-slate-800">/devices/:deviceId/location</span>
                </div>
                <div className="p-6">
                  <p className="text-slate-700 mb-4">Get current location of a specific device</p>
                  <div className="bg-slate-800 rounded p-4">
                    <pre className="text-slate-100 text-sm overflow-x-auto">
{`{
  "location": {
    "latitude": -1.286389,
    "longitude": 36.817223,
    "speed": 45.5,
    "heading": 180,
    "altitude": 1800,
    "satellites": 12,
    "acc_status": true,
    "positioning_status": true,
    "timestamp": "2024-01-01T00:00:00Z"
  }
}`}
                    </pre>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="bg-green-50 px-6 py-3 border-b">
                  <span className="inline-block bg-green-500 text-white text-xs font-bold px-2 py-1 rounded mr-3">
                    GET
                  </span>
                  <span className="font-mono text-slate-800">
                    /devices/:deviceId/location/history
                  </span>
                </div>
                <div className="p-6">
                  <p className="text-slate-700 mb-4">
                    Get historical location data with optional filters
                  </p>
                  <p className="text-sm text-slate-600 mb-2">Query Parameters:</p>
                  <ul className="text-sm text-slate-600 list-disc list-inside mb-4">
                    <li>start: ISO 8601 timestamp (default: 24 hours ago)</li>
                    <li>end: ISO 8601 timestamp (default: now)</li>
                    <li>limit: Number of records (default: 1000, max: 5000)</li>
                  </ul>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="bg-green-50 px-6 py-3 border-b">
                  <span className="inline-block bg-green-500 text-white text-xs font-bold px-2 py-1 rounded mr-3">
                    GET
                  </span>
                  <span className="font-mono text-slate-800">/devices/:deviceId/alarms</span>
                </div>
                <div className="p-6">
                  <p className="text-slate-700 mb-4">Get alarms for a specific device</p>
                  <p className="text-sm text-slate-600 mb-2">Query Parameters:</p>
                  <ul className="text-sm text-slate-600 list-disc list-inside mb-4">
                    <li>status: active | acknowledged | resolved</li>
                  </ul>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="bg-blue-50 px-6 py-3 border-b">
                  <span className="inline-block bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded mr-3">
                    POST
                  </span>
                  <span className="font-mono text-slate-800">/devices/:deviceId/commands</span>
                </div>
                <div className="p-6">
                  <p className="text-slate-700 mb-4">Send command to device</p>
                  <div className="bg-slate-800 rounded p-4 mb-4">
                    <pre className="text-slate-100 text-sm overflow-x-auto">
{`{
  "commandType": "set_parameters",
  "parameters": {
    "0x0001": 30,
    "0x0002": 300
  }
}`}
                    </pre>
                  </div>
                  <p className="text-sm text-slate-600">
                    Supported command types: set_parameters, query_parameters, terminal_control,
                    vehicle_control
                  </p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="bg-green-50 px-6 py-3 border-b">
                  <span className="inline-block bg-green-500 text-white text-xs font-bold px-2 py-1 rounded mr-3">
                    GET
                  </span>
                  <span className="font-mono text-slate-800">/devices/:deviceId/commands</span>
                </div>
                <div className="p-6">
                  <p className="text-slate-700 mb-4">Get command history for a device</p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="bg-green-50 px-6 py-3 border-b">
                  <span className="inline-block bg-green-500 text-white text-xs font-bold px-2 py-1 rounded mr-3">
                    GET
                  </span>
                  <span className="font-mono text-slate-800">/geofences</span>
                </div>
                <div className="p-6">
                  <p className="text-slate-700 mb-4">Get all geofences</p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="bg-blue-50 px-6 py-3 border-b">
                  <span className="inline-block bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded mr-3">
                    POST
                  </span>
                  <span className="font-mono text-slate-800">/geofences</span>
                </div>
                <div className="p-6">
                  <p className="text-slate-700 mb-4">Create new geofence</p>
                  <div className="bg-slate-800 rounded p-4">
                    <pre className="text-slate-100 text-sm overflow-x-auto">
{`{
  "name": "Warehouse Zone",
  "type": "polygon",
  "coordinates": [
    {"lat": -1.286, "lng": 36.817},
    {"lat": -1.287, "lng": 36.818},
    {"lat": -1.288, "lng": 36.816}
  ],
  "attributes": {
    "speed_limit": 30,
    "alarm_on_enter": true,
    "alarm_on_exit": true
  },
  "devices": ["uuid1", "uuid2"]
}`}
                    </pre>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="bg-green-50 px-6 py-3 border-b">
                  <span className="inline-block bg-green-500 text-white text-xs font-bold px-2 py-1 rounded mr-3">
                    GET
                  </span>
                  <span className="font-mono text-slate-800">/stats/overview</span>
                </div>
                <div className="p-6">
                  <p className="text-slate-700 mb-4">Get platform statistics</p>
                  <div className="bg-slate-800 rounded p-4">
                    <pre className="text-slate-100 text-sm overflow-x-auto">
{`{
  "total_devices": 150,
  "online_devices": 120,
  "active_alarms": 5,
  "timestamp": "2024-01-01T00:00:00Z"
}`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold text-slate-800 mb-4">Rate Limits</h2>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
              <p className="text-amber-800">
                API rate limits are configured per API client. Default limit is 100 requests per
                minute. Contact your administrator to adjust limits.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-800 mb-4">Error Codes</h2>
            <div className="space-y-2">
              <div className="flex items-start space-x-3 p-3 bg-slate-50 rounded">
                <code className="text-red-600 font-bold">401</code>
                <span className="text-slate-700">Unauthorized - Invalid or missing API key</span>
              </div>
              <div className="flex items-start space-x-3 p-3 bg-slate-50 rounded">
                <code className="text-red-600 font-bold">404</code>
                <span className="text-slate-700">Not Found - Device or resource not found</span>
              </div>
              <div className="flex items-start space-x-3 p-3 bg-slate-50 rounded">
                <code className="text-red-600 font-bold">429</code>
                <span className="text-slate-700">Too Many Requests - Rate limit exceeded</span>
              </div>
              <div className="flex items-start space-x-3 p-3 bg-slate-50 rounded">
                <code className="text-red-600 font-bold">500</code>
                <span className="text-slate-700">Internal Server Error - Server error occurred</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
