from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def verify_auth(x_api_key: str = Header(None)):
    if x_api_key != "Emputors":
        raise HTTPException(status_code=401, detail="Acceso denegado")

@app.get("/")
def read_root():
    return {"message": "LEAT11 Engine is running!"}

def process_csv(file_path):
    if not os.path.exists(file_path):
        return [], 0
    try:
        try:
            df = pd.read_csv(file_path, encoding="latin1", sep=";")
        except:
            df = pd.read_csv(file_path, encoding="latin1", sep=",")

        columns_to_keep = ['Civ List', 'Picks', 'Wins', 'Win Rate', 'CDPS Score']
        if not all(col in df.columns for col in columns_to_keep):
            return [], 0

        df_clean = df[columns_to_keep].dropna(subset=['Civ List']).copy()
        df_clean['Picks'] = df_clean['Picks'].astype(str).str.split('.').str[0].replace('', '0').astype(int)
        df_clean['Wins'] = df_clean['Wins'].astype(str).str.split('.').str[0].replace('', '0').astype(int)
        df_clean['Win Rate'] = df_clean['Win Rate'].astype(str).str.replace('%', '').str.replace(',', '.').astype(float)
        df_clean['Win Rate'] = np.where(df_clean['Win Rate'] > 1, df_clean['Win Rate'] / 100, df_clean['Win Rate'])
        df_clean['CDPS Score'] = df_clean['CDPS Score'].astype(str).str.replace(',', '.').astype(float)
        
        total_matches = int(df_clean['Picks'].sum() / 2)
        df_sorted = df_clean.sort_values(by='CDPS Score', ascending=False).head(10)
        return df_sorted.to_dict(orient='records'), total_matches
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return [], 0

@app.get("/api/map/{map_name}", dependencies=[Depends(verify_auth)])
def get_map_data(map_name: str, x_api_key: str = Header(None)):
    try:
        dataset_all, matches_all = process_csv(f"data/{map_name}_All.csv")
        dataset_elite, matches_elite = process_csv(f"data/{map_name}_VOD.csv")
        if not dataset_all and not dataset_elite:
            return {"error": f"Data files for map '{map_name}' not found."}
        return {
            "dataset_all": dataset_all, "dataset_elite": dataset_elite,
            "total_matches_all": matches_all, "total_matches_elite": matches_elite
        }
    except Exception as e:
        return {"error": str(e)}

# --- ENDPOINT DEL META GLOBAL ---
@app.get("/api/global", dependencies=[Depends(verify_auth)])
def get_global_meta(x_api_key: str = Header(None)):
    try:
        map_pool = ["Skukuza", "Fortified Clearing", "Islands", "Coast to Mountain", "Kawasan", "Thames", "Stranded", "Sardis", "Arabia", "Megarandom"]
        all_dfs = []
        
        for map_name in map_pool:
            file_path = f"data/{map_name}_All.csv"
            if os.path.exists(file_path):
                try:
                    df = pd.read_csv(file_path, encoding="latin1", sep=";")
                except:
                    df = pd.read_csv(file_path, encoding="latin1", sep=",")
                
                cols = ['Civ List', 'Picks', 'Wins', 'Win Rate', 'CDPS Score']
                if all(col in df.columns for col in cols):
                    df_clean = df[cols].dropna(subset=['Civ List']).copy()
                    df_clean['Map'] = map_name
                    all_dfs.append(df_clean)
        
        if not all_dfs:
            return {"error": "No data files found to aggregate."}
            
        df_all = pd.concat(all_dfs, ignore_index=True)
        
        df_all['Picks'] = df_all['Picks'].astype(str).str.split('.').str[0].replace('', '0').astype(int)
        df_all['Wins'] = df_all['Wins'].astype(str).str.split('.').str[0].replace('', '0').astype(int)
        df_all['Win Rate'] = df_all['Win Rate'].astype(str).str.replace('%', '').str.replace(',', '.').astype(float)
        df_all['Win Rate'] = np.where(df_all['Win Rate'] > 1, df_all['Win Rate'] / 100, df_all['Win Rate'])
        df_all['CDPS Score'] = df_all['CDPS Score'].astype(str).str.replace(',', '.').astype(float)
        
        def get_op(min_picks):
            res = df_all[df_all['Picks'] >= min_picks].sort_values(by='CDPS Score', ascending=False).head(10)
            return res.to_dict(orient='records')

        presence = df_all.groupby('Civ List').agg({'Picks': 'sum', 'Wins': 'sum'}).reset_index()
        presence['Global WR'] = np.where(presence['Picks'] > 0, presence['Wins'] / presence['Picks'], 0)
        presence = presence.sort_values(by='Picks', ascending=False).head(10)
        
        traps = df_all[(df_all['Picks'] >= 10) & (df_all['Win Rate'] < 0.40)].sort_values(by='Win Rate', ascending=True).head(10)
        
        versatile_df = df_all[df_all['CDPS Score'] >= 60]
        versatile = versatile_df.groupby('Civ List').agg(
            Viable_Maps=('Map', 'count'),
            Avg_CDPS=('CDPS Score', 'mean'),
            Map_List=('Map', lambda x: ', '.join(x))
        ).reset_index()
        versatile = versatile.sort_values(by=['Viable_Maps', 'Avg_CDPS'], ascending=[False, False]).head(10)

        return {
            "op_5": get_op(5),
            "op_10": get_op(10),
            "op_20": get_op(20),
            "highest_presence": presence.to_dict(orient='records'),
            "global_traps": traps.to_dict(orient='records'),
            "most_versatile": versatile.to_dict(orient='records')
        }
        
    except Exception as e:
        return {"error": str(e)}

