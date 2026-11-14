"""
Harmonize MODIS (2000-2025) and VIIRS S-NPP (2012-2025) active fire hotspots
for Central America into one consistent monthly series ("VIIRS-1km equivalent").

Steps
1. Quality filter: type 0 (presumed vegetation fire), MODIS confidence >= 30,
   VIIRS confidence nominal/high.
2. VIIRS footprint aggregation: VIIRS pixels are 375 m, MODIS 1 km. Several VIIRS
   detections of one fire fall in the same ~1 km cell in the same overpass, so we
   count unique 0.01 deg cells per date and day/night ("VIIRS-1km").
3. Terra-only gap: before Aqua (Jul 2002) MODIS had one satellite. Months before
   2002-07 are scaled by (Terra+Aqua)/Terra, learned per month-of-year from 2003-2019.
4. Cross-sensor calibration: in the overlap years, ratio VIIRS-1km / MODIS per
   1 deg cell and month-of-year, shrunk toward the cell ratio and the regional
   month-of-year ratio when data are scarce.
5. Validation: calibrate on 2012-2019, predict 2020-2025 from MODIS and compare
   with measured VIIRS-1km. Baselines: no harmonization, one global ratio.
6. Harmonized series: before 2012 = calibrated MODIS; from 2012 = measured VIIRS-1km.

Outputs go to ../public/data.
"""
import glob, json, gzip, os
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, '..', 'data', 'raw')
OUT = os.path.join(HERE, '..', 'public', 'data')
os.makedirs(os.path.join(OUT, 'points'), exist_ok=True)

START_Y, START_M = 2000, 11          # first MODIS month
CELL = 0.1                           # app grid
K = 20.0                             # shrinkage pseudo-count (detections)


def month_idx(y, m):
    return (y - START_Y) * 12 + (m - START_M)


def load(prefix):
    frames = []
    for f in sorted(glob.glob(os.path.join(RAW, prefix + '_*.csv'))):
        country = os.path.basename(f).split('_', 2)[2][:-4]
        df = pd.read_csv(f)
        df['country'] = country
        frames.append(df)
    return pd.concat(frames, ignore_index=True)


print('loading')
m = load('modis')
v = load('viirs-snpp')
m = m[(m['type'] == 0) & (m['confidence'] >= 30)].copy()
v = v[(v['type'] == 0) & (v['confidence'] != 'l')].copy()

for df in (m, v):
    d = pd.to_datetime(df['acq_date'])
    df['y'] = d.dt.year
    df['mo'] = d.dt.month
    df['mi'] = month_idx(df['y'], df['mo'])
    df['ci'] = np.floor(df['latitude'] / CELL).astype(int)
    df['cj'] = np.floor(df['longitude'] / CELL).astype(int)
    df['bi'] = np.floor(df['latitude']).astype(int)      # 1 deg calibration block
    df['bj'] = np.floor(df['longitude']).astype(int)

# --- 2. VIIRS 1 km aggregation -------------------------------------------------
v['fi'] = np.floor(v['latitude'] / 0.01).astype(int)
v['fj'] = np.floor(v['longitude'] / 0.01).astype(int)
v1 = v.drop_duplicates(['fi', 'fj', 'acq_date', 'daynight']).copy()
print(f'VIIRS {len(v):,} -> VIIRS-1km {len(v1):,} ({len(v1)/len(v):.2f})')

# --- 3. Terra-only correction ----------------------------------------------------
both = m[(m['y'] >= 2003) & (m['y'] <= 2019)]
ta = both.groupby('mo').size()
t = both[both['satellite'] == 'Terra'].groupby('mo').size()
terra_factor = (ta / t).reindex(range(1, 13)).fillna((ta.sum() / t.sum()))
print('Terra->Terra+Aqua factor by month:', terra_factor.round(2).to_dict())
m['w'] = 1.0
pre_aqua = m['mi'] < month_idx(2002, 7)
m.loc[pre_aqua, 'w'] = m.loc[pre_aqua, 'mo'].map(terra_factor)


