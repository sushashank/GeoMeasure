import { useState, useEffect, useRef } from "react";
import * as L from "leaflet";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";

import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
  LayersControl,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";
import "./App.css";

const API_URL = "http://127.0.0.1:8000/api/files/";

/* Automatically zoom the map to the uploaded geometry. */
function MapController({ geojson }) {
  const map = useMap();

  useEffect(() => {
    if (!geojson?.features?.length) return;

    const bounds = L.geoJSON(geojson).getBounds();

    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [40, 40],
        maxZoom: 16,
        animate: true,
      });
    }
  }, [geojson, map]);

  return null;
}

/* Interactive geometry map with street and satellite layers. */
function GeometryMap({ data }) {
  const geoJsonRef = useRef(null);

  const highlightFeature = (event) => {
    const layer = event.target;

    if (typeof layer.setStyle === "function") {
      layer.setStyle({
        color: "#ffffff",
        weight: 4,
        fillColor: "#60a5fa",
        fillOpacity: 0.55,
      });
      if (typeof layer.bringToFront === "function") {
        layer.bringToFront();
      }
    }
  };

  const resetHighlight = (event) => {
    if (geoJsonRef.current) {
      geoJsonRef.current.resetStyle(event.target);
    }
  };

  const onEachFeature = (feature, layer) => {
    const properties = feature?.properties || {};
    const name =
      properties.Name ||
      properties.name ||
      properties.NAME ||
      properties.title ||
      "Geometry";

    const safeName = String(name).replace(/[&<>"']/g, (character) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return entities[character];
    });

    layer.bindPopup(`
      <div style="min-width:180px;font-family:Arial,sans-serif">
        <strong style="font-size:15px">${safeName}</strong>
        <div style="margin-top:6px;font-size:12px;color:#555">
          ${feature.geometry?.type || "Unknown geometry"}
        </div>
      </div>
    `);

    layer.on({
      mouseover: highlightFeature,
      mouseout: resetHighlight,
    });
  };

  if (!data) {
    return (
      <div className="map-container map-empty">
        Upload and analyze a file to visualize its geometry.
      </div>
    );
  }

  return (
    <div className="map-container">
      <MapContainer
        center={[20, 0]}
        zoom={2}
        scrollWheelZoom
        zoomControl
        className="geo-map"
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Street Map">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="Satellite Imagery">
            <TileLayer
              attribution="Imagery &copy; Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
        </LayersControl>

        <GeoJSON
          key={JSON.stringify(data)}
          ref={geoJsonRef}
          data={data}
          style={{
            color: "#60a5fa",
            weight: 3,
            fillColor: "#3b82f6",
            fillOpacity: 0.25,
          }}
          onEachFeature={onEachFeature}
        />

        <MapController geojson={data} />
      </MapContainer>
    </div>
  );
}

