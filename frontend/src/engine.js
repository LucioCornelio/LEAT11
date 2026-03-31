export const MAP_TRANSLATION = {
  "Skukuza": "Socotra",
  "Fortified Clearing": "Fortified_Clearing",
  "Thames": "Valley",
  "Sardis": "Arena",
  "Coast to Mountain": "african_clearing"
};

const getCleanMap = (mapName) => {
  for (const [k, v] of Object.entries(MAP_TRANSLATION)) {
    if (mapName.toLowerCase().trim() === k.toLowerCase()) return v.toLowerCase();
  }
  return mapName.replace(/ /g, "_").toLowerCase();
};

const parsePicks = (val) => {
  if (!val) return 0;
  let str = String(val).toLowerCase().trim();
  if (str.includes('k')) return Math.floor(parseFloat(str.replace('k', '').replace(',', '.')) * 1000);
  str = str.replace(/ /g, '').replace(/\./g, '');
  const num = parseInt(str);
  return isNaN(num) ? 0 : num;
};

const parseWr = (val) => {
  if (!val) return 0;
  let num = parseFloat(String(val).replace('%', '').replace(',', '.'));
  if (isNaN(num)) return 0;
  return num > 1 ? num / 100 : num;
};

const parseCdps = (val) => {
  if (!val) return 0;
  let num = parseFloat(String(val).replace(',', '.'));
  return isNaN(num) ? 0 : num;
};

const fmtK = (val) => {
  if (val >= 1000) return (val / 1000).toFixed(1).replace('.0', '') + 'k';
  return String(Math.floor(val));
};

const processCsv = (df) => {
  if (!df || !df.length) return { dataset: [], matches: 0 };
  let clean = df.filter(r => r['Civ List']).map(r => ({
    'Civ List': r['Civ List'],
    'Picks': parsePicks(r['Picks']),
    'Wins': parsePicks(r['Wins']),
    'Win Rate': parseWr(r['Win Rate']),
    'CDPS Score': parseCdps(r['CDPS Score'])
  }));
  const totalMatches = Math.floor(clean.reduce((sum, r) => sum + r.Picks, 0) / 2);
  clean.sort((a, b) => b['CDPS Score'] - a['CDPS Score']);
  return { dataset: clean.slice(0, 10), matches: totalMatches };
};

export const getMapData = (db, mapName) => {
  const allData = db.maps_all[mapName] || [];
  const vodData = db.maps_vod[mapName] || [];
  const all = processCsv(allData);
  const elite = processCsv(vodData);
  return {
    dataset_all: all.dataset, dataset_elite: elite.dataset,
    total_matches_all: all.matches, total_matches_elite: elite.matches
  };
};

export const getGlobalMeta = (db) => {
  const mapPool = ["Skukuza", "Fortified Clearing", "Islands", "Coast to Mountain", "Kawasan", "Thames", "Stranded", "Sardis", "Arabia", "Megarandom"];
  let allRows = [];
  mapPool.forEach(m => {
    const df = db.maps_all[m] || [];
    df.filter(r => r['Civ List']).forEach(r => {
      allRows.push({
        'Civ List': r['Civ List'],
        'Picks': parsePicks(r['Picks']),
        'Wins': parsePicks(r['Wins']),
        'Win Rate': parseWr(r['Win Rate']),
        'CDPS Score': parseCdps(r['CDPS Score']),
        'Map': m
      });
    });
  });

  const getOp = (minPicks) => [...allRows].filter(r => r.Picks >= minPicks).sort((a, b) => b['CDPS Score'] - a['CDPS Score']).slice(0, 10);
  
  let presenceMap = {};
  allRows.forEach(r => {
    if (!presenceMap[r['Civ List']]) presenceMap[r['Civ List']] = { 'Civ List': r['Civ List'], Picks: 0, Wins: 0 };
    presenceMap[r['Civ List']].Picks += r.Picks;
    presenceMap[r['Civ List']].Wins += r.Wins;
  });
  let presence = Object.values(presenceMap).map(r => ({...r, 'Global WR': r.Picks > 0 ? r.Wins / r.Picks : 0}));
  presence.sort((a, b) => b.Picks - a.Picks);

  let traps = [...allRows].filter(r => r.Picks >= 10 && r['Win Rate'] < 0.40).sort((a, b) => a['Win Rate'] - b['Win Rate']).slice(0, 10);
  
  let versatileMap = {};
  allRows.filter(r => r['CDPS Score'] >= 60).forEach(r => {
    if (!versatileMap[r['Civ List']]) versatileMap[r['Civ List']] = { 'Civ List': r['Civ List'], maps: [], cdpsSum: 0 };
    versatileMap[r['Civ List']].maps.push(r.Map);
    versatileMap[r['Civ List']].cdpsSum += r['CDPS Score'];
  });
  let versatile = Object.values(versatileMap).map(r => ({
    'Civ List': r['Civ List'],
    Viable_Maps: r.maps.length,
    Avg_CDPS: r.cdpsSum / r.maps.length,
    Map_List: r.maps.join(', ')
  })).sort((a, b) => b.Viable_Maps !== a.Viable_Maps ? b.Viable_Maps - a.Viable_Maps : b.Avg_CDPS - a.Avg_CDPS).slice(0, 10);

  return { op_5: getOp(5), op_10: getOp(10), op_20: getOp(20), highest_presence: presence.slice(0, 10), global_traps: traps, most_versatile: versatile };
};

const getPermutations = (arr, length) => {
    if (length === 1) return arr.map(val => [val]);
    const perms = [];
    arr.forEach((val, i) => {
        const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
        const subPerms = getPermutations(rest, length - 1);
        subPerms.forEach(sp => perms.push([val, ...sp]));
    });
    return Array.from(new Set(perms.map(JSON.stringify))).map(JSON.parse);
};

export const analyzeDraft = (db, data) => {
  const df = db.counters || [];
  const p1 = (data.p1_picks || []).map(p => p.toLowerCase().trim());
  const p2 = (data.p2_picks || []).map(p => p.toLowerCase().trim());
  const bans = (data.bans || []).map(b => b.toLowerCase().trim());
  const excluded = [...p1, ...p2, ...bans];

  let top_wr = {}, top_cdps = {}, opp_probs = {}, matchups = {}, counters_ladder = {}, counters_pros = {}, all_civ_weights = {};

  const cleanMapData = df.map(r => ({
    ...r,
    Mapa: String(r.Mapa || '').toLowerCase().trim(),
    Mi_Civ: String(r.Mi_Civ || '').toLowerCase().trim(),
    Civ_Rival: String(r.Civ_Rival || '').toLowerCase().trim(),
    Partidas: parseFloat(r.Partidas) || 0,
    Victorias: parseFloat(r.Victorias) || 0
  }));

  (data.maps || []).forEach(m_disp => {
    if (!m_disp) return;
    const m_int = getCleanMap(m_disp);
    counters_ladder[m_disp] = {};
    counters_pros[m_disp] = {};
    
    const df_all = db.maps_all[m_disp] || [];
    const civStats = df_all.map(r => {
        const keys = Object.keys(r);
        const c_civ = r['Civ List'] || r[keys[0]];
        return {
            civ: String(c_civ).toLowerCase().trim(),
            cdps: parseCdps(r['CDPS Score']),
            picks: parsePicks(r['Picks']),
            raw: r
        };
    });

    let pro_matchups_data = [];
    if (df_all.length > 0) {
        const keys = Object.keys(df_all[0]);
        if (keys.length >= 3) {
            for(let i=0; i < keys.length - 2; i++) {
                let matches = 0, valid = 0;
                let tempPros = [];
                df_all.forEach(r => {
                    const cA = String(r[keys[i]]||'').toLowerCase().trim();
                    const cB = String(r[keys[i+1]]||'').toLowerCase().trim();
                    const cW = String(r[keys[i+2]]||'').toLowerCase().trim();
                    if (cW && cW !== 'nan' && cW !== 'none') {
                        valid++;
                        if (cW === cA || cW === cB) matches++;
                        tempPros.push({civA: cA, civB: cB, winner: cW});
                    }
                });
                if (valid >= 2 && (matches/valid) >= 0.8) {
                    pro_matchups_data = tempPros.filter(x => x.civA !== 'nan' && x.civB !== 'nan' && x.winner !== 'nan');
                    break;
                }
            }
        }
    }

    const mapRows = cleanMapData.filter(r => r.Mapa === m_int);
    const total_map_partidas = mapRows.reduce((acc, r) => acc + r.Partidas, 0);

    let m_probs = {};
    p2.forEach(p => {
        const matches = mapRows.filter(r => r.Mi_Civ === p).reduce((acc, r) => acc + r.Partidas, 0);
        const pick_rate = total_map_partidas > 0 ? (matches / total_map_partidas * 100) : 0;
        const stat = civStats.find(c => c.civ === p);
        const cdps_val = stat ? Math.max(0, stat.cdps) : 0;
        const tourney_picks = stat ? stat.picks : 0;
        const confidence = Math.min(1.0, tourney_picks / 10.0);
        const cdps_multiplier = 1 + ((cdps_val / 100.0) * confidence);
        m_probs[p] = (pick_rate + 0.1) * cdps_multiplier;
    });
    all_civ_weights[m_disp] = m_probs;
    
    opp_probs[m_disp] = {};
    p2.forEach(p => opp_probs[m_disp][p] = 0);

    matchups[m_disp] = {};
    p1.forEach(p1_civ => {
        p2.forEach(p2_civ => {
            const row = mapRows.filter(r => r.Mi_Civ === p1_civ && r.Civ_Rival === p2_civ);
            const games = row.reduce((acc, r) => acc + r.Partidas, 0);
            const vics = row.reduce((acc, r) => acc + r.Victorias, 0);
            matchups[m_disp][`${p1_civ}_${p2_civ}`] = { wr: games > 0 ? vics/games : 0, games: Math.floor(games) };
        });
    });

    const df_map_filtered = mapRows.filter(r => !excluded.includes(r.Mi_Civ));
    let aggWR = {};
    df_map_filtered.forEach(r => {
        if (!aggWR[r.Mi_Civ]) aggWR[r.Mi_Civ] = { Partidas: 0, Victorias: 0 };
        aggWR[r.Mi_Civ].Partidas += r.Partidas;
        aggWR[r.Mi_Civ].Victorias += r.Victorias;
    });
    let all_wr = Object.keys(aggWR).map(k => ({ Mi_Civ: k, ...aggWR[k], WR: aggWR[k].Partidas > 0 ? aggWR[k].Victorias/aggWR[k].Partidas : 0 })).filter(x => x.Partidas >= 50);
    all_wr.sort((a,b) => b.WR !== a.WR ? b.WR - a.WR : b.Partidas - a.Partidas);
    top_wr[m_disp] = all_wr.map(r => `${(r.Mi_Civ.charAt(0).toUpperCase() + r.Mi_Civ.slice(1)).substring(0,4)} (${(r.WR*100).toFixed(1)}% | ${fmtK(r.Partidas)})`.replace('.', ','));

    let all_cdps = civStats.filter(c => !excluded.includes(c.civ) && c.cdps > 0 && c.picks >= 3).sort((a,b) => b.cdps - a.cdps);
    top_cdps[m_disp] = all_cdps.map(r => `${(r.civ.charAt(0).toUpperCase() + r.civ.slice(1)).substring(0,4)} (${r.cdps.toFixed(1)} | ${fmtK(r.picks)})`.replace('.', ','));

    p2.forEach(p2_civ => {
        let df_c = mapRows.filter(r => r.Civ_Rival === p2_civ && !excluded.includes(r.Mi_Civ));
        let aggC = {};
        df_c.forEach(r => {
            if(!aggC[r.Mi_Civ]) aggC[r.Mi_Civ] = {Partidas:0, Victorias:0};
            aggC[r.Mi_Civ].Partidas += r.Partidas;
            aggC[r.Mi_Civ].Victorias += r.Victorias;
        });
        let arr_c = Object.keys(aggC).map(k => ({Mi_Civ: k, ...aggC[k], WR: aggC[k].Victorias/aggC[k].Partidas})).filter(x => x.Partidas >= 15);
        arr_c.sort((a,b) => b.WR !== a.WR ? b.WR - a.WR : b.Partidas - a.Partidas);
        let top3_l = arr_c.slice(0,3).map(r => `${(r.Mi_Civ.charAt(0).toUpperCase() + r.Mi_Civ.slice(1)).substring(0,4)} (${(r.WR*100).toFixed(1)}% | ${fmtK(r.Partidas)})`.replace('.', ','));
        counters_ladder[m_disp][p2_civ] = [...top3_l, "-", "-", "-"].slice(0,3);

        let pro_counters = ["-", "-", "-"];
        if (pro_matchups_data.length > 0) {
            let stats = {};
            pro_matchups_data.forEach(match => {
                if (match.civA === p2_civ || match.civB === p2_civ) {
                    let opponent = match.civA === p2_civ ? match.civB : match.civA;
                    if (!excluded.includes(opponent) && opponent !== p2_civ) {
                        if (!stats[opponent]) stats[opponent] = {games: 0, wins: 0};
                        stats[opponent].games++;
                        if (match.winner === opponent) stats[opponent].wins++;
                    }
                }
            });
            let valid_stats = [];
            for (let opp in stats) {
                if (stats[opp].games >= 3) {
                    let wr = stats[opp].wins / stats[opp].games;
                    let l_games = aggC[opp] ? aggC[opp].Partidas : 0;
                    let l_vics = aggC[opp] ? aggC[opp].Victorias : 0;
                    let ladder_veto = (l_games >= 10 && (l_vics/l_games) < 0.45);
                    if (!ladder_veto) valid_stats.push({civ: opp, wr, games: stats[opp].games});
                }
            }
            valid_stats.sort((a,b) => b.wr !== a.wr ? b.wr - a.wr : b.games - a.games);
            let top3_p = valid_stats.slice(0,3).map(r => `${(r.civ.charAt(0).toUpperCase() + r.civ.slice(1)).substring(0,4)} (${(r.wr*100).toFixed(1)}% | ${fmtK(r.games)})`.replace('.', ','));
            counters_pros[m_disp][p2_civ] = [...top3_p, "-", "-", "-"].slice(0,3);
        } else {
            counters_pros[m_disp][p2_civ] = pro_counters;
        }
    });
  });

  const valid_maps = (data.maps || []).filter(m => m);
  if (p2.length > 0 && valid_maps.length > 0) {
      let padded_p2 = [...p2];
      while(padded_p2.length < valid_maps.length) padded_p2.push(null);
      const perms = getPermutations(padded_p2, valid_maps.length);
      let perm_scores = perms.map(perm => {
          let score = 1.0;
          valid_maps.forEach((m, i) => {
              if (perm[i] !== null) score *= (all_civ_weights[m][perm[i]] || 0);
          });
          return score;
      });
      const total_score = perm_scores.reduce((a,b) => a+b, 0);
      if (total_score > 0) {
          perms.forEach((perm, i) => {
              const prob = perm_scores[i] / total_score;
              valid_maps.forEach((m, j) => {
                  if (perm[j] !== null) opp_probs[m][perm[j]] += prob;
              });
          });
      }
  }

  return { top_wr, top_cdps, opp_probs, matchups, counters_ladder, counters_pros };
};

