from pyproj import Geod
from shapely.geometry import mapping

GEODETIC = Geod(ellps="WGS84")


def calculate_length(geometry) -> float:
    """
    Calculate geodesic length/perimeter in meters using WGS84.
    """

    if geometry is None or geometry.is_empty:
        return 0.0

    if geometry.geom_type == "LineString":
        length = GEODETIC.geometry_length(geometry)
        return abs(length)

    if geometry.geom_type == "MultiLineString":
        return sum(
            abs(GEODETIC.geometry_length(line))
            for line in geometry.geoms
        )

    if geometry.geom_type == "Polygon":
        _, perimeter = GEODETIC.geometry_area_perimeter(geometry)
        return abs(perimeter)

    if geometry.geom_type == "MultiPolygon":
        return sum(
            abs(GEODETIC.geometry_area_perimeter(polygon)[1])
            for polygon in geometry.geoms
        )

    return 0.0


def calculate_area(geometry) -> float:
    """
    Calculate geodesic area in square meters using WGS84.
    """

    if geometry is None or geometry.is_empty:
        return 0.0

    if geometry.geom_type == "Polygon":
        area, _ = GEODETIC.geometry_area_perimeter(geometry)
        return abs(area)

    if geometry.geom_type == "MultiPolygon":
        return sum(
            abs(
                GEODETIC.geometry_area_perimeter(polygon)[0]
            )
            for polygon in geometry.geoms
        )

    return 0.0


def _get_feature_name(row, index):
    """
    Get a useful name for a feature.

    Checks common name fields and falls back to
    'Feature 1', 'Feature 2', etc.
    """

    possible_fields = [
        "Name",
        "name",
        "NAME",
        "title",
        "Title",
        "label",
        "Label",
    ]

    for field in possible_fields:
        if field in row.index:
            value = row.get(field)

            if value is not None:
                value = str(value).strip()

                if value and value.lower() != "nan":
                    return value

    return f"Feature {index + 1}"



def calculate_measurements(gdf):
    """
    Calculate geodesic measurements for all geometries
    in a GeoDataFrame using the WGS84 ellipsoid.
    """

    if gdf.empty:
        return []

    # A CRS is required to interpret coordinates correctly.
    if gdf.crs is None:
        raise ValueError(
            "The uploaded file does not contain a CRS. "
            "A coordinate reference system is required "
            "to calculate accurate measurements."
        )

    # Convert projected coordinates to longitude/latitude.
    measurement_gdf = gdf.to_crs("EPSG:4326")

    results = []

    for index, (_, row) in enumerate(measurement_gdf.iterrows()):
        geometry = row.geometry

        if geometry is None or geometry.is_empty:
            continue

        result = {
            "name": _get_feature_name(row, index),
            "geometry_type": geometry.geom_type,
            "length_m": round(calculate_length(geometry), 3),
            "area_sq_m": round(calculate_area(geometry), 3),
            "geometry": mapping(geometry),
        }

        # IMPORTANT: append inside the loop.
        results.append(result)

    return results