function App() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith(".zip")) {
      setError("Please upload a ZIP file containing your Shapefile.");
      setFile(null);
      setResult(null);
      return;
    }

    setError("");
    setFile(selectedFile);
    setResult(null);
  };

  const analyzeFile = async () => {
    if (!file) {
      setError("Please select a ZIP file first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let message = "Failed to analyze the file.";
        try {
          const responseData = await response.json();
          message = responseData.detail || message;
        } catch {
          // The server may return a non-JSON error response.
        }
        throw new Error(message);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(
        err.message ||
          "Unable to connect to the GeoMeasure API. Make sure FastAPI is running."
      );
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!result?.measurements?.length) return;

    const headers = [
      "Feature Name",
      "Geometry Type",
      "Length (m)",
      "Area (m²)",
    ];

    const escapeCSV = (value) =>
      `"${String(value ?? "").replace(/"/g, '""')}"`;

    const rows = result.measurements.map((item) => [
      item.name || "Unnamed feature",
      item.geometry_type || "Unknown",
      item.length_m ?? 0,
      item.area_sq_m ?? 0,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map(escapeCSV).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = (result.filename || "geomeasure").replace(/\.[^.]+$/, "");

    link.href = url;
    link.download = `${safeName}_measurements.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const formatNumber = (value) => {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
      return "0";
    }
    return Number(value).toLocaleString("en-IN", {
      maximumFractionDigits: 2,
    });
  };

  const formatLength = (meters) => {
    const value = Number(meters) || 0;
    if (value >= 1000) return `${formatNumber(value / 1000)} km`;
    return `${formatNumber(value)} m`;
  };

  const formatArea = (squareMeters) => {
    const value = Number(squareMeters) || 0;
    if (value >= 1000000) return `${formatNumber(value / 1000000)} km²`;
    if (value >= 10000) return `${formatNumber(value / 10000)} ha`;
    return `${formatNumber(value)} m²`;
  };

  const totalLength =
    result?.measurements?.reduce(
      (sum, item) => sum + Number(item.length_m || 0),
      0
    ) || 0;

  const totalArea =
    result?.measurements?.reduce(
      (sum, item) => sum + Number(item.area_sq_m || 0),
      0
    ) || 0;

  const exportPDF = async () => {
    if (!result?.measurements?.length) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    let tableStartY = 108;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("GeoMeasure", margin, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Geospatial Measurement Report", margin, 28);

    doc.setDrawColor(96, 165, 250);
    doc.line(margin, 34, pageWidth - margin, 34);

    doc.setFontSize(11);
    doc.text(`File: ${result.filename || "Unknown"}`, margin, 44);
    doc.text(`Date: ${new Date().toLocaleDateString("en-IN")}`, margin, 51);
    doc.text(`Coordinate system: ${result.crs || "Unknown"}`, margin, 58);
    doc.text(`Total features: ${result.features ?? result.measurements.length}`, margin, 65);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Measurement Summary", margin, 79);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Total length: ${formatLength(totalLength)}`, margin, 89);
    doc.text(`Total area: ${formatArea(totalArea)}`, margin, 97);

    // Try to include a map preview. The report still exports if the map
    // cannot be captured (for example, due to tile-server CORS restrictions).
    const mapElement = document.querySelector(".geo-map");
    if (mapElement) {
      try {
        const canvas = await html2canvas(mapElement, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
        });

        if (canvas.width > 0 && canvas.height > 0) {
          const imageData = canvas.toDataURL("image/png");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(13);
          doc.text("Map Preview", margin, 108);

          const maxWidth = pageWidth - margin * 2;
          const maxHeight = 65;
          let imageWidth = maxWidth;
          let imageHeight = (canvas.height / canvas.width) * imageWidth;

          if (imageHeight > maxHeight) {
            imageHeight = maxHeight;
            imageWidth = (canvas.width / canvas.height) * imageHeight;
          }

          const imageX = (pageWidth - imageWidth) / 2;
          const imageY = 113;
          doc.addImage(imageData, "PNG", imageX, imageY, imageWidth, imageHeight);
          tableStartY = imageY + imageHeight + 10;
        }
      } catch (captureError) {
        console.warn("Could not capture map preview for PDF:", captureError);
      }
    }

    if (tableStartY + 35 > pageHeight - margin) {
      doc.addPage();
      tableStartY = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Feature Measurements", margin, tableStartY);

    autoTable(doc, {
      startY: tableStartY + 6,
      head: [["Feature Name", "Geometry", "Length (m)", "Area (m²)"]],
      body: result.measurements.map((item) => [
        item.name || "Unnamed feature",
        item.geometry_type || "Unknown",
        Number(item.length_m || 0).toLocaleString("en-IN"),
        Number(item.area_sq_m || 0).toLocaleString("en-IN"),
      ]),
      theme: "grid",
      headStyles: {
        fillColor: [25, 45, 75],
        textColor: [255, 255, 255],
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
        overflow: "linebreak",
      },
      margin: { left: margin, right: margin },
    });

    // Add a footer to every page, after the table has created any extra pages.
    const pageCount = doc.internal.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(110, 110, 110);
      doc.text(
        "GeoMeasure | WGS84 Geodesic Measurement Engine",
        margin,
        doc.internal.pageSize.getHeight() - 10
      );
      doc.text(
        `Page ${page} of ${pageCount}`,
        pageWidth - margin,
        doc.internal.pageSize.getHeight() - 10,
        { align: "right" }
      );
    }

    const safeName = (result.filename || "GeoMeasure").replace(/\.[^.]+$/, "");
    doc.save(`${safeName}_report.pdf`);
  };

  const resetAnalysis = () => {
    setFile(null);
    setResult(null);
    setError("");
  };

  return (
    <div className="app">
      <header className="navbar">
        <div className="logo">GeoMeasure</div>
        <div className="api-status">
          <span className="status-dot"></span>
          API Ready
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="eyebrow">GEOSPATIAL ANALYSIS</div>
          <h1>
            Measure your
            <br />
            <span>geospatial data.</span>
          </h1>
          <p>
            Upload a Shapefile ZIP and instantly calculate accurate geodesic
            lengths and areas using WGS84.
          </p>
        </section>

        <section className="upload-section">
          <div className="upload-card">
            <div className="globe">🌍</div>
            <h2>Upload your Shapefile</h2>
            <p className="upload-description">
              Select a <strong>.zip</strong> containing your Shapefile components.
            </p>

            <label className="file-input">
              <input type="file" accept=".zip" onChange={handleFileChange} />
              <span>{file ? file.name : "Choose ZIP file"}</span>
            </label>

            {file && (
              <div className="selected-file">
                <div className="file-icon">📦</div>
                <div>
                  <strong>{file.name}</strong>
                  <small>{(file.size / 1024).toFixed(1)} KB</small>
                </div>
              </div>
            )}

            <button
              className="analyze-button"
              onClick={analyzeFile}
              disabled={!file || loading}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Analyzing...
                </>
              ) : (
                <>Analyze File →</>
              )}
            </button>

            {error && <div className="error-message">⚠ {error}</div>}
          </div>
        </section>

        {result && (
          <section className="results">
            <div className="result-heading">
              <div>
                <div className="eyebrow">ANALYSIS COMPLETE</div>
                <h2>{result.filename}</h2>
              </div>
              <span className="feature-count">
                {result.features} feature{result.features !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="summary-grid">
              <div className="summary-card">
                <span>CRS</span>
                <strong>{result.crs || "Unknown"}</strong>
              </div>
              <div className="summary-card">
                <span>FEATURES</span>
                <strong>{result.features}</strong>
              </div>
              <div className="summary-card">
                <span>TOTAL LENGTH</span>
                <strong>{formatLength(totalLength)}</strong>
              </div>
              <div className="summary-card">
                <span>TOTAL AREA</span>
                <strong>{formatArea(totalArea)}</strong>
              </div>
            </div>

            <div className="map-section">
              <div className="section-label">SPATIAL VISUALIZATION</div>
              <h3>Explore your geometry</h3>
              <GeometryMap data={result.geojson} />
            </div>

            <h3 className="measurements-title">Measurements</h3>
            <div className="measurement-list">
              {result.measurements?.map((measurement, index) => (
                <div className="measurement-card" key={index}>
                  <div className="measurement-header">
                    <div className="feature-number">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div>
                      <h3>{measurement.name || `Feature ${index + 1}`}</h3>
                      <span>{measurement.geometry_type}</span>
                    </div>
                  </div>

                  <div className="measurement-values">
                    <div>
                      <span>Length</span>
                      <strong>{formatLength(measurement.length_m)}</strong>
                    </div>
                    <div>
                      <span>Area</span>
                      <strong>{formatArea(measurement.area_sq_m)}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="results-actions">
              <button
                className="export-button"
                onClick={exportCSV}
                disabled={!result?.measurements?.length}
              >
                ↓ Export CSV
              </button>
              <button
                className="pdf-button"
                onClick={exportPDF}
                disabled={!result?.measurements?.length}
              >
                ↓ Export PDF
              </button>
              <button className="reset-button" onClick={resetAnalysis}>
                ← Analyze another file
              </button>
            </div>
          </section>
        )}
      </main>

      <footer>GeoMeasure · WGS84 Geodesic Measurement Engine</footer>
    </div>
  );
}

export default App;