# --- 4. calibration ------------------------------------------------------------
def ratios(years):
    mm = m[m['y'].isin(years)]
    vv = v1[v1['y'].isin(years)]
    M = mm.groupby(['bi', 'bj', 'mo'])['w'].sum()
    V = vv.groupby(['bi', 'bj', 'mo']).size()
    tab = pd.concat({'M': M, 'V': V}, axis=1).fillna(0).reset_index()
    reg = tab.groupby('mo')[['M', 'V']].sum()
    reg_r = (reg['V'] / reg['M']).to_dict()                      # region x month
    blk = tab.groupby(['bi', 'bj'])[['M', 'V']].sum()
    glob_r = tab['V'].sum() / tab['M'].sum()
    # block ratio shrunk to global, then block x month shrunk to block and region
    blk_r = ((blk['V'] + K * glob_r) / (blk['M'] + K)).to_dict()

    def r_of(bi, bj, mo, Msum, Vsum):
        prior = blk_r.get((bi, bj), glob_r) * reg_r.get(mo, glob_r) / glob_r
        return (Vsum + K * prior) / (Msum + K)

    table = {}
    for row in tab.itertuples():
        table[(row.bi, row.bj, row.mo)] = r_of(row.bi, row.bj, row.mo, row.M, row.V)
    # mass preservation: shrinkage inflates sparse blocks, so rescale each
    # month-of-year so that calibrated MODIS reproduces the regional VIIRS total
    tab['r'] = [table[(a, b, c)] for a, b, c in zip(tab.bi, tab.bj, tab.mo)]
    tab['pred'] = tab['r'] * tab['M']
    fix = (tab.groupby('mo')['V'].sum() / tab.groupby('mo')['pred'].sum()).to_dict()
    table = {k: r * fix[k[2]] for k, r in table.items()}
    return table, blk_r, reg_r, glob_r


def apply_ratio(df_keys, table, blk_r, reg_r, glob_r):
    out = []
    for bi, bj, mo in df_keys:
        r = table.get((bi, bj, mo))
        if r is None:
            r = blk_r.get((bi, bj), glob_r) * reg_r.get(mo, glob_r) / glob_r
        out.append(r)
    return np.array(out)


# --- 5. validation -------------------------------------------------------------
cal_years, val_years = range(2012, 2020), range(2020, 2026)
table, blk_r, reg_r, glob_r = ratios(cal_years)
mv = m[m['y'].isin(val_years)].groupby(['bi', 'bj', 'mi', 'mo'])['w'].sum().rename('M')
vv = v1[v1['y'].isin(val_years)].groupby(['bi', 'bj', 'mi', 'mo']).size().rename('V')
val = pd.concat([mv, vv], axis=1).fillna(0).reset_index()
val['pred'] = val['M'] * apply_ratio(zip(val.bi, val.bj, val.mo), table, blk_r, reg_r, glob_r)
val['glob'] = val['M'] * glob_r


def metrics(pred, obs):
    sel = obs >= 10
    lp, lo = np.log1p(pred), np.log1p(obs)
    return {
        'r_log': round(float(np.corrcoef(lp, lo)[0, 1]), 3),
        'median_abs_pct_err': round(float(np.median(np.abs(pred[sel] - obs[sel]) / obs[sel]) * 100), 1),
        'total_bias_pct': round(float((pred.sum() - obs.sum()) / obs.sum() * 100), 1),
    }


validation = {
    'calibration_years': [2012, 2019], 'validation_years': [2020, 2025],
    'unit': '1 deg cell x month',
    'n': int(len(val)),
    'raw_modis': metrics(val['M'].values, val['V'].values),
    'single_global_ratio': metrics(val['glob'].values, val['V'].values),
    'harmonized': metrics(val['pred'].values, val['V'].values),
    'global_ratio': round(float(glob_r), 3),
    'terra_factor': {int(k): round(float(x), 3) for k, x in terra_factor.items()},
    'viirs_1km_dedup_ratio': round(len(v1) / len(v), 3),
}
# regional monthly totals for the validation chart
reg_val = val.groupby('mi')[['M', 'V', 'pred']].sum().reset_index()
validation['series'] = [[int(a), round(float(b), 1), round(float(c), 1), round(float(d), 1)]
                        for a, b, c, d in reg_val.itertuples(index=False)]
print(json.dumps({k: validation[k] for k in ('raw_modis', 'single_global_ratio', 'harmonized')}, indent=1))

# --- 6. final harmonized grid (calibrate on all overlap years) -----------------
table, blk_r, reg_r, glob_r = ratios(range(2012, 2026))
mc = m.groupby(['ci', 'cj', 'bi', 'bj', 'mi', 'mo'])['w'].sum().rename('M').reset_index()
mc['H'] = mc['M'] * apply_ratio(zip(mc.bi, mc.bj, mc.mo), table, blk_r, reg_r, glob_r)
vc = v1.groupby(['ci', 'cj', 'mi']).size().rename('V1').reset_index()
vr = v.groupby(['ci', 'cj', 'mi']).size().rename('VR').reset_index()
mr = m.groupby(['ci', 'cj', 'mi']).size().rename('MR').reset_index()

FIRST_VIIRS = month_idx(2012, 1)
LAST = month_idx(2025, 12)
h_pre = mc[mc['mi'] < FIRST_VIIRS][['ci', 'cj', 'mi', 'H']]
h_post = vc[vc['mi'] >= FIRST_VIIRS].rename(columns={'V1': 'H'})
H = pd.concat([h_pre, h_post])

cells = sorted(set(zip(H.ci, H.cj)) | set(zip(mr.ci, mr.cj)) | set(zip(vr.ci, vr.cj)))
cid = {c: i for i, c in enumerate(cells)}


def flat(df, col, nd):
    arr = []
    for ci, cj, mi, val_ in df[['ci', 'cj', 'mi', col]].itertuples(index=False):
        if val_ > 0:
            arr += [cid[(ci, cj)], int(mi), round(float(val_), nd)]
    return arr


allc = pd.concat([m[['ci', 'cj', 'country']], v[['ci', 'cj', 'country']]])
cc = allc.groupby(['ci', 'cj'])['country'].agg(lambda x: x.value_counts().index[0]).to_dict()
countries = sorted(set(cc.values()))
grid = {
    'countries': [c.replace('_', ' ') for c in countries],
    'cellCountry': [countries.index(cc[c]) if c in cc else -1 for c in cells],
    'cell': CELL, 'start': [START_Y, START_M], 'months': LAST + 1,
    'first_viirs': FIRST_VIIRS,
    'cells': [[int(a), int(b)] for a, b in cells],
    'H': flat(H, 'H', 1),        # harmonized, VIIRS-1km equivalent
    'MR': flat(mr, 'MR', 0),     # raw MODIS detections
    'VR': flat(vr, 'VR', 0),     # raw VIIRS detections
}
with open(os.path.join(OUT, 'grid.json'), 'w') as f:
    json.dump(grid, f, separators=(',', ':'))
with open(os.path.join(OUT, 'validation.json'), 'w') as f:
    json.dump(validation, f, separators=(',', ':'))
ratio_out = [[int(bi), int(bj), int(mo), round(float(r), 3)] for (bi, bj, mo), r in table.items()]
with open(os.path.join(OUT, 'ratios.json'), 'w') as f:
    json.dump({'global': glob_r, 'block': [[int(a), int(b), round(float(r), 3)] for (a, b), r in blk_r.items()],
               'region_month': {int(k): round(float(x), 3) for k, x in reg_r.items()},
               'table': ratio_out}, f, separators=(',', ':'))

# --- points per 1 deg tile for CSV export --------------------------------------
cols = ['latitude', 'longitude', 'acq_date', 'acq_time', 'instrument', 'satellite', 'confidence', 'frp', 'daynight', 'country']
allp = pd.concat([m[cols + ['bi', 'bj']], v[cols + ['bi', 'bj']]])
allp['satellite'] = allp['satellite'].replace({'N': 'Suomi NPP'})
tiles = []
for (bi, bj), g in allp.groupby(['bi', 'bj']):
    name = f'{bi}_{bj}.csv.gz'
    with gzip.open(os.path.join(OUT, 'points', name), 'wt', newline='') as f:
        g[cols].sort_values('acq_date').to_csv(f, index=False)
    tiles.append([int(bi), int(bj)])
with open(os.path.join(OUT, 'points', 'index.json'), 'w') as f:
    json.dump(tiles, f)

print('cells', len(cells), 'H', len(grid['H']) // 3, 'tiles', len(tiles))
for fn in ('grid.json', 'validation.json', 'ratios.json'):
    print(fn, os.path.getsize(os.path.join(OUT, fn)) // 1024, 'KB')
