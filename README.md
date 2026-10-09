# GeoMeasure

A geospatial file measurement web application for visualizing uploaded geographic data and calculating geodesic lengths and areas using the WGS84 ellipsoid.

## Features

- Upload a ZIP archive containing one Shapefile.
- Load geospatial data with GeoPandas.
- Calculate geodesic line lengths and polygon perimeters in metres.
- Calculate polygon areas in square metres.
- Transform data with a defined coordinate reference system (CRS) to EPSG:4326 before geodesic measurement.
- Visualize returned GeoJSON on an interactive Leaflet map.
- Switch between OpenStreetMap street tiles and Esri World Imagery satellite tiles.
- View feature-level measurement summaries.
- Export measurements to CSV and PDF.
- Responsive React interface for desktop and mobile screens.

## Technology stack

**Frontend**
- React
- Vite
- React Leaflet and Leaflet
- jsPDF and jspdf-autotable
- html2canvas (used for the PDF map preview)

**Backend**
- Python
- FastAPI
- GeoPandas
- Shapely
- pyproj

## Project structure

The project is organized into a frontend and a FastAPI backend. The backend code discussed during development includes:

```text
project-root/
├── app/
│   ├── api/
│   │   └── routes.py
│   └── services/
│       ├── file_processor.py
│       └── measurement.py
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── ...
│   └── package.json
└── README.md
```

Adjust this tree if your local project has a different layout.

## Requirements

- Python 3.10 or newer is recommended.
- Node.js and npm compatible with your installed Vite version.
- Python dependencies used by the backend: `fastapi`, `uvicorn`, `python-multipart`, `geopandas`, `shapely`, and `pyproj`.

Geospatial driver support can vary by environment. KML reading may require compatible GDAL/Fiona or Pyogrio support in the GeoPandas installation.

## Run locally

Open two terminals from the project root.

### 1. Backend

Create and activate a virtual environment if you do not already have one.

**Windows PowerShell:**

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install fastapi uvicorn python-multipart geopandas shapely pyproj
```

Start the API from the directory where the `app` package is importable:

```powershell
uvicorn app.main:app --reload
```

If your FastAPI entry point is at a different path, adjust the import target to match your project. The frontend currently expects the API endpoint `http://127.0.0.1:8000/api/files/`.

API documentation is normally available at `http://127.0.0.1:8000/docs` while the backend is running.

### 2. Frontend

```powershell
cd frontend
npm install
npm install leaflet react-leaflet jspdf jspdf-autotable html2canvas
npm run dev
```

Open the local URL printed by Vite, commonly `http://localhost:5173`.

## Supported input

The current interface is designed for a `.zip` archive containing a single Shapefile. A Shapefile normally consists of several companion files, including `.shp`, `.shx`, `.dbf`, and often `.prj`; keep the related files together in the archive.

The backend file processor also contains KML and direct `.shp` loading paths, but the current frontend file picker accepts ZIP files only. Direct KML upload is not exposed in the current UI unless you extend it.

## Measurement notes

- Lengths and polygon perimeters are returned in metres (`length_m`).
- Polygon areas are returned in square metres (`area_sq_m`).
- The frontend formats larger values as kilometres, hectares, or square kilometres for display.
- Geodesic calculations use the WGS84 ellipsoid and require a correctly defined source CRS. Data with a missing CRS should be rejected rather than guessed.
- Point geometries have zero length and area in the current measurement implementation. Geometry types outside the explicitly handled line and polygon types may also return zero; test the input types required by your use case.
- Geodesic area behavior for very large polygons, polygons crossing the antimeridian, and complex geometries should be validated for the intended application before relying on the output for surveying or legal purposes.

## Security and deployment

This project is intended as a development/demo application unless it has been hardened for production. Before accepting untrusted uploads or exposing the API publicly:

- Safely extract ZIP files and prevent path traversal; do not use unrestricted archive extraction on untrusted input.
- Enforce upload size limits and sensible processing timeouts.
- Validate archive contents and required Shapefile companion files.
- Consider authentication, rate limiting, logging, and restricted CORS origins.
- Configure the frontend API URL through an environment variable rather than hard-coding localhost.
- Ensure the API returns safe, actionable error messages without exposing internal exception details.
- Verify map tile provider attribution, terms, and usage limits for your deployment.

## Current status

GeoMeasure includes the core upload, measurement, map visualization, and CSV/PDF export workflow. Run the checks below against your own environment before treating a release as production-ready.

## Suggested validation checklist

- [ ] Confirm a known polygon's area and perimeter against an independent reference.
- [ ] Test multiple features and line/polygon/multipolygon inputs.
- [ ] Test projected and geographic CRSs, plus missing or invalid CRS metadata.
- [ ] Test invalid ZIP files and archives missing required Shapefile components.
- [ ] Compare CSV/PDF values with the on-screen values.
- [ ] Test desktop and mobile layouts.
- [ ] Review ZIP extraction safety and upload limits before public deployment.

## License

No license has been specified yet. Add a `LICENSE` file before presenting the repository as open source, and choose a license that matches how you want others to use the project.
