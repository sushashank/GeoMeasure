from pathlib import Path
import tempfile

from fastapi import APIRouter, UploadFile, File, HTTPException

from app.services.file_processor import load_geospatial_file
from app.services.measurement import calculate_measurements
from shapely.geometry import mapping


router = APIRouter(
    prefix="/api/files",
    tags=["Files"]
)


@router.post("/")
async def upload_file(file: UploadFile = File(...)):

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file provided."
        )

    allowed_extensions = {".kml", ".zip"}

    # Use only the filename, not any directory supplied by the client
    filename = Path(file.filename).name
    extension = Path(filename).suffix.lower()

    if extension not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail="Only .kml files or .zip files containing a Shapefile are supported."
        )

    try:
        with tempfile.TemporaryDirectory() as temp_dir:

            file_path = Path(temp_dir) / filename

            # Save uploaded file
            contents = await file.read()

            with open(file_path, "wb") as buffer:
                buffer.write(contents)

            # Load geospatial file
            gdf = load_geospatial_file(str(file_path))

            # Calculate measurements
            measurements = calculate_measurements(gdf)

            # Convert geometry to WGS84 for Leaflet
            map_gdf = gdf.to_crs(epsg=4326)

            geojson = {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": mapping(row.geometry),
                        "properties": {
                            "name": row.get("name", f"Feature {index + 1}")
                        }
                    }
                    for index, row in map_gdf.iterrows()
                    if row.geometry is not None
                ]
            }

            # Build GeoJSON FeatureCollection
            geojson_features = []

            for measurement in measurements:
                geojson_features.append({
                    "type": "Feature",
                    "properties": {
                        "name": measurement["name"],
                        "geometry_type": measurement["geometry_type"],
                        "length_m": measurement["length_m"],
                        "area_sq_m": measurement["area_sq_m"],
                    },
                    "geometry": measurement["geometry"],
                })

            geojson = {
                "type": "FeatureCollection",
                "features": geojson_features,
            }

            return {
                "filename": filename,
                "content_type": file.content_type,
                "features": len(gdf),
                "crs": str(gdf.crs),
                "measurements": measurements,
                "geojson": geojson,
            }
            
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        )

    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc)
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to process file: {exc}"
        )
        