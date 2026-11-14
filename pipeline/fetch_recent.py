"""
Download 2026 hotspots for Central America from the FIRMS area API (5-day chunks),
keep only points inside the 7 countries, and save one CSV per source.
Needs FIRMS_MAP_KEY in ../.env
"""
import os, io, time, datetime as dt, json
from concurrent.futures import ThreadPoolExecutor
import urllib.request
import pandas as pd
from shapely.geometry import shape, Point
from shapely.prepared import prep

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
OUT = os.path.join(ROOT, 'data', 'raw_2026')
os.makedirs(OUT, exist_ok=True)

KEY = None
for line in open(os.path.join(ROOT, '.env'), encoding='utf-8'):
    if line.startswith('FIRMS_MAP_KEY='):
        KEY = line.split('=', 1)[1].strip().strip('"')
assert KEY, 'FIRMS_MAP_KEY missing in app/.env'

BBOX = '-92.3,7.1,-77.1,18.5'
COUNTRIES = {'GTM': 'Guatemala', 'BLZ': 'Belize', 'HND': 'Honduras', 'SLV': 'El_Salvador',
             'NIC': 'Nicaragua', 'CRI': 'Costa_Rica', 'PAN': 'Panama'}

avail = pd.read_csv(f'https://firms.modaps.eosdis.nasa.gov/api/data_availability/csv/{KEY}/ALL')
avail = avail.set_index('data_id')
START = dt.date(2026, 1, 1)


def ranges(source):
    a = avail.loc[source]
    lo = max(START, dt.date.fromisoformat(a.min_date))
    hi = dt.date.fromisoformat(a.max_date)
    d = lo
    while d <= hi:
        n = min(5, (hi - d).days + 1)
        yield d, n
        d += dt.timedelta(days=n)


def get(source, d, n):
    url = f'https://firms.modaps.eosdis.nasa.gov/api/area/csv/{KEY}/{source}/{BBOX}/{n}/{d.isoformat()}'
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                txt = r.read().decode('utf-8')
            if txt.startswith('latitude'):
                return pd.read_csv(io.StringIO(txt))
            if 'Invalid' in txt or 'Error' in txt:
                raise RuntimeError(txt[:120])
            return pd.DataFrame()
        except Exception as e:
            err = e
            time.sleep(3 * (attempt + 1))
    raise RuntimeError(f'{source} {d}: {err}')


geo = json.load(open(os.path.join(ROOT, 'data', 'geo', 'ne_50m_admin0.geojson'), encoding='utf-8'))
polys = {}
for f in geo['features']:
    iso = f['properties'].get('ADM0_A3') or f['properties'].get('ISO_A3')
    if iso in COUNTRIES:
        polys[COUNTRIES[iso]] = prep(shape(f['geometry']).buffer(0.02))
assert len(polys) == 7, polys.keys()


def country_of(lat, lon):
    p = Point(lon, lat)
    for name, poly in polys.items():
        if poly.contains(p):
            return name
    return None


SOURCES = {
    'modis': ['MODIS_SP', 'MODIS_NRT'],
    'viirs-snpp': ['VIIRS_SNPP_SP', 'VIIRS_SNPP_NRT'],
    'viirs-noaa20': ['VIIRS_NOAA20_SP', 'VIIRS_NOAA20_NRT'],
}

for name, srcs in SOURCES.items():
    jobs = [(s, d, n) for s in srcs for d, n in ranges(s)]
    print(name, len(jobs), 'requests', flush=True)
    with ThreadPoolExecutor(4) as ex:
        frames = list(ex.map(lambda j: get(*j).assign(source=j[0]), jobs))
    df = pd.concat([f for f in frames if len(f)], ignore_index=True)
    # SP has priority over NRT on overlapping days
    if 'acq_date' in df:
        sp = df[df.source.str.endswith('_SP')]
        last_sp = sp.acq_date.max() if len(sp) else '0000'
        df = df[df.source.str.endswith('_SP') | (df.acq_date > last_sp)]
    df['country'] = [country_of(a, b) for a, b in zip(df.latitude, df.longitude)]
    df = df[df.country.notna()]
    df.to_csv(os.path.join(OUT, f'{name}_2026.csv'), index=False)
    print(name, len(df), 'points', df.acq_date.min(), '->', df.acq_date.max(), flush=True)
