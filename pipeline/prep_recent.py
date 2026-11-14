"""
Add 2026 (Jan to today) to the harmonized series.

- Same quality filters as prep.py. Near-real-time files have no 'type' column, so
  detections at locations that the archive flags as volcano / static industrial
  source / offshore (type 1-3) are removed instead.
- VIIRS S-NPP is used while it exists (its NRT feed stops on 2026-11-02).
  After that, VIIRS NOAA-20 (same instrument, other satellite) fills the gap,
  scaled by the S-NPP / NOAA-20 ratio measured on the days both observed.
"""
import glob, gzip, json, os, calendar, datetime as dt
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, '..', 'data', 'raw')
NEW = os.path.join(HERE, '..', 'data', 'raw_2026')
OUT = os.path.join(HERE, '..', 'public', 'data')
grid = json.load(open(os.path.join(OUT, 'grid.json')))
CELL = grid['cell']
Y0, M0 = grid['start']


def month_idx(y, m):
    return (y - Y0) * 12 + (m - M0)


# static (non-vegetation) heat sources from the archive, at 0.01 deg
static = set()
for f in glob.glob(os.path.join(RAW, '*.csv')):
    d = pd.read_csv(f, usecols=['latitude', 'longitude', 'type'])
    d = d[d['type'] != 0]
    static |= set(zip(np.floor(d.latitude / 0.01).astype(int), np.floor(d.longitude / 0.01).astype(int)))
print('static 0.01deg cells', len(static))


def load(name):
    d = pd.read_csv(os.path.join(NEW, f'{name}_2026.csv'))
    if 'type' in d:
        d = d[d['type'].isna() | (d['type'] == 0)]
    if name == 'modis':
        d = d[pd.to_numeric(d['confidence'], errors='coerce') >= 30]
    else:
        d = d[d['confidence'].astype(str).str.lower().str[0] != 'l']
    d['fi'] = np.floor(d.latitude / 0.01).astype(int)
    d['fj'] = np.floor(d.longitude / 0.01).astype(int)
    d = d[[k not in static for k in zip(d.fi, d.fj)]].copy()
    dd = pd.to_datetime(d.acq_date)
    d['mi'] = month_idx(dd.dt.year, dd.dt.month)
    d['ci'] = np.floor(d.latitude / CELL).astype(int)
    d['cj'] = np.floor(d.longitude / CELL).astype(int)
    d['bi'] = np.floor(d.latitude).astype(int)
    d['bj'] = np.floor(d.longitude).astype(int)
    return d


m = load('modis')
s = load('viirs-snpp')
n = load('viirs-noaa20')
s1 = s.drop_duplicates(['fi', 'fj', 'acq_date', 'daynight'])
n1 = n.drop_duplicates(['fi', 'fj', 'acq_date', 'daynight'])

snpp_last = s.acq_date.max()
common = n1[n1.acq_date <= snpp_last]
ratio_n20 = len(s1) / len(common)
print(f'S-NPP last day {snpp_last}; S-NPP/NOAA-20 (1 km basis) = {ratio_n20:.3f}')

# harmonized = S-NPP 1km up to snpp_last, then NOAA-20 1km x ratio
h_s = s1.groupby(['ci', 'cj', 'mi']).size().astype(float)
h_n = n1[n1.acq_date > snpp_last].groupby(['ci', 'cj', 'mi']).size() * ratio_n20
H = h_s.add(h_n, fill_value=0).rename('H').reset_index()
MR = m.groupby(['ci', 'cj', 'mi']).size().rename('MR').reset_index()
VR = s.groupby(['ci', 'cj', 'mi']).size().rename('VR').reset_index()

cid = {tuple(c): i for i, c in enumerate(grid['cells'])}
countries = [c.replace(' ', '_') for c in grid['countries']]
new_cells, new_country = [], []
allp = pd.concat([m, s, n])
ccountry = allp.groupby(['ci', 'cj'])['country'].agg(lambda x: x.value_counts().index[0]).to_dict()


def cell_id(ci, cj):
    k = (int(ci), int(cj))
    if k not in cid:
        cid[k] = len(grid['cells']) + len(new_cells)
        new_cells.append([k[0], k[1]])
        new_country.append(countries.index(ccountry[k]) if ccountry.get(k) in countries else -1)
    return cid[k]


def flat(df, col, nd):
    out = []
    for ci, cj, mi, v in df[['ci', 'cj', 'mi', col]].itertuples(index=False):
        if v > 0:
            out += [cell_id(ci, cj), int(mi), round(float(v), nd)]
    return out


today = dt.date.fromisoformat(max(m.acq_date.max(), n.acq_date.max()))
last_mi = month_idx(today.year, today.month)
recent = {
    'months': last_mi + 1,
    'H': flat(H, 'H', 1), 'MR': flat(MR, 'MR', 0), 'VR': flat(VR, 'VR', 0),
    'newCells': new_cells, 'newCellCountry': new_country,
    'lastDay': today.isoformat(),
    'partialMonth': {'y': today.year, 'm': today.month - 1, 'days': today.day,
                     'daysInMonth': calendar.monthrange(today.year, today.month)[1]},
    'snppLastDay': snpp_last,
    'noaa20Ratio': round(ratio_n20, 3),
}
with open(os.path.join(OUT, 'recent.json'), 'w') as f:
    json.dump(recent, f, separators=(',', ':'))

# 2026 points for CSV export
cols = ['latitude', 'longitude', 'acq_date', 'acq_time', 'instrument', 'satellite', 'confidence', 'frp', 'daynight', 'country']
pts = pd.concat([m, s, n])
pts['instrument'] = pts['instrument'].fillna('VIIRS')
pts['satellite'] = pts['satellite'].replace({'N': 'Suomi NPP', 'N20': 'NOAA-20', 'T': 'Terra', 'A': 'Aqua'})
tiles = []
for (bi, bj), g in pts.groupby(['bi', 'bj']):
    with gzip.open(os.path.join(OUT, 'points', f'{bi}_{bj}_2026.csv.gz'), 'wt', newline='') as f:
        g[cols].sort_values('acq_date').to_csv(f, index=False)
    tiles.append([int(bi), int(bj)])
json.dump(tiles, open(os.path.join(OUT, 'points', 'index_2026.json'), 'w'))
print('recent months to', today, 'new cells', len(new_cells), 'H entries', len(recent['H']) // 3)
