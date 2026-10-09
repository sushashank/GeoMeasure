from pathlib import Path
import tempfile
import zipfile

import geopandas as gpd


def load_geospatial_file(file_path: str) -> gpd.GeoDataFrame:
    """
    Load a supported geospatial file.

    Supported:
    - KML
    - ZIP containing a Shapefile
    - SHP
    """

    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    extension = path.suffix.lower()

    if extension == ".kml":
        return _load_kml(path)

    if extension == ".zip":
        return _load_shapefile_zip(path)

    if extension == ".shp":
        return _load_shapefile(path)

    raise ValueError(
        f"Unsupported file format: {extension}"
    )


def _load_kml(path: Path) -> gpd.GeoDataFrame:
    """Load a KML file."""

    try:
        gdf = gpd.read_file(path, driver="KML")
    except Exception as exc:
        raise ValueError(
            f"Unable to read KML file: {exc}"
        ) from exc

    return gdf


def _load_shapefile(path: Path) -> gpd.GeoDataFrame:
    """Load a Shapefile."""

    try:
        gdf = gpd.read_file(path)
    except Exception as exc:
        raise ValueError(
            f"Unable to read Shapefile: {exc}"
        ) from exc

    return gdf


def _load_shapefile_zip(path: Path) -> gpd.GeoDataFrame:
    """
    Extract a ZIP and find the Shapefile inside it.
    """

    with tempfile.TemporaryDirectory() as temp_dir:

        extract_dir = Path(temp_dir)

        try:
            with zipfile.ZipFile(path, "r") as zip_ref:

                if zip_ref.testzip() is not None:
                    raise ValueError(
                        "The ZIP file is corrupted."
                    )

                zip_ref.extractall(extract_dir)

        except zipfile.BadZipFile as exc:
            raise ValueError(
                "Invalid or corrupted ZIP file."
            ) from exc

        # Find shapefiles recursively
        shapefiles = list(
            extract_dir.rglob("*.shp")
        )

        if not shapefiles:
            raise ValueError(
                "ZIP file does not contain a Shapefile (.shp)."
            )

        if len(shapefiles) > 1:
            raise ValueError(
                "ZIP file contains multiple Shapefiles. "
                "Please upload a ZIP containing one Shapefile."
            )

        shapefile = shapefiles[0]

        return _load_shapefile(shapefile)