# --- ENDPOINT PARA EL DRAFT ASSISTANT ---

MAP_TRANSLATION = {
    "Skukuza": "Socotra",
    "Fortified Clearing": "Fortified_Clearing",
    "Thames": "Valley",
    "Sardis": "Arena",
    "Coast to Mountain": "african_clearing"
}

def get_clean_map(map_name):
    # Traduce los mapas al formato interno
    for k, v in MAP_TRANSLATION.items():
        if map_name.lower().strip() == k.lower():
            return v.lower()
    return map_name.replace(" ", "_").lower()

@app.post("/api/draft/analyze", dependencies=[Depends(verify_auth)])
async def analyze_draft(data: dict, x_api_key: str = Header(None)):
    try:
        path = "data/matriz_counters_draft.csv"
        if not os.path.exists(path): 
            return {"error": "Falta matriz_counters_draft.csv en la carpeta data/"}
        
        df = pd.read_csv(path, sep=";")
        df.columns = [c.strip() for c in df.columns]
        
        df['Mapa'] = df['Mapa'].astype(str).str.lower().str.strip()
        df['Mi_Civ'] = df['Mi_Civ'].astype(str).str.lower().str.strip()
        df['Civ_Rival'] = df['Civ_Rival'].astype(str).str.lower().str.strip()
        
        df['Win_Rate'] = pd.to_numeric(df['Win_Rate'].astype(str).str.replace('%', '').str.replace(',', '.'), errors='coerce').fillna(0)
        if 'Partidas' in df.columns:
            df['Partidas'] = pd.to_numeric(df['Partidas'], errors='coerce').fillna(0)
        if 'Victorias' in df.columns:
            df['Victorias'] = pd.to_numeric(df['Victorias'], errors='coerce').fillna(0)

        p1 = [p.lower().strip() for p in data.get('p1_picks', [])]
        p2 = [p.lower().strip() for p in data.get('p2_picks', [])]
        bans = [b.lower().strip() for b in data.get('bans', [])]
        excluded = p1 + p2 + bans
        
        top_wr = {}
        top_cdps = {}
        opp_probs = {}
        matchups = {}
        counters_ladder = {}
        counters_pros = {}

        def fmt_k(val):
            if val >= 1000:
                return f"{val/1000:.1f}k".replace(".0k", "k").replace('.', ',')
            return str(int(val))

        def get_clean_map(map_name):
            translation = {
                "skukuza": "socotra",
                "fortified clearing": "fortified_clearing",
                "thames": "valley",
                "sardis": "arena",
                "coast to mountain": "african_clearing"
            }
            m_low = map_name.lower().strip()
            for k, v in translation.items():
                if m_low == k:
                    return v
            return map_name.replace(" ", "_").lower()

        for m_disp in data.get('maps', []):
            if not m_disp: continue
            m_int = get_clean_map(m_disp)
            
            counters_ladder[m_disp] = {}
            counters_pros[m_disp] = {}
            
            path_all = f"data/{m_disp}_All.csv"
            df_all = pd.DataFrame()
            pro_matchups_data = []
            
            if os.path.exists(path_all):
                try:
                    df_all = pd.read_csv(path_all, encoding="latin1", sep=";")
                except:
                    df_all = pd.read_csv(path_all, encoding="latin1", sep=",")
                
                if not df_all.empty:
                    df_all.columns = [str(c).strip() for c in df_all.columns]
                    
                    c_civ = 'Civ List' if 'Civ List' in df_all.columns else df_all.columns[0]
                    df_all['Civ List Lower'] = df_all[c_civ].astype(str).str.lower().str.strip()
                    
                    if 'CDPS Score' in df_all.columns:
                        df_all['CDPS_Num'] = pd.to_numeric(df_all['CDPS Score'].astype(str).str.replace(',', '.'), errors='coerce').fillna(0)
                    else:
                        df_all['CDPS_Num'] = 0
                        
                    if 'Picks' in df_all.columns:
                        df_all['Picks_Num'] = pd.to_numeric(df_all['Picks'].astype(str).str.split('.').str[0], errors='coerce').fillna(0).astype(int)
                    else:
                        df_all['Picks_Num'] = 0

                    if df_all.shape[1] >= 3:
                        for i in range(df_all.shape[1] - 2):
                            cA = df_all.iloc[:, i].astype(str).str.lower().str.strip()
                            cB = df_all.iloc[:, i+1].astype(str).str.lower().str.strip()
                            cW = df_all.iloc[:, i+2].astype(str).str.lower().str.strip()
                            
                            valid_rows = (cW != '') & (cW != 'nan') & (cW != 'none')
                            if valid_rows.sum() >= 2:
                                match_pct = ((cW[valid_rows] == cA[valid_rows]) | (cW[valid_rows] == cB[valid_rows])).sum() / valid_rows.sum()
                                if match_pct >= 0.8:
                                    df_pros = pd.DataFrame({'cA': cA, 'cB': cB, 'cW': cW})
                                    valid = df_pros[(df_pros['cA'] != 'nan') & (df_pros['cB'] != 'nan') & (df_pros['cW'] != 'nan')]
                                    for _, r in valid.iterrows():
                                        pro_matchups_data.append({'civA': r['cA'], 'civB': r['cB'], 'winner': r['cW']})
                                    break

            m_probs = {}
            total_weight = 0
            for p in p2:
                matches = df[(df['Mapa'] == m_int) & (df['Mi_Civ'] == p)]['Partidas'].sum()
                cdps_val = 0
                tourney_picks = 0
                if not df_all.empty and 'Civ List Lower' in df_all.columns:
                    cdps_row = df_all[df_all['Civ List Lower'] == p]
                    if not cdps_row.empty:
                        cdps_val = max(0, cdps_row['CDPS_Num'].values[0])
                        tourney_picks = cdps_row['Picks_Num'].values[0]
                
                confidence = min(1.0, tourney_picks / 15.0)
                cdps_multiplier = 1 + ((cdps_val / 100.0) * confidence)
                weight = (matches + 1) * cdps_multiplier
                m_probs[p] = weight
                total_weight += weight
            
            opp_probs[m_disp] = {}
            for p in p2:
                opp_probs[m_disp][p] = m_probs[p] / total_weight if total_weight > 0 else 0

            matchups[m_disp] = {}
            for p1_civ in p1:
                for p2_civ in p2:
                    row = df[(df['Mapa'] == m_int) & (df['Mi_Civ'] == p1_civ) & (df['Civ_Rival'] == p2_civ)]
                    if not row.empty:
                        games = row['Partidas'].sum()
                        vics = row['Victorias'].sum()
                        wr = vics / games if games > 0 else 0
                        matchups[m_disp][f"{p1_civ}_{p2_civ}"] = {"wr": wr, "games": int(games)}

            df_map = df[(df['Mapa'] == m_int) & (~df['Mi_Civ'].isin(excluded))]
            if not df_map.empty and 'Victorias' in df_map.columns:
                df_g = df_map.groupby('Mi_Civ').agg({'Partidas': 'sum', 'Victorias': 'sum'}).reset_index()
                df_g = df_g[df_g['Partidas'] >= 50]
                if not df_g.empty:
                    df_g['WR'] = df_g['Victorias'] / df_g['Partidas']
                    all_wr = df_g.sort_values(['WR', 'Partidas'], ascending=[False, False])
                    top_wr[m_disp] = [f"{str(r['Mi_Civ']).title()[:4]} ({(r['WR']*100):.1f}% | {fmt_k(r['Partidas'])})".replace('.', ',') for _, r in all_wr.iterrows()]
                else:
                    top_wr[m_disp] = []
            else:
                top_wr[m_disp] = []

            if not df_all.empty and 'CDPS_Num' in df_all.columns:
                df_v = df_all[~df_all['Civ List Lower'].isin(excluded) & (df_all['CDPS_Num'] > 0)]
                all_cdps = df_v.sort_values('CDPS_Num', ascending=False)
                top_cdps[m_disp] = [f"{str(r['Civ List Lower']).title()[:4]} ({r['CDPS_Num']:.1f} | {fmt_k(r['Picks_Num'])})".replace('.', ',') for _, r in all_cdps.iterrows()]
            else:
                top_cdps[m_disp] = []

            for p2_civ in p2:
                # 1. COUNTERS LADDER
                df_c = df[(df['Mapa'] == m_int) & (df['Civ_Rival'] == p2_civ)]
                df_c = df_c[~df_c['Mi_Civ'].isin(excluded) & (df_c['Partidas'] >= 10)].copy()
                if not df_c.empty:
                    df_c['WR'] = df_c['Victorias'] / df_c['Partidas']
                    df_c = df_c[df_c['WR'] > 0.55] 
                    
                    if not df_c.empty:
                        df_c['Score'] = df_c['WR'] * (df_c['Partidas'] ** 0.5)
                        top_3_l = df_c.sort_values('Score', ascending=False).head(3)
                        temp_ladder = [f"{str(r['Mi_Civ']).title()[:4]} ({(r['WR']*100):.1f}% | {fmt_k(r['Partidas'])})".replace('.', ',') for _, r in top_3_l.iterrows()]
                        counters_ladder[m_disp][p2_civ] = temp_ladder + ["-"] * (3 - len(temp_ladder))
                    else:
                        counters_ladder[m_disp][p2_civ] = ["-", "-", "-"]
                else:
                    counters_ladder[m_disp][p2_civ] = ["-", "-", "-"]

                # 2. COUNTERS PROS
                pro_counters = ["-", "-", "-"]
                if pro_matchups_data:
                    stats = {}
                    for match in pro_matchups_data:
                        cA, cB, cW = match['civA'], match['civB'], match['winner']
                        if cA == p2_civ or cB == p2_civ:
                            opponent = cB if cA == p2_civ else cA
                            if opponent in excluded or opponent == p2_civ:
                                continue
                            
                            if opponent not in stats:
                                stats[opponent] = {'games': 0, 'wins': 0}
                            
                            stats[opponent]['games'] += 1
                            if cW == opponent:
                                stats[opponent]['wins'] += 1
                    
                    valid_stats = []
                    for opp, data_stat in stats.items():
                        if data_stat['games'] >= 2: 
                            wr = data_stat['wins'] / data_stat['games']
                            if wr > 0.55:
                                score = wr * (data_stat['games'] ** 0.5)
                                valid_stats.append({'civ': opp, 'wr': wr, 'games': data_stat['games'], 'score': score})
                    
                    if valid_stats:
                        valid_stats.sort(key=lambda x: x['score'], reverse=True)
                        top_3 = valid_stats[:3]
                        temp_pros = [f"{str(r['civ']).title()[:4]} ({(r['wr']*100):.1f}% | {fmt_k(r['games'])})".replace('.', ',') for r in top_3]
                        pro_counters = temp_pros + ["-"] * (3 - len(temp_pros))
                
                counters_pros[m_disp][p2_civ] = pro_counters

        return {"top_wr": top_wr, "top_cdps": top_cdps, "opp_probs": opp_probs, "matchups": matchups, "counters_ladder": counters_ladder, "counters_pros": counters_pros}
    except Exception as e:
        import traceback
        traceback.print_exc() 
        return {"error": str(e)}

# --- ENDPOINT PARA CIV ANALYZER & H2H ---

@app.post("/api/civ/analyze", dependencies=[Depends(verify_auth)])
async def analyze_civs(data: dict, x_api_key: str = Header(None)):
    try:
        civ_a = data.get("civ_a", "").lower().strip()
        civ_b = data.get("civ_b", "").lower().strip()
        
        if not civ_a:
            return {"error": "Civ A is required"}

        map_pool = ["Skukuza", "Fortified Clearing", "Islands", "Coast to Mountain", "Kawasan", "Thames", "Stranded", "Sardis", "Arabia", "Megarandom"]
        result = {"civ_a": civ_a.title(), "civ_b": civ_b.title() if civ_b else None, "maps": {}}

        path_counters = "data/matriz_counters_draft.csv"
        df_counters = pd.DataFrame()
        if os.path.exists(path_counters):
            df_counters = pd.read_csv(path_counters, sep=";")
            df_counters.columns = [c.strip() for c in df_counters.columns]
            df_counters['Mapa'] = df_counters['Mapa'].astype(str).str.lower().str.strip()
            df_counters['Mi_Civ'] = df_counters['Mi_Civ'].astype(str).str.lower().str.strip()
            df_counters['Civ_Rival'] = df_counters['Civ_Rival'].astype(str).str.lower().str.strip()
            if 'Partidas' in df_counters.columns:
                df_counters['Partidas'] = pd.to_numeric(df_counters['Partidas'], errors='coerce').fillna(0)
            if 'Victorias' in df_counters.columns:
                df_counters['Victorias'] = pd.to_numeric(df_counters['Victorias'], errors='coerce').fillna(0)

        def parse_picks(x):
            try:
                x = str(x).lower().strip()
                if 'k' in x:
                    return int(float(x.replace('k', '').replace(',', '.')) * 1000)
                x = x.replace(' ', '').replace('.', '')
                return int(float(x))
            except:
                return 0

        import glob
        for map_name in map_pool:
            map_data = {
                "a": {"wr": 0, "rank_wr": "-", "picks_w": 0, "cdps": 0, "rank_cdps": "-", "picks_c": 0},
                "b": {"wr": 0, "rank_wr": "-", "picks_w": 0, "cdps": 0, "rank_cdps": "-", "picks_c": 0} if civ_b else None,
                "matchup": None,
                "matchup_cdps": None
            }
            
            m_int = get_clean_map(map_name) if 'get_clean_map' in globals() else map_name.lower().replace(" ", "")
            
            # 1. WR y RANK consolidados desde matriz_counters_draft.csv (La matriz de 51k partidas)
            if not df_counters.empty:
                df_map_counters = df_counters[df_counters['Mapa'] == m_int]
                if not df_map_counters.empty:
                    df_g = df_map_counters.groupby('Mi_Civ').agg({'Partidas': 'sum', 'Victorias': 'sum'}).reset_index()
                    df_g['WR'] = np.where(df_g['Partidas'] > 0, df_g['Victorias'] / df_g['Partidas'], 0)
                    df_g = df_g[df_g['Partidas'] >= 50].sort_values(by=['WR', 'Partidas'], ascending=[False, False]).reset_index(drop=True)
                    
                    for target, key in [(civ_a, "a"), (civ_b, "b")]:
                        if target:
                            row_wr = df_g[df_g['Mi_Civ'].str.startswith(target[:4])]
                            if not row_wr.empty:
                                map_data[key]["rank_wr"] = int(row_wr.index[0]) + 1
                                map_data[key]["wr"] = float(row_wr.iloc[0]['WR'])
                                map_data[key]["picks_w"] = int(row_wr.iloc[0]['Partidas'])

            # 2. CDPS desde VOD y columnas raw desde LADDER
            candidates = glob.glob(f"data/*{map_name}*.csv")
            df_ladder = pd.DataFrame()
            df_elite = pd.DataFrame()
            max_p = -1
            min_p = float('inf')
            
            for file in candidates:
                try:
                    df_temp = pd.read_csv(file, encoding="latin1", sep=";")
                    if len(df_temp.columns) < 3:
                        df_temp = pd.read_csv(file, encoding="latin1", sep=",")
                    if 'Civ List' in df_temp.columns and 'Picks' in df_temp.columns:
                        df_temp['Picks_Num'] = df_temp['Picks'].apply(parse_picks)
                        total_p = df_temp['Picks_Num'].sum()
                        if total_p > max_p:
                            max_p = total_p
                            df_ladder = df_temp.copy()
                        if total_p > 0 and total_p < min_p:
                            min_p = total_p
                            df_elite = df_temp.copy()
                except:
                    pass
            
            # Extraer CDPS desde df_elite (VOD)
            if not df_elite.empty and 'CDPS Score' in df_elite.columns:
                df_c = df_elite.dropna(subset=['Civ List']).copy()
                df_c['Civ_Lower'] = df_c['Civ List'].astype(str).str.lower().str.strip()
                df_c['CDPS Score'] = pd.to_numeric(df_c['CDPS Score'].astype(str).str.replace(',', '.'), errors='coerce').fillna(0)
                df_c = df_c[df_c['CDPS Score'] > 0].sort_values(by='CDPS Score', ascending=False).reset_index(drop=True)
                
                for target, key in [(civ_a, "a"), (civ_b, "b")]:
                    if target:
                        row_cdps = df_c[df_c['Civ_Lower'].str.startswith(target[:4])]
                        if not row_cdps.empty:
                            map_data[key]["cdps"] = float(row_cdps.iloc[0]['CDPS Score'])
                            map_data[key]["rank_cdps"] = int(row_cdps.index[0]) + 1
                            map_data[key]["picks_c"] = int(row_cdps.iloc[0]['Picks_Num'])

            # 3. Matchups Head to Head
            if civ_b:
                # H2H LADDER (Draft Matrix)
                if not df_counters.empty:
                    row_matchup = df_counters[(df_counters['Mapa'] == m_int) & (df_counters['Mi_Civ'].str.startswith(civ_a[:4])) & (df_counters['Civ_Rival'].str.startswith(civ_b[:4]))]
                    if not row_matchup.empty:
                        games = row_matchup['Partidas'].sum()
                        wins = row_matchup['Victorias'].sum()
                        if games > 0:
                            map_data["matchup"] = {"games": int(games), "wr_a": float(wins / games)}
                
                # H2H CDPS (Las columnas crudas cA, cB, cW están en df_ladder)
                if not df_ladder.empty:
                    games_cdps = 0
                    wins_a_cdps = 0
                    if df_ladder.shape[1] >= 3:
                        for i in range(df_ladder.shape[1] - 2):
                            cA = df_ladder.iloc[:, i].astype(str).str.lower().str.strip()
                            cB = df_ladder.iloc[:, i+1].astype(str).str.lower().str.strip()
                            cW = df_ladder.iloc[:, i+2].astype(str).str.lower().str.strip()
                            
                            valid_rows = (cW != '') & (cW != 'nan') & (cW != 'none')
                            if valid_rows.sum() >= 2:
                                match_pct = ((cW[valid_rows] == cA[valid_rows]) | (cW[valid_rows] == cB[valid_rows])).sum() / valid_rows.sum()
                                if match_pct >= 0.8:
                                    df_pros = pd.DataFrame({'cA': cA, 'cB': cB, 'cW': cW})
                                    valid = df_pros[(df_pros['cA'] != 'nan') & (df_pros['cB'] != 'nan') & (df_pros['cW'] != 'nan')]
                                    target_a = civ_a[:4]
                                    target_b = civ_b[:4]
                                    mask = ((valid['cA'].str.startswith(target_a)) & (valid['cB'].str.startswith(target_b))) | \
                                           ((valid['cA'].str.startswith(target_b)) & (valid['cB'].str.startswith(target_a)))
                                    matches = valid[mask]
                                    games_cdps += len(matches)
                                    wins_a_cdps += matches['cW'].str.startswith(target_a).sum()
                                    break
                    if games_cdps > 0:
                        map_data["matchup_cdps"] = {"games": int(games_cdps), "wr_a": float(wins_a_cdps / games_cdps)}

            result["maps"][map_name] = map_data

        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}