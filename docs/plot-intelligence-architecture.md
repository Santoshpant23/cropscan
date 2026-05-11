# Plot Intelligence Architecture

CropScan should move from a reactive scanner toward a plot intelligence product, but the remote-sensing features should not be jammed into the current scan endpoint. They need a separate data model and background jobs.

## Product Wedge

The first daily-use screen should answer:

- What changed in this plot?
- What risk matters today?
- What action should the grower take next?

That is stronger than a generic chatbot because it uses the user's plot boundary, weather, satellite history, scan history, and location.

## Data Model

Initial MongoDB collections:

- `plots`
  - `user_id`
  - `name`
  - `crop`
  - `geometry_geojson`
  - `centroid`
  - `created_at`
  - `updated_at`

- `plot_observations`
  - `plot_id`
  - `source`: `scan`, `sentinel2`, `weather`, `manual`
  - `observed_at`
  - `metrics`
  - `notes`

- `plot_daily_cards`
  - `plot_id`
  - `date`
  - `risk_level`
  - `headline`
  - `actions`
  - `signals`

## Build Sequence

1. Manual plot registration
   - Start with a simple map polygon or lat/lon box.
   - Do not start with SAM2. The product value can be tested without segmentation.

2. NDVI time series
   - Use Microsoft Planetary Computer or Google Earth Engine for Sentinel-2/HLS reads.
   - Store clipped plot-level metrics, not full rasters.
   - Show NDVI trend and anomaly against a baseline.

3. Weather-risk cards
   - Use Open-Meteo first for frost and rain risk.
   - Later replace with ERA5-Land plus DEM downscaling.

4. SAM2 plot boundary assist
   - Add after manual plot registration works.
   - Input: phone photo plus user tap.
   - Output: mask/polygon candidate that user confirms.

5. Foundation model experiments
   - Keep Prithvi/TerraTorch in the notebook/research track.
   - Do not make the production backend depend on a 300M parameter model for the first demo.

## Why Offline Still Matters

Offline inference is a good v2/v3 feature for rural users, but it should start as a small triage path:

1. Export MobileNetV2 TorchScript or ONNX.
2. Run local first-pass inference when the network is weak.
3. Ask for cloud consent only for richer explanation, chat, or multi-source plot intelligence.

This protects the pitch: CropScan can work when connectivity is weak, but the current web app does not need a full native offline stack yet.
