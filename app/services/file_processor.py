
from pathlib import Path, PurePosixPath, PureWindowsPath
import stat
import tempfile
import zipfile

import geopandas as gpd


MAX_ZIP_MEMBERS = 200
MAX_ZIP_MEMBER_BYTES = 50 * 1024 * 1024
MAX_ZIP_TOTAL_BYTES = 100 * 1024 * 1024


def load_geospatial_file(file_path: str) -> gpd.GeoDataFrame:
    """Load a supported geospatial file."""

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

    raise ValueError(f"Unsupported file format: {extension}")


def _load_kml(path: Path) -> gpd.GeoDataFrame:
    """Load a KML file."""
    try:
        return gpd.read_file(path, driver="KML")
    except Exception as exc:
        raise ValueError(f"Unable to read KML file: {exc}") from exc


def _load_shapefile(path: Path) -> gpd.GeoDataFrame:
    """Load a Shapefile."""
    try:
        return gpd.read_file(path)
    except Exception as exc:
        raise ValueError(f"Unable to read Shapefile: {exc}") from exc


def _safe_extract_zip(
    zip_ref: zipfile.ZipFile,
    extract_dir: Path,
) -> None:
    """Extract ZIP members after validating paths and size limits."""

    members = zip_ref.infolist()

    if not members:
        raise ValueError("The ZIP file is empty.")

    if len(members) > MAX_ZIP_MEMBERS:
        raise ValueError("The ZIP contains too many files.")

    root = extract_dir.resolve()
    seen_paths = set()
    declared_total = 0
    actual_total = 0

    for info in members:
        raw_name = info.filename
        normalized_name = raw_name.replace("\\", "/")
        relative_path = PurePosixPath(normalized_name)
        windows_path = PureWindowsPath(raw_name)

        if (
            not normalized_name
            or normalized_name.startswith("/")
            or windows_path.is_absolute()
            or windows_path.drive
            or ".." in relative_path.parts
        ):
            raise ValueError("The ZIP contains an unsafe file path.")

        mode = (info.external_attr >> 16) & 0xFFFF

        if stat.S_ISLNK(mode):
            raise ValueError("Symbolic links are not allowed in ZIP files.")

        relative_name = relative_path.as_posix()
        path_key = relative_name.casefold()

        if path_key in seen_paths:
            raise ValueError("The ZIP contains duplicate file paths.")
        seen_paths.add(path_key)

        target = extract_dir.joinpath(*relative_path.parts)

        if info.is_dir():
            target.mkdir(parents=True, exist_ok=True)
            continue

        if info.file_size > MAX_ZIP_MEMBER_BYTES:
            raise ValueError("A ZIP member exceeds the 50 MB limit.")

        declared_total += info.file_size
        if declared_total > MAX_ZIP_TOTAL_BYTES:
            raise ValueError("The ZIP contents exceed the 100 MB limit.")

        # Resolve and confirm the output remains inside the extraction root.
        resolved_target = target.resolve()
        if not resolved_target.is_relative_to(root):
            raise ValueError("The ZIP contains an unsafe file path.")

        target.parent.mkdir(parents=True, exist_ok=True)
        member_written = 0

        with zip_ref.open(info, "r") as source, target.open("wb") as dest:
            while True:
                chunk = source.read(1024 * 1024)
                if not chunk:
                    break

                member_written += len(chunk)
                actual_total += len(chunk)

                if member_written > MAX_ZIP_MEMBER_BYTES:
                    raise ValueError("A ZIP member exceeds the 50 MB limit.")

                if actual_total > MAX_ZIP_TOTAL_BYTES:
                    raise ValueError("The ZIP contents exceed the 100 MB limit.")

                dest.write(chunk)

        if member_written != info.file_size:
            raise ValueError("The ZIP contains an incomplete or corrupted file.")


def _load_shapefile_zip(path: Path) -> gpd.GeoDataFrame:
    """Safely extract a ZIP and load its single Shapefile."""

    try:
        with zipfile.ZipFile(path, "r") as zip_ref:
            with tempfile.TemporaryDirectory() as temp_dir:
                extract_dir = Path(temp_dir)
                _safe_extract_zip(zip_ref, extract_dir)

                shapefiles = [
                    item
                    for item in extract_dir.rglob("*")
                    if item.is_file() and item.suffix.lower() == ".shp"
                ]

                if not shapefiles:
                    raise ValueError(
                        "ZIP file does not contain a Shapefile (.shp)."
                    )

                if len(shapefiles) > 1:
                    raise ValueError(
                        "ZIP file contains multiple Shapefiles. "
                        "Please upload a ZIP containing one Shapefile."
                    )

                return _load_shapefile(shapefiles[0])

    except (zipfile.BadZipFile, RuntimeError, EOFError) as exc:
        raise ValueError(
            "Invalid, encrypted, or corrupted ZIP file."
        ) from exc
