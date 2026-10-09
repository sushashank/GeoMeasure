from pathlib import Path
import zipfile
import shutil

import geopandas as gpd
from shapely.geometry import Polygon


# Output folder
output_dir = Path("test_shapefile")
output_dir.mkdir(exist_ok=True)

# Create a simple test polygon
polygon = Polygon([
    (77.5800, 12.9700),
    (77.5900, 12.9700),
    (77.5900, 12.9800),
    (77.5800, 12.9800),
    (77.5800, 12.9700)
])

# Create GeoDataFrame
gdf = gpd.GeoDataFrame(
    {
        "name": ["Test Area"]
    },
    geometry=[polygon],
    crs="EPSG:4326"
)

# Shapefile path
shapefile_path = output_dir / "test_area.shp"

# Write Shapefile
gdf.to_file(shapefile_path, driver="ESRI Shapefile")

# Create ZIP
zip_path = Path("test_shapefile.zip")

with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zip_file:
    for file in output_dir.iterdir():
        zip_file.write(file, arcname=file.name)

print("Shapefile created successfully!")
print(f"ZIP file: {zip_path.absolute()}")

# Show contents
print("\nZIP contents:")

with zipfile.ZipFile(zip_path, "r") as zip_file:
    for name in zip_file.namelist():
        print(" -", name)