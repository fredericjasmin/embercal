# EmberCal

A harmonized burning activity calendar for Central America, built for the 2026 NASA Space Apps Challenge ("Harmonization of MODIS and VIIRS Hot Spots") by team **Bush Coding**.

**Live app:** https://embercal.vercel.app

EmberCal turns 25 years of NASA FIRMS active fire detections (MODIS since 2000, VIIRS since 2012) into one consistent monthly series, so that years before and after the change of sensor can be compared fairly. Pick a country, draw an area or type coordinates to see when it burns, which years were extreme and how the current month compares with its history. Calendar and hotspot data can be downloaded as CSV.

## Method in short

1. Same definition of a fire: presumed vegetation fires only (type 0), low-confidence detections removed.
2. Same pixel size: VIIRS 375 m detections in the same ~1 km cell and overpass are counted once.
3. Same number of satellites: Terra-only months (before July 2002) scaled by the Terra+Aqua / Terra ratio per month of the year (learned 2003-2019).
4. Cross-sensor calibration on the overlap years: VIIRS-1km / MODIS ratio per 1° area and month of the year, with shrinkage toward the area and regional values, keeping regional totals.
5. One series: measured VIIRS from 2012, calibrated MODIS before. When the S-NPP near-real-time feed stopped (2 Nov 2026), NOAA-20 VIIRS continues the series, scaled by the ratio measured on the days both observed.

Blind test (calibrated on 2012-2019, tested on 2020-2025, 4,188 area-months): median error 75% with raw MODIS, 39% with one regional ratio, **30% with EmberCal**. Details on the app's *Method* page.

## Run it

```bash
npm install
npm run dev
```

Rebuild the data (Python 3.12+):

```bash
python -m venv .venv && .venv/Scripts/pip install pandas numpy shapely
# 1) download FIRMS country yearly CSVs (2000-2025) into data/raw/ as <source>_<year>_<Country>.csv
.venv/Scripts/python pipeline/prep.py          # harmonized grid 2000-2025
# 2) put FIRMS_MAP_KEY=... in .env, then:
.venv/Scripts/python pipeline/fetch_recent.py  # 2026 from the FIRMS area API
.venv/Scripts/python pipeline/prep_recent.py   # adds 2026 to the series
```

## Data

- NASA FIRMS: MODIS Collection 6.1 (Terra, Aqua), VIIRS 375 m (Suomi NPP, NOAA-20). https://firms.modaps.eosdis.nasa.gov/
- Country boundaries: Natural Earth (public domain).
- Basemap: Esri World Gray Canvas.

## Use of AI

This project was built with the help of Claude (Anthropic), an AI assistant, which wrote most of the code in `pipeline/` and `src/` and proposed the technical details of the harmonization. The team reviewed and tested the results. All numbers come from NASA FIRMS data processed by this code. No NASA branding is used or modified.

Not an official NASA product.