export const analyzeCivs = (db, data) => {
    const civ_a = (data.civ_a || "").toLowerCase().trim();
    const civ_b = (data.civ_b || "").toLowerCase().trim();
    if (!civ_a) return { error: "Civ A is required" };
    const mapPool = ["Skukuza", "Fortified Clearing", "Islands", "Coast to Mountain", "Kawasan", "Thames", "Stranded", "Sardis", "Arabia", "Megarandom"];
    let result = { civ_a: civ_a.charAt(0).toUpperCase() + civ_a.slice(1), civ_b: civ_b ? civ_b.charAt(0).toUpperCase() + civ_b.slice(1) : null, maps: {} };

    const df_counters = (db.counters || []).map(r => ({
        ...r,
        Mapa: String(r.Mapa || '').toLowerCase().trim(),
        Mi_Civ: String(r.Mi_Civ || '').toLowerCase().trim(),
        Civ_Rival: String(r.Civ_Rival || '').toLowerCase().trim(),
        Partidas: parseFloat(r.Partidas) || 0,
        Victorias: parseFloat(r.Victorias) || 0
    }));

    mapPool.forEach(mapName => {
        let map_data = {
            a: { wr: 0, rank_wr: "-", picks_w: 0, cdps: 0, rank_cdps: "-", picks_c: 0 },
            b: civ_b ? { wr: 0, rank_wr: "-", picks_w: 0, cdps: 0, rank_cdps: "-", picks_c: 0 } : null,
            matchup: null, matchup_cdps: null
        };
        const m_int = getCleanMap(mapName);
        
        const df_map_counters = df_counters.filter(r => r.Mapa === m_int);
        if (df_map_counters.length > 0) {
            let aggC = {};
            df_map_counters.forEach(r => {
                if(!aggC[r.Mi_Civ]) aggC[r.Mi_Civ] = { Partidas: 0, Victorias: 0 };
                aggC[r.Mi_Civ].Partidas += r.Partidas;
                aggC[r.Mi_Civ].Victorias += r.Victorias;
            });
            let df_g = Object.keys(aggC).map(k => ({Mi_Civ: k, ...aggC[k], WR: aggC[k].Partidas > 0 ? aggC[k].Victorias/aggC[k].Partidas : 0})).filter(x => x.Partidas >= 50);
            df_g.sort((a,b) => b.WR !== a.WR ? b.WR - a.WR : b.Partidas - a.Partidas);

            [ {t: civ_a, k: "a"}, {t: civ_b, k: "b"} ].forEach(({t, k}) => {
                if (t) {
                    const idx = df_g.findIndex(r => r.Mi_Civ.startsWith(t.substring(0,4)));
                    if (idx >= 0) {
                        map_data[k].rank_wr = idx + 1;
                        map_data[k].wr = df_g[idx].WR;
                        map_data[k].picks_w = df_g[idx].Partidas;
                    }
                }
            });
        }

        const df_all = db.maps_all[mapName] || [];
        const df_elite = db.maps_vod[mapName] || [];
        
        let df_c = df_elite.filter(r => r['Civ List']).map(r => ({
            Civ_Lower: String(r['Civ List']).toLowerCase().trim(),
            'CDPS Score': parseCdps(r['CDPS Score']),
            Picks_Num: parsePicks(r['Picks'])
        })).filter(r => r['CDPS Score'] > 0).sort((a,b) => b['CDPS Score'] - a['CDPS Score']);

        [ {t: civ_a, k: "a"}, {t: civ_b, k: "b"} ].forEach(({t, k}) => {
            if (t) {
                const idx = df_c.findIndex(r => r.Civ_Lower.startsWith(t.substring(0,4)));
                if (idx >= 0) {
                    map_data[k].cdps = df_c[idx]['CDPS Score'];
                    map_data[k].rank_cdps = idx + 1;
                    map_data[k].picks_c = df_c[idx].Picks_Num;
                }
            }
        });

        if (civ_b) {
            const matchRow = df_map_counters.filter(r => r.Mi_Civ.startsWith(civ_a.substring(0,4)) && r.Civ_Rival.startsWith(civ_b.substring(0,4)));
            const games = matchRow.reduce((a,b)=>a+b.Partidas, 0);
            const wins = matchRow.reduce((a,b)=>a+b.Victorias, 0);
            if (games > 0) map_data.matchup = { games: Math.floor(games), wr_a: wins/games };

            if (df_all.length > 0) {
                const keys = Object.keys(df_all[0]);
                if (keys.length >= 3) {
                    let games_cdps = 0, wins_a_cdps = 0;
                    for(let i=0; i < keys.length - 2; i++) {
                        let matches = 0, valid = 0, validRows = [];
                        df_all.forEach(r => {
                            const cA = String(r[keys[i]]||'').toLowerCase().trim();
                            const cB = String(r[keys[i+1]]||'').toLowerCase().trim();
                            const cW = String(r[keys[i+2]]||'').toLowerCase().trim();
                            if (cW && cW !== 'nan' && cW !== 'none') {
                                valid++;
                                if (cW === cA || cW === cB) matches++;
                                validRows.push({cA, cB, cW});
                            }
                        });
                        if (valid >= 2 && (matches/valid) >= 0.8) {
                            validRows.forEach(v => {
                                if ((v.cA.startsWith(civ_a.substring(0,4)) && v.cB.startsWith(civ_b.substring(0,4))) || 
                                    (v.cA.startsWith(civ_b.substring(0,4)) && v.cB.startsWith(civ_a.substring(0,4)))) {
                                    games_cdps++;
                                    if (v.cW.startsWith(civ_a.substring(0,4))) wins_a_cdps++;
                                }
                            });
                            break;
                        }
                    }
                    if (games_cdps > 0) map_data.matchup_cdps = { games: games_cdps, wr_a: wins_a_cdps/games_cdps };
                }
            }
        }
        result.maps[mapName] = map_data;
    });
    return result;
};