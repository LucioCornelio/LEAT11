import { useState, useEffect } from 'react'
import { getMapData, getGlobalMeta, analyzeDraft, analyzeCivs } from './engine'

function App() {
  const mapPool = ["Skukuza", "Fortified Clearing", "Islands", "Coast to Mountain", "Kawasan", "Thames", "Stranded", "Sardis", "Arabia", "Megarandom"].sort()
  const civs = ["Armenians", "Aztecs", "Bengalis", "Berbers", "Bohemians", "Britons", "Bulgarians", "Burgundians", "Burmese", "Byzantines", "Celts", "Chinese", "Cumans", "Dravidians", "Ethiopians", "Franks", "Georgians", "Goths", "Gurjaras", "Hindustanis", "Huns", "Incas", "Italians", "Japanese", "Jurchens", "Khitans", "Khmer", "Koreans", "Lithuanians", "Magyars", "Malay", "Malians", "Mapuche", "Mayans", "Mongols", "Muisca", "Persians", "Poles", "Portuguese", "Romans", "Saracens", "Shu", "Sicilians", "Slavs", "Spanish", "Tatars", "Teutons", "Tupi", "Turks", "Vietnamese", "Vikings", "Wei", "Wu"].sort()

  const [db, setDb] = useState(null)
  const [selectedMap, setSelectedMap] = useState(mapPool[0])
  const [mapData, setMapData] = useState(null)
  const [mapError, setMapError] = useState(null)
  
  const [activeTab, setActiveTab] = useState('draftAssistant')
  
  const [globalData, setGlobalData] = useState(null)
  const [globalError, setGlobalError] = useState(null)
  
  const [draft, setDraft] = useState({ maps: ["", "", ""], p1_picks: [], p2_picks: [], bans: [], plan_p1: ["", "", ""], plan_p2: ["", "", ""], p1_snipe: "", p2_snipe: "", analysis: null })
  const [civA, setCivA] = useState('');
  const [civB, setCivB] = useState('');
  const [civAnalysis, setCivAnalysis] = useState(null);

  const [auth, setAuth] = useState(false);
  const [pass, setPass] = useState("");

  const isSnipePhase = draft.p1_picks.length === 5 && draft.p2_picks.length === 5;
  
  const checkIsCounter = (countersArray, civPrefix) => {
    return countersArray.some(c => typeof c === 'string' && c !== '-' && c.toLowerCase().startsWith(civPrefix));
  };

  const getCivStyle = (mapName, civStr) => {
    if (!civStr || civStr === '-') return { color: '#555', fontWeight: 'normal', textDecoration: 'none' };
    
    let color = '#aaa';
    let fontWeight = 'normal';
    
    const wrMatch = civStr.match(/\(([\d,]+)%/);
    let wr = null;
    if (wrMatch) {
        wr = parseFloat(wrMatch[1].replace(',', '.'));
        if (wr < 50) return { color: '#cc6666', fontWeight: 'normal', textDecoration: 'none' };
        if (wr < 55) return { color: '#aaa', fontWeight: 'normal', textDecoration: 'none' };
        color = '#e0e0e0';
    } else {
        color = '#e0e0e0'; 
    }

    if (!draft.analysis) return { color, fontWeight, textDecoration: 'none' };

    const civ = civStr.split(' ')[0].trim();
    const mapIndex = draft.maps.indexOf(mapName);
    const oppSelected = draft.plan_p2[mapIndex];
    
    if (!oppSelected) {
      return { color, fontWeight, textDecoration: 'none' };
    }

    const tWr = draft.analysis.top_wr?.[mapName] || [];
    const tCdps = draft.analysis.top_cdps?.[mapName] || [];
    const cLadder = draft.analysis.counters_ladder?.[mapName] || {};
    const cPros = draft.analysis.counters_pros?.[mapName] || {};

    const inTopWr = tWr.some(s => s.split(' ')[0].trim() === civ);
    const inTopCdps = tCdps.some(s => s.split(' ')[0].trim() === civ);
    
    const oppLow = oppSelected.toLowerCase();
    const lList = cLadder[oppLow] || [];
    const pList = cPros[oppLow] || [];
    
    const inCounterLadder = checkIsCounter(lList, civ.toLowerCase().substring(0,4));
    const inCounterPros = checkIsCounter(pList, civ.toLowerCase().substring(0,4));

    const countTop = (inTopWr ? 1 : 0) + (inTopCdps ? 1 : 0);
    const countCounters = (inCounterLadder ? 1 : 0) + (inCounterPros ? 1 : 0);

    if (countTop === 2 && countCounters === 2) {
      color = '#ffd700'; 
      fontWeight = 'bold';
    } else if ((countTop === 2 && countCounters === 1) || (countTop === 1 && countCounters === 2)) {
      color = '#9abfe6'; 
      fontWeight = 'bold';
    } else if (countTop === 1 && countCounters === 1) {
      color = '#e69950'; 
      fontWeight = 'bold';
    }

    return { color, fontWeight, textDecoration: 'none' };
  };

  useEffect(() => {
    if (!auth) return;
    fetch('/db.json')
      .then(res => res.json())
      .then(data => {
        setDb(data);
        try {
          setGlobalData(getGlobalMeta(data));
          setGlobalError(null);
        } catch (e) {
          setGlobalError(e.message);
        }
      })
      .catch(() => setGlobalError("Could not load local database."));
  }, [auth]);

  useEffect(() => {
    if (!db || !selectedMap) return;
    try {
      const data = getMapData(db, selectedMap);
      setMapData(data);
      setMapError(null);
    } catch (e) {
      setMapError(e.message);
      setMapData(null);
    }
  }, [selectedMap, db]);

  useEffect(() => {
    if (activeTab === 'draftAssistant' && db) {
      try {
        const analysis = analyzeDraft(db, draft);
        setDraft(prev => ({ ...prev, analysis }));
      } catch (e) {
        console.error("Draft error:", e);
      }
    }
  }, [draft.p1_picks, draft.p2_picks, draft.bans, draft.maps, activeTab, db]);

  useEffect(() => {
    if (activeTab === 'civAnalyzer' && civA && db) {
      try {
        setCivAnalysis(analyzeCivs(db, { civ_a: civA, civ_b: civB }));
      } catch (e) {
        console.error("Analyzer error:", e);
      }
    }
  }, [civA, civB, activeTab, db]);

  const resetDraft = () => {
    setDraft({ maps: ["", "", ""], p1_picks: [], p2_picks: [], bans: [], plan_p1: ["", "", ""], plan_p2: ["", "", ""], p1_snipe: "", p2_snipe: "", analysis: null });
  }
  
  const getFlexPicks = () => {
    if (!draft.analysis || draft.maps.filter(m => m).length < 2) return [];
    const flex = [];
    const excluded = [...draft.bans, ...draft.p1_picks, ...draft.p2_picks];

    civs.forEach(civ => {
      if (excluded.includes(civ)) return;

      let t_tot = 0;
      let w_tot = 0;
      let wrSum = 0;
      let wrCount = 0;
      const stats = [];
      const civPrefix = civ.substring(0, 4).toLowerCase();

      draft.maps.forEach((m) => {
        if (!m) { stats.push('-'); return; }
        
        const cdpsList = draft.analysis.top_cdps?.[m] || [];
        const tIndex = cdpsList.findIndex(s => s.split(' ')[0].trim().toLowerCase() === civPrefix);
        const isT = tIndex >= 0 && tIndex < 12;

        let isW = false;
        const wrList = draft.analysis.top_wr?.[m] || [];
        const wIndex = wrList.findIndex(s => s.split(' ')[0].trim().toLowerCase() === civPrefix);
        
        if (wIndex >= 0) {
           const match = wrList[wIndex].match(/\(([\d,.]+)% \| (.*?)\)/);
           if (match) {
              const wrVal = parseFloat(match[1].replace(',', '.'));
              wrSum += wrVal;
              wrCount++;

              const prStr = match[2].toLowerCase();
              let prVal = prStr.includes('k') 
                ? parseFloat(prStr.replace(',', '.').replace('k', '')) * 1000 
                : parseInt(prStr, 10);

              if (prVal >= 30 && wrVal >= 50) isW = true;
           } else {
              if (wIndex < 12) isW = true;
           }
        }

        if (isT) t_tot++;
        if (isW) w_tot++;

        if (isT && isW) stats.push('Both');
        else if (isT) stats.push('CDPS');
        else if (isW) stats.push('WR');
        else stats.push('-');
      });

      if (t_tot >= 2 || w_tot >= 2) {
        const avgWr = wrCount > 0 ? wrSum / wrCount : 0;
        flex.push({ civ, score: t_tot * 10 + w_tot, avgWr, stats });
      }
    });

    return flex.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.avgWr - a.avgWr;
    }).slice(0, 10);
  };

  const getSnipeSuggestions = () => {
    const snipes = [];
    draft.p2_picks.forEach(oppCiv => {
        let score = 0;
        const reasons = [];
        const oppLow = oppCiv.toLowerCase();
        const oppPrefix = oppLow.substring(0, 4);

        let flexMaps = [];
        draft.maps.forEach(m => {
            if(!m) return;
            const topCdps = (draft.analysis?.top_cdps?.[m] || []).slice(0, 12);
            const topWr = (draft.analysis?.top_wr?.[m] || []).slice(0, 12);
            if (checkIsCounter(topCdps, oppPrefix) || checkIsCounter(topWr, oppPrefix)) {
                flexMaps.push(m);
            }
        });
        if (flexMaps.length >= 2) {
            score += 15;
            reasons.push({ text: '🔄 ANTI-FLEX', color: '#cd7f32', title: `Top 12 meta on [${flexMaps.map(m=>m.toUpperCase()).join(' and ')}]` });
        }

        draft.maps.forEach((m, i) => {
            if(!m) return;
            const prob = draft.analysis?.opp_probs?.[m]?.[oppLow] || 0;
            
            const topCdps3 = (draft.analysis?.top_cdps?.[m] || []).slice(0, 3);
            const topWr3 = (draft.analysis?.top_wr?.[m] || []).slice(0, 3);
            if (checkIsCounter(topCdps3, oppPrefix) || checkIsCounter(topWr3, oppPrefix)) {
                score += 20 * (prob > 0 ? prob : 0.5);
                reasons.push({ text: `👑 GOD TIER`, color: '#ffd700', title: `Top 3 meta pick on [${m.toUpperCase()}]` });
            }

            let beatsMyPlan = false;
            let badMatchups = 0;
            let checkedMatchups = 0;

            draft.p1_picks.forEach(myCiv => {
                const myLow = myCiv.toLowerCase();
                const mStats = draft.analysis?.matchups?.[m]?.[`${myLow}_${oppLow}`];
                
                if (mStats && mStats.games >= 3) {
                    checkedMatchups++;
                    if (mStats.wr < 0.50) badMatchups++;
                    
                    if (draft.plan_p1[i] === myCiv && mStats.wr < 0.48) {
                        beatsMyPlan = true;
                    }
                }
            });

            if (beatsMyPlan && prob > 0.05) {
                const baseScore = 30;
                const multiplier = prob > 0.4 ? 1.5 : 1; 
                score += (baseScore * multiplier);
                reasons.push({ text: `🎯 COUNTERS PLAN`, color: '#ff33cc', title: `Counters your planned pick on [${m.toUpperCase()}]` });
            }

            if (checkedMatchups >= 2 && badMatchups === checkedMatchups && prob > 0.05) {
                const baseScore = 40;
                const multiplier = prob > 0.4 ? 1.5 : 1;
                score += (baseScore * multiplier);
                reasons.push({ text: `☠️ ROSTER KILLER`, color: '#ff4444', title: `Statistically beats your available roster on [${m.toUpperCase()}]` });
            }
        });

        if (reasons.length === 0) {
            reasons.push({ text: `🛡️ SAFE BAN`, color: '#888', title: `Standard ban` });
        }

        const uniqueReasons = [];
        const seen = new Set();
        reasons.sort((a,b) => b.title.length - a.title.length).forEach(r => {
            if(!seen.has(r.text)) {
                seen.add(r.text);
                uniqueReasons.push(r);
            }
        });

        snipes.push({ civ: oppCiv, score, reasons: uniqueReasons.slice(0, 3), bestMap: oppCiv });
    });
    return snipes.sort((a,b) => b.score - a.score);
  };

  const getSuggestions = () => {
    if (!draft.analysis || draft.maps.filter(m => m).length === 0) return [];
    if (isSnipePhase) return getSnipeSuggestions();

    const excluded = [...draft.bans, ...draft.p1_picks, ...draft.p2_picks];
    const suggestions = [];

    civs.forEach(civ => {
      if (excluded.includes(civ)) return;
      const civPrefix = civ.substring(0, 4).toLowerCase();
      let score = 0;
      const rawReasons = [];
      let bestMap = '';
      let bestMapScore = -1;
      let viableMaps = new Set();

      draft.maps.forEach(m => {
        if (!m) return;
        const mapIndex = draft.maps.indexOf(m);
        const isCovered = draft.plan_p1[mapIndex] && draft.p1_picks.includes(draft.plan_p1[mapIndex]);
        let mapScore = 0;

        const plannedOpponent = draft.plan_p2[mapIndex];
        const unassignedOpponents = draft.p2_picks.filter(c => !draft.plan_p2.includes(c));

        if (plannedOpponent) {
          const oppLow = plannedOpponent.toLowerCase();
          const ladderCounters = draft.analysis.counters_ladder?.[m]?.[oppLow] || [];
          const prosCounters = draft.analysis.counters_pros?.[m]?.[oppLow] || [];
          
          const inLadder = checkIsCounter(ladderCounters, civPrefix);
          const inPros = checkIsCounter(prosCounters, civPrefix);

          if (inLadder || inPros) {
            let pts, col, text, titlePrefix, rId;
            if (inLadder && inPros) {
              pts = isCovered ? 40 : 60;
              col = isCovered ? '#b266ff' : '#ff33cc'; 
              text = `💎 BOTH VS ${plannedOpponent.substring(0,4).toUpperCase()}`;
              titlePrefix = "Double counter (Ladder & Pros) against";
              rId = 'C1A_DOUBLE';
            } else {
              pts = isCovered ? 25 : 40;
              col = isCovered ? '#66b2ff' : '#ffd700'; 
              text = `🎯 VS ${plannedOpponent.substring(0,4).toUpperCase()}`;
              titlePrefix = "Lethal counter against";
              rId = 'C1A';
            }
            score += pts;
            mapScore += pts;
            viableMaps.add(m);
            rawReasons.push({ id: rId, text: text, color: col, points: pts, map: m, opp: plannedOpponent, titlePrefix: titlePrefix });
          }
        }

        unassignedOpponents.forEach(p2_civ => {
          const oppLow = p2_civ.toLowerCase();
          const ladderCounters = draft.analysis.counters_ladder?.[m]?.[oppLow] || [];
          const prosCounters = draft.analysis.counters_pros?.[m]?.[oppLow] || [];
          
          const inLadder = checkIsCounter(ladderCounters, civPrefix);
          const inPros = checkIsCounter(prosCounters, civPrefix);

          if (inLadder || inPros) {
            let pts, col, text, titlePrefix, rId;
            if (inLadder && inPros) {
              pts = isCovered ? 10 : 25;
              col = '#b266ff'; 
              text = `🔮 BOTH VS ${p2_civ.substring(0,4).toUpperCase()}`;
              titlePrefix = "Potential double counter against";
              rId = 'C1B_DOUBLE';
            } else {
              pts = isCovered ? 5 : 15;
              col = '#cd7f32'; 
              text = `⚔️ VS ${p2_civ.substring(0,4).toUpperCase()}`;
              titlePrefix = "Good counter against";
              rId = 'C1B';
            }
            score += pts;
            mapScore += pts;
            viableMaps.add(m);
            rawReasons.push({ id: rId, text: text, color: col, points: pts, map: m, opp: p2_civ, titlePrefix: titlePrefix });
          }
        });

        const topCdps = (draft.analysis.top_cdps?.[m] || []).slice(0, 7);
        const topWr = (draft.analysis.top_wr?.[m] || []).slice(0, 7);
        const inCdps = topCdps.some(c => typeof c === 'string' && c.toLowerCase().startsWith(civPrefix));
        const inWr = topWr.some(c => typeof c === 'string' && c.toLowerCase().startsWith(civPrefix));
        
        if (inCdps && inWr) {
          const pts = isCovered ? 25 : 35;
          const col = isCovered ? '#66b2ff' : '#ffd700';
          score += pts;
          mapScore += pts;
          viableMaps.add(m);
          rawReasons.push({ id: 'C2B', text: '🌟 TOP BOTH', color: col, points: pts, map: m });
        } else if (inCdps) {
          const pts = isCovered ? 10 : 25;
          const col = isCovered ? '#cd7f32' : '#66b2ff';
          score += pts;
          mapScore += pts;
          viableMaps.add(m);
          rawReasons.push({ id: 'C2C', text: '📈 TOP CDPS', color: col, points: pts, map: m });
        } else if (inWr) {
          const pts = isCovered ? 10 : 25;
          const col = isCovered ? '#cd7f32' : '#66b2ff';
          score += pts;
          mapScore += pts;
          viableMaps.add(m);
          rawReasons.push({ id: 'C2W', text: '🏆 TOP WR', color: col, points: pts, map: m });
        }

        if (mapScore > bestMapScore) {
          bestMapScore = mapScore;
          if (mapScore > 0) bestMap = m;
        }
      });

      let flexMaps = [];
      draft.maps.forEach(m => {
        if(!m) return;
        const flexCdps = (draft.analysis.top_cdps?.[m] || []).slice(0, 12);
        const flexWr = (draft.analysis.top_wr?.[m] || []).slice(0, 12);
        if (flexCdps.some(c => typeof c === 'string' && c.toLowerCase().startsWith(civPrefix)) || 
            flexWr.some(c => typeof c === 'string' && c.toLowerCase().startsWith(civPrefix))) {
          flexMaps.push(m);
        }
      });
      
      if (flexMaps.length >= 2) {
        score += 15;
        flexMaps.forEach(fm => viableMaps.add(fm));
        rawReasons.push({ id: 'C3', text: '🔄 FLEX', color: '#cd7f32', points: 15, title: `Flexible pick: Top 12 on [${flexMaps.map(m => m.toUpperCase()).join(' and ')}]` });
        if (bestMapScore < 15) {
          bestMap = flexMaps.map(m => m.length > 10 ? m.substring(0, 4) + '.' : m).join(' / ');
        }
      }

      if (score > 0) {
        const grouped = {};
        rawReasons.forEach(r => {
           if (r.id === 'C3') { 
               if (!grouped[r.text]) grouped[r.text] = r;
               return;
           }
           
           if (!grouped[r.text]) {
               grouped[r.text] = { ...r, maps: [r.map] };
           } else {
               if (!grouped[r.text].maps.includes(r.map)) {
                   grouped[r.text].maps.push(r.map);
                   grouped[r.text].points += 10; 
                   score += 10; 
               }
               if (r.color === '#ff33cc' || r.color === '#ffd700' || (r.color === '#66b2ff' && grouped[r.text].color === '#cd7f32')) {
                   grouped[r.text].color = r.color;
               }
           }
        });

        const uniqueReasons = Object.values(grouped).map(r => {
           if (r.id === 'C3') return r; 
           
           const mapsStr = r.maps.map(m => `[${m.toUpperCase()}]`).join(' and ');
           let title = "";
           if (r.id === 'C1A_DOUBLE' || r.id === 'C1A' || r.id === 'C1B_DOUBLE' || r.id === 'C1B') {
               title = `${r.titlePrefix} ${r.opp} on ${mapsStr}`;
           }
           else if (r.id === 'C2B') title = `Top 7 in Win Rate and CDPS on ${mapsStr}`;
           else if (r.id === 'C2C') title = `Top 7 in CDPS (Pro Meta) on ${mapsStr}`;
           else if (r.id === 'C2W') title = `Top 7 in Win Rate (Ladder) on ${mapsStr}`;
           
           return { ...r, title };
        });
        
        uniqueReasons.sort((a, b) => b.points - a.points);
        const altMapsArray = Array.from(viableMaps).filter(m => !bestMap.includes(m));
        suggestions.push({ civ, score, reasons: uniqueReasons, bestMap: bestMap || 'Global', altMaps: altMapsArray });
      }
    });

    return suggestions.sort((a, b) => b.score - a.score).slice(0, 5);
  };

  const toggleCiv = (civ, type, e = null) => {
    if ((type === 'p1' || type === 'p2') && draft.bans.length < 7) {
      if (!draft.p1_picks.includes(civ) && !draft.p2_picks.includes(civ) && !draft.bans.includes(civ)) {
        alert("⚠️ You must complete the 7 bans (5 global + 2 yours) before picking.");
        return;
      }
    }

    setDraft(prev => {
      const newD = {
        ...prev,
        p1_picks: [...prev.p1_picks],
        p2_picks: [...prev.p2_picks],
        bans: [...prev.bans],
        plan_p1: [...prev.plan_p1],
        plan_p2: [...prev.plan_p2]
      };

      const isBanned = newD.bans.includes(civ);
      const isP1 = newD.p1_picks.includes(civ);
      const isP2 = newD.p2_picks.includes(civ);
      const isSnipePhaseActive = newD.p1_picks.length === 5 && newD.p2_picks.length === 5;

      if (e && (e.ctrlKey || e.metaKey) && isSnipePhaseActive) {
         if (isP1) {
             newD.p2_snipe = newD.p2_snipe === civ ? "" : civ;
             return newD;
         }
         if (isP2) {
             newD.p1_snipe = newD.p1_snipe === civ ? "" : civ;
             return newD;
         }
      }

      if (type === 'ban') {
        if (isP1 || isP2) return prev; 
        if (isBanned) {
          newD.bans = newD.bans.filter(c => c !== civ); 
        } else {
          if (newD.bans.length >= 7) return prev; 
          newD.bans.push(civ);
        }
        return newD;
      } 
      
      if (type === 'p1' || type === 'p2') {
        if (newD.bans.length < 7 && !isBanned && !isP1 && !isP2) return prev; 

        if (isP1 && type === 'p1') {
            newD.p1_picks = newD.p1_picks.filter(c => c !== civ);
            newD.plan_p1 = newD.plan_p1.map(c => c === civ ? "" : c);
            if (newD.p2_snipe === civ) newD.p2_snipe = "";
            return newD;
        }
        if (isP2 && type === 'p2') {
            newD.p2_picks = newD.p2_picks.filter(c => c !== civ);
            newD.plan_p2 = newD.plan_p2.map(c => c === civ ? "" : c);
            if (newD.p1_snipe === civ) newD.p1_snipe = "";
            return newD;
        }

        if (isP1 || isP2) return prev;

        const myPicks = type === 'p1' ? newD.p1_picks : newD.p2_picks;
        if (myPicks.length >= 5) return prev;
        
        if (type === 'p1') newD.p1_picks.push(civ);
        if (type === 'p2') newD.p2_picks.push(civ);
        return newD;
      }
      
      return newD;
    });
  }

  const generateLiquipediaUrl = (mapName, civName) => {
    const map = encodeURIComponent(mapName); const civ = encodeURIComponent(civName);
    return `https://liquipedia.net/ageofempires/Special:RunQuery/Game_history?title=Special%3ARunQuery%2FGame_history&pfRunQueryFormName=Game+history&Game_query=opponent1%3D%26opponent2%3D%26faction%3D${civ}%26faction1%3D%26faction2%3D%26game%3D%26mode%3D1v1%26map%3D${map}%26maps%3D%26tournament%3D%26sdate%255Bday%255D%3D%26sdate%255Bmonth%255D%3D%26sdate%255Byear%255D%3D%26edate%255Bday%255D%3D%26edate%255Bmonth%255D%3D%26edate%255Byear%255D%3D%26limit%3D500%26offset%3D%26vod%255Bis_checkbox%255D%3Dtrue%26vod%255Bvalue%255D%3D%26spoilerfree%255Bis_checkbox%255D%3Dtrue%26sort%255Bis_checkbox%255D%3Dtrue&wpRunQuery=&pf_free_text=&Game+query%5Bopponent1%5D=&Game+query%5Bopponent2%5D=&Game+query%5Bfaction%5D=${civ}&Game+query%5Bfaction1%5D=&Game+query%5Bfaction2%5D=&Game+query%5Bgame%5D=&Game+query%5Bmode%5D=1v1&Game+query%5Bmap%5D=${map}&Game+query%5Bmaps%5D=&Game+query%5Btournament%5D=&Game+query%5Bsdate%5D%5Bday%5D=&Game+query%5Bsdate%5D%5Bmonth%5D=&Game+query%5Bsdate%5D%5Byear%5D=&Game+query%5Bedate%5D%5Bday%5D=&Game+query%5Bedate%5D%5Bmonth%5D=&Game+query%5Bedate%5D%5Byear%5D=&Game+query%5Blimit%5D=500&Game+query%5Boffset%5D=&Game+query%5Bvod%5D%5Bis_checkbox%5D=true&Game+query%5Bvod%5D%5Bvalue%5D=&Game+query%5Bspoilerfree%5D%5Bis_checkbox%5D=true&Game+query%5Bsort%5D%5Bis_checkbox%5D=true&wpRunQuery=&pf_free_text=`;
  };

  const tooltipCDPS = "Civilization Draft Power Score: A composite metric evaluating overall strength and priority";

  const RenderTable = ({ title, dataset, totalMatches, isClickable = false }) => {
    const maxPicks = dataset?.length > 0 ? Math.max(...dataset.map(row => row['Picks'])) : 1;
    const confidence = totalMatches >= 100 ? { level: 'Very High', color: '#4caf50' } : totalMatches >= 50 ? { level: 'High', color: '#8bc34a' } : totalMatches >= 20 ? { level: 'Medium', color: '#ffd700' } : { level: 'Low', color: '#ff4444' }; 

    return (
      <div style={{ flex: 1 }}>
        <h3 style={{ color: '#ffd700', marginTop: 0, marginBottom: '2px', fontSize: '15px', textTransform: 'uppercase', textAlign: 'center' }}>{title}</h3>
        <p style={{ color: '#888', fontStyle: 'italic', marginBottom: '8px', fontSize: '12px', textAlign: 'center', display: 'block', width: '100%' }}>Total Matches: {totalMatches} | Confidence: <span style={{ color: confidence.color, fontWeight: 'bold' }}>{confidence.level}</span></p>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '13px', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #444', color: '#a0aab5', backgroundColor: '#1e212b', height: '32px' }}>
              <th style={{ padding: '4px 8px', width: '120px', textAlign: 'left' }}>Civ List</th>
              <th style={{ padding: '4px 8px', width: '110px', textAlign: 'right' }}>Picks</th>
              <th style={{ padding: '4px 8px', width: '50px' }}>Wins</th>
              <th style={{ padding: '4px 8px', width: '80px' }}>Win Rate</th>
              <th style={{ padding: '4px 8px', width: '70px', cursor: 'help' }} title={tooltipCDPS}>
                <span style={{ textDecoration: 'underline dotted #888', textUnderlineOffset: '2px' }}>CDPS</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {dataset?.map((row, index) => {
              const pickPercentage = (row['Picks'] / maxPicks) * 100;
              const winRate = row['Win Rate']; const winRateColor = winRate >= 0.5 ? '#4caf50' : '#ff4444'; 
              return (
                <tr key={index} style={{ borderBottom: '1px solid #2a2d36', backgroundColor: index % 2 === 0 ? '#161920' : '#1a1c23', height: '32px' }}>
                  <td style={{ padding: '2px 8px', textAlign: 'left', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {isClickable ? (
                      <a href={generateLiquipediaUrl(selectedMap, row['Civ List'])} target="_blank" rel="noopener noreferrer" style={{ color: '#66b2ff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {row['Civ List']} <span style={{fontSize: '10px', lineHeight: '1'}}>↗</span>
                      </a>
                    ) : (<span style={{ color: '#e0e0e0' }}>{row['Civ List']}</span>)}
                  </td>
                  <td style={{ padding: '2px 8px', color: '#e0e0e0', position: 'relative', overflow: 'hidden', textAlign: 'right' }}>
                    <div style={{ position: 'absolute', top: '2px', left: 0, bottom: '2px', width: `${pickPercentage}%`, backgroundColor: 'rgba(56, 117, 185, 0.4)', zIndex: 0, borderRadius: '2px' }}></div>
                    <span style={{ position: 'relative', zIndex: 1, fontWeight: 'bold' }}>{row['Picks']}</span>
                  </td>
                  <td style={{ padding: '2px 8px', color: '#e0e0e0' }}>{row['Wins']}</td>
                  <td style={{ padding: '2px 8px', color: winRateColor, fontWeight: 'bold' }}>{(winRate * 100).toFixed(0)}%</td>
                  <td style={{ padding: '2px 8px', color: '#e0e0e0' }}>{Number(row['CDPS Score']).toFixed(2).replace('.', ',')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    );
  }

  const GlobalTable = ({ title, subtitle, data, config }) => (
    <div style={{ backgroundColor: '#1a1c23', borderRadius: '6px', border: '1px solid #333', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e212b', borderBottom: '1px solid #444', padding: '8px 12px' }}>
        <h3 style={{ color: '#ffd700', margin: 0, fontSize: '13px', textTransform: 'uppercase' }}>{title}</h3>
        {subtitle && (
          <span style={{ color: '#888', fontSize: '11px', fontStyle: 'italic' }}>
            {subtitle.includes('CDPS') ? (<>Sorted by <span title={tooltipCDPS} style={{ cursor: 'help', textDecoration: 'underline dotted #888', textUnderlineOffset: '2px' }}>CDPS</span></>) : (subtitle)}
          </span>
        )}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', tableLayout: 'fixed' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #333', color: '#a0aab5' }}>
            {config.map((col, i) => {
              const isCDPS = col.label.includes('CDPS');
              return (
                <th key={i} style={{ padding: '6px 8px', textAlign: col.align || 'right', whiteSpace: 'nowrap', width: col.width || 'auto', cursor: isCDPS ? 'help' : 'default' }} title={isCDPS ? tooltipCDPS : ""}>
                  {isCDPS ? (<>{col.label.replace('CDPS', '')}<span style={{ textDecoration: 'underline dotted #888', textUnderlineOffset: '2px' }}>CDPS</span></>) : (<span>{col.label}</span>)}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {!data ? (
            <tr><td colSpan={config.length} style={{ padding: '15px', textAlign: 'center', color: '#555', fontStyle: 'italic' }}>Loading data...</td></tr>
          ) : data.length === 0 ? (
            <tr><td colSpan={config.length} style={{ padding: '15px', textAlign: 'center', color: '#555' }}>No data available</td></tr>
          ) : (
            data.map((row, rIndex) => (
              <tr key={rIndex} style={{ borderBottom: '1px solid #2a2d36', backgroundColor: rIndex % 2 === 0 ? '#161920' : '#1a1c23', height: '28px' }}>
                {config.map((col, cIndex) => {
                  let val = row[col.key]; let color = '#e0e0e0';
                  if (val === undefined || val === null) val = '-';
                  if (col.format === 'percent' && val !== '-') { val = (val * 100).toFixed(0) + '%'; color = row[col.key] >= 0.5 ? '#4caf50' : '#ff4444'; } 
                  else if (col.format === 'decimal' && val !== '-') { val = Number(val).toFixed(2).replace('.', ','); } 
                  else if (col.key === 'Civ List') { color = '#e0e0e0'; }
                  if (col.type === 'mapsTooltip') { return (<td key={cIndex} style={{ padding: '2px 8px', textAlign: 'right' }}><span title={row['Map_List']} style={{ cursor: 'help', textDecoration: 'underline dotted #ffd700', textUnderlineOffset: '2px', color: '#ffd700' }}>{val} ⓘ</span></td>) }
                  return (<td key={cIndex} title={val} style={{ padding: '2px 8px', textAlign: col.align || 'right', color: color, fontWeight: (col.key === 'Civ List') ? 'bold' : 'normal', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{val}</td>)
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )

  const confOP = [{ label: 'Civ', key: 'Civ List', align: 'left', width: '35%' }, { label: 'Picks', key: 'Picks', width: '15%' }, { label: 'WR', key: 'Win Rate', format: 'percent', width: '15%' }, { label: 'Map', key: 'Map', align: 'left', width: '35%' }];
  const confPresence = [{ label: 'Civ', key: 'Civ List', align: 'left', width: '35%' }, { label: 'Picks', key: 'Picks', width: '20%' }, { label: 'Wins', key: 'Wins', width: '20%' }, { label: 'Global WR', key: 'Global WR', format: 'percent', width: '25%' }];
  const confTraps = [{ label: 'Civ', key: 'Civ List', align: 'left', width: '30%' }, { label: 'Picks', key: 'Picks', width: '15%' }, { label: 'WR', key: 'Win Rate', format: 'percent', width: '15%' }, { label: 'Map', key: 'Map', align: 'left', width: '40%' }];
  const confVersatile = [{ label: 'Civ', key: 'Civ List', align: 'left', width: '35%' }, { label: 'Viable Maps', key: 'Viable_Maps', type: 'mapsTooltip', width: '30%' }, { label: 'Avg CDPS', key: 'Avg_CDPS', format: 'decimal', width: '35%' }];
  
  if (!auth) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1c23' }}>
        <div style={{ padding: '30px', backgroundColor: '#161920', borderRadius: '6px', border: '1px solid #333', textAlign: 'center' }}>
          <h2 style={{ color: '#ffd700', fontSize: '16px', letterSpacing: '2px', marginBottom: '20px' }}>LEAT11 ENGINE - RESTRICTED ACCESS</h2>
          <input 
            type="password" 
            value={pass} 
            onChange={e => setPass(e.target.value)}
            onKeyDown={e => { if(e.key === 'Enter' && pass === "Emputors") setAuth(true) }}
            style={{ backgroundColor: '#1e212b', border: '1px solid #444', color: 'white', padding: '10px', borderRadius: '4px', outline: 'none', textAlign: 'center' }} 
            placeholder="Enter password"
          />
          <br /><br />
          <button 
            onClick={() => { if (pass === "Emputors") setAuth(true) }} 
            style={{ backgroundColor: '#66b2ff', color: '#161920', border: 'none', padding: '8px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginTop: '10px' }}>
            ENTER
          </button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ backgroundColor: '#161920', color: '#e0e0e0', minHeight: '100vh', padding: '0', fontFamily: 'Segoe UI, sans-serif' }}>
      
      <div style={{ display: 'flex', borderBottom: '2px solid #2a2d36', backgroundColor: '#1e212b', padding: '0 2rem' }}>
        <div onClick={() => setActiveTab('draftAssistant')} style={{ padding: '20px 30px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', color: activeTab === 'draftAssistant' ? '#ffd700' : '#888', borderBottom: activeTab === 'draftAssistant' ? '3px solid #ffd700' : '3px solid transparent', transition: 'all 0.2s ease-in-out' }}>PA3 Draft Assistant</div>
        <div onClick={() => setActiveTab('mapAnalysis')} style={{ padding: '20px 30px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', color: activeTab === 'mapAnalysis' ? '#ffd700' : '#888', borderBottom: activeTab === 'mapAnalysis' ? '3px solid #ffd700' : '3px solid transparent', transition: 'all 0.2s ease-in-out' }}>Map Draft Analysis</div>
        <div onClick={() => setActiveTab('globalMeta')} style={{ padding: '20px 30px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', color: activeTab === 'globalMeta' ? '#ffd700' : '#888', borderBottom: activeTab === 'globalMeta' ? '3px solid #ffd700' : '3px solid transparent', transition: 'all 0.2s ease-in-out' }}>Global Tournament Meta</div>
        <div onClick={() => setActiveTab('civAnalyzer')} style={{ padding: '20px 30px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', color: activeTab === 'civAnalyzer' ? '#ffd700' : '#888', borderBottom: activeTab === 'civAnalyzer' ? '3px solid #ffd700' : '3px solid transparent', transition: 'all 0.2s ease-in-out' }}>Civ Analyzer & H2H</div>
      </div>

      <div style={{ padding: '1.5rem 2rem' }}>
        
        {activeTab === 'mapAnalysis' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1rem' }}>
              <select value={selectedMap} onChange={(e) => setSelectedMap(e.target.value)} style={{ backgroundColor: '#161920', color: '#ffd700', border: '1px solid #444', padding: '6px 10px', fontSize: '15px', fontWeight: 'bold', outline: 'none', cursor: 'pointer', textAlign: 'left', width: '200px' }}>
                {mapPool.map(map => <option key={map} value={map}>{map}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '180px', marginBottom: '1.5rem' }}>
              <img src={`/maps/${selectedMap}.png`} alt={`Map of ${selectedMap}`} style={{ height: '100%', objectFit: 'contain' }} onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; e.target.parentNode.innerHTML = `<span style="color: #555;">[ Missing image: /maps/${selectedMap}.png ]</span>`; }} />
            </div>
            {mapError ? (<div style={{ color: '#ff4444', textAlign: 'center' }}>Error: {mapError}</div>) : !mapData ? (<div style={{ color: '#888', textAlign: 'center' }}>Loading...</div>) : (
              <div style={{ display: 'flex', gap: '30px', maxWidth: '1400px', margin: '0 auto' }}>
                <RenderTable title="General Dataset (All)" dataset={mapData.dataset_all} totalMatches={mapData.total_matches_all} />
                <RenderTable title="Elite Dataset (VOD)" dataset={mapData.dataset_elite} totalMatches={mapData.total_matches_elite} isClickable={true} />
              </div>
            )}
          </>
        )}

        {activeTab === 'globalMeta' && (
          <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
            {globalError ? (<div style={{ color: '#ff4444', padding: '1rem', backgroundColor: '#2a1616', borderRadius: '8px', border: '1px solid #ff4444', textAlign: 'center' }}>Error loading global data: {globalError}</div>) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                <GlobalTable title="OP COMBOS (5+ Picks)" subtitle="Sorted by CDPS" data={globalData?.op_5} config={confOP} />
                <GlobalTable title="OP COMBOS (10+ Picks)" subtitle="Sorted by CDPS" data={globalData?.op_10} config={confOP} />
                <GlobalTable title="OP COMBOS (20+ Picks)" subtitle="Sorted by CDPS" data={globalData?.op_20} config={confOP} />
                <GlobalTable title="Highest Global Presence" data={globalData?.highest_presence} config={confPresence} />
                <GlobalTable title="Global Tournament Traps" data={globalData?.global_traps} config={confTraps} />
                <GlobalTable title="Most Versatile Civs" data={globalData?.most_versatile} config={confVersatile} />
              </div>
            )}
          </div>
        )}

        {activeTab === 'draftAssistant' && (
          <div style={{ maxWidth: '1500px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>

            {/* 1. BARRA DE CONTROLES */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1a1c23', padding: '6px 15px', borderRadius: '6px', border: '1px solid #333' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ color: '#ffd700', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px' }}>MAPS:</span>
                {draft.maps.map((m, i) => (
                  <select key={i} value={m} onChange={e => { const nM = [...draft.maps]; nM[i] = e.target.value; setDraft({...draft, maps: nM}) }} style={{ backgroundColor: '#161920', color: m ? '#e0e0e0' : '#888', border: '1px solid #444', padding: '4px 8px', outline: 'none', borderRadius: '4px', fontSize: '12px' }}>
                    <option value="">- Select Map -</option>
                    {mapPool.map(mp => (
                      <option key={mp} value={mp} disabled={draft.maps.includes(mp) && draft.maps[i] !== mp}>{mp}</option>
                    ))}
                  </select>
                ))}
              </div>
              <button onClick={resetDraft} style={{ backgroundColor: '#cc3333', color: 'white', border: 'none', padding: '4px 15px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', transition: 'background 0.2s' }} onMouseOver={e => e.target.style.backgroundColor='#ff4444'} onMouseOut={e => e.target.style.backgroundColor='#cc3333'}>
                ↻ RESET DRAFT
              </button>
            </div>

            {/* 2. HEADER DEL DRAFT COMPRIMIDO */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1fr', gap: '10px' }}>
              <div style={{ backgroundColor: '#1a1c23', padding: '6px', borderRadius: '6px', borderTop: '3px solid #66b2ff', minHeight: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <h3 style={{ color: '#66b2ff', margin: '0 0 4px 0', fontSize: '11px', letterSpacing: '1px' }}>MY PICKS (P1)</h3>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', minHeight: '36px' }}>
                  {draft.p1_picks.map((c, i) => (
                    <div key={i} onClick={(e) => toggleCiv(c, 'p1', e)} style={{ position: 'relative', width: '36px', height: '36px', border: '1.5px solid #66b2ff', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#1e212b', cursor: 'pointer' }}>
                      <img src={`/civs/${c.toLowerCase()}.png`} alt={c} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: draft.p2_snipe === c ? 0.3 : 1 }} onError={(e) => { e.target.style.display='none'; }} />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '14px', backgroundColor: 'rgba(0,0,0,0.85)', color: 'white', fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{c.substring(0,4)}</div>
                      {draft.p2_snipe === c && <div style={{position: 'absolute', top:0, left:0, right:0, bottom:0, display:'flex', alignItems:'center', justifyContent:'center'}}><span style={{color:'#ff4444', fontSize:'24px', fontWeight: '300'}}>✗</span></div>}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ backgroundColor: '#161920', padding: '6px', borderRadius: '6px', border: '1px dashed #555', minHeight: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <h3 style={{ color: '#888', margin: '0 0 4px 0', fontSize: '11px', letterSpacing: '1px' }}>GLOBAL BANS</h3>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', minHeight: '36px' }}>
                  {draft.bans.map((c, i) => (
                    <div key={i} onClick={(e) => toggleCiv(c, 'ban', e)} style={{ position: 'relative', width: '36px', height: '36px', border: '1px solid #555', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#1e212b', cursor: 'pointer' }}>
                      <img src={`/civs/${c.toLowerCase()}.png`} alt={c} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5 }} onError={(e) => { e.target.style.display='none'; }} />
                      <div style={{position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><span style={{color: '#ff4444', fontSize: '24px', fontWeight: '300'}}>✗</span></div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ backgroundColor: '#1a1c23', padding: '6px', borderRadius: '6px', borderTop: '3px solid #ff6666', minHeight: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <h3 style={{ color: '#ff6666', margin: '0 0 4px 0', fontSize: '11px', letterSpacing: '1px' }}>OPPONENT PICKS (P2)</h3>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', minHeight: '36px' }}>
                  {draft.p2_picks.map((c, i) => (
                    <div key={i} onClick={(e) => toggleCiv(c, 'p2', e)} style={{ position: 'relative', width: '36px', height: '36px', border: '1.5px solid #ff6666', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#1e212b', cursor: 'pointer' }}>
                      <img src={`/civs/${c.toLowerCase()}.png`} alt={c} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: draft.p1_snipe === c ? 0.3 : 1 }} onError={(e) => { e.target.style.display='none'; }} />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '14px', backgroundColor: 'rgba(0,0,0,0.85)', color: 'white', fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{c.substring(0,4)}</div>
                      {draft.p1_snipe === c && <div style={{position: 'absolute', top:0, left:0, right:0, bottom:0, display:'flex', alignItems:'center', justifyContent:'center'}}><span style={{color:'#ff4444', fontSize:'24px', fontWeight: '300'}}>✗</span></div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. ROSTER ULTRA COMPACTA */}
            <div style={{ userSelect: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px', borderBottom: '1px solid #333', paddingBottom: '2px' }}>
                <h4 style={{ color: '#ffd700', fontSize: '11px', textTransform: 'uppercase', margin: 0 }}>CIVILIZATION ROSTER</h4>
                <span style={{fontSize:'9px', color:'#888', fontStyle: 'italic'}}>Click (P1) | Alt+Click (P2) | Ctrl+Click (Ban)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(18, 1fr)', gap: '3px' }}>
                {civs.map(c => { 
                  const isP1 = draft.p1_picks.includes(c); const isP2 = draft.p2_picks.includes(c); const isB = draft.bans.includes(c); 
                  return (
                    <div key={c} onClick={e => toggleCiv(c, (e.ctrlKey || e.metaKey) ? 'ban' : e.altKey ? 'p2' : 'p1', e)} 
                         style={{ position: 'relative', cursor: 'pointer', transition: 'transform 0.1s', transform: (isP1 || isP2 || isB) ? 'scale(0.90)' : 'scale(1)', border: `1.5px solid ${isP1 ? '#66b2ff' : isP2 ? '#ff6666' : isB ? '#555' : 'transparent'}`, borderRadius: '3px', overflow: 'hidden', aspectRatio: '1/1', backgroundColor: '#1e212b' }}>
                      <img src={`/civs/${c.toLowerCase()}.png`} alt={c} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
                      <div style={{ display: 'none', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: '#888' }}>{c.substring(0,3).toUpperCase()}</div>
                      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', backgroundColor: 'rgba(0, 0, 0, 0.75)', color: '#fff', fontSize: '9px', textAlign: 'center', padding: '0.5px 0', lineHeight: '1', fontWeight: 'bold' }}>{c}</div>
                      {isB && (<div style={{position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)'}}><span style={{color: '#ff4444', fontSize: '24px', fontWeight: 'bold', textShadow: '1px 1px 2px black'}}>✗</span></div>)}
                    </div>
                  ) 
                })}
              </div>
            </div>

            {/* 4. MATCHUP PLANNER */}
            <div style={{ backgroundColor: '#1a1c23', padding: '8px', borderRadius: '6px', border: '1px solid #333' }}>
              <h3 style={{ color: '#ffd700', fontSize: '11px', margin: '0 0 6px 0', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid #444', paddingBottom: '4px' }}>MATCHUP PLANNER</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {[0, 1, 2].map(i => {
                    const mapName = draft.maps[i];
                    const p1_civ = draft.plan_p1[i]?.toLowerCase();
                    const p2_civ = draft.plan_p2[i]?.toLowerCase();
                    const m_stats = (p1_civ && p2_civ) ? draft.analysis?.matchups?.[mapName]?.[`${p1_civ}_${p2_civ}`] : null;

                    return (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px', backgroundColor: '#161920', padding: '6px', borderRadius: '4px', border: '1px solid #2a2d36' }}>
                        <div style={{ fontSize: '11px', color: '#e0e0e0', fontWeight: 'bold', borderBottom: '1px dashed #333', paddingBottom: '2px', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {mapName || `Map ${i+1}`}
                        </div>
                        
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                          <select value={draft.plan_p1[i]} onChange={e => { const np = [...draft.plan_p1]; np[i] = e.target.value; setDraft({...draft, plan_p1: np}) }} style={{ flex: 1, backgroundColor: '#1e212b', color: '#66b2ff', border: '1px solid #3a4b63', borderRadius: '3px', fontSize: '10px', padding: '2px 2px', outline: 'none' }}>
                            <option value="">- My Pick -</option>
                            {draft.p1_picks.map(c => (
                              <option key={c} value={c} disabled={draft.plan_p1.includes(c) && draft.plan_p1[i] !== c}>{c.substring(0,4)}</option>
                            ))}
                          </select>

                          <div style={{ fontSize: '10px', fontWeight: 'bold', width: '38px', textAlign: 'center', color: m_stats ? (m_stats.wr >= 0.5 ? '#4caf50' : '#ff4444') : '#555' }}>
                            {m_stats ? `${(m_stats.wr * 100).toFixed(1)}%` : 'VS'}
                          </div>
                          
                          <select value={draft.plan_p2[i]} onChange={e => { const np = [...draft.plan_p2]; np[i] = e.target.value; setDraft({...draft, plan_p2: np}) }} style={{ flex: 1, backgroundColor: '#1e212b', color: '#ff6666', border: '1px solid #633a3a', borderRadius: '3px', fontSize: '10px', padding: '2px 2px', outline: 'none' }}>
                            <option value="">- Opp Pick -</option>
                            {draft.p2_picks.map(c => {
                              const prob = draft.analysis?.opp_probs?.[mapName]?.[c.toLowerCase()];
                              const probStr = prob > 0 ? ` (${(prob * 100).toFixed(0)}%)` : '';
                              return <option key={c} value={c} disabled={draft.plan_p2.includes(c) && draft.plan_p2[i] !== c}>{c.substring(0,4)}{probStr}</option>
                            })}
                          </select>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div style={{ backgroundColor: '#161920', padding: '6px 10px', borderRadius: '4px', border: '1px solid #2a2d36', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '10px', color: '#66b2ff', fontSize: '11px', fontWeight: 'bold' }}>
                    {draft.p1_picks.filter(c => !draft.plan_p1.includes(c)).map(c => <span key={c} style={{ textDecoration: draft.p2_snipe === c ? 'line-through' : 'none', opacity: draft.p2_snipe === c ? 0.5 : 1 }}>{c}</span>)}
                  </div>
                  <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '1px' }}>
                    UNASSIGNED / BENCH
                  </div>
                  <div style={{ display: 'flex', gap: '10px', color: '#ff6666', fontSize: '11px', fontWeight: 'bold' }}>
                    {draft.p2_picks.filter(c => !draft.plan_p2.includes(c)).map(c => <span key={c} style={{ textDecoration: draft.p1_snipe === c ? 'line-through' : 'none', opacity: draft.p1_snipe === c ? 0.5 : 1 }}>{c}</span>)}
                  </div>
                </div>
              </div>
            </div>

            {/* SUGERENCIAS DEL DRAFT / SNIPE */}
            <div style={{ backgroundColor: isSnipePhase ? '#2a1616' : '#1a1c23', padding: '6px 8px', borderRadius: '6px', border: `1px solid ${isSnipePhase ? '#ff4444' : '#ffd700'}`, marginTop: '10px', marginBottom: '10px', transition: 'all 0.3s' }}>
              <h3 style={{ color: isSnipePhase ? '#ff4444' : '#ffd700', fontSize: '11px', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: `1px solid ${isSnipePhase ? '#662222' : '#444'}`, paddingBottom: '2px' }}>
                {isSnipePhase ? '🎯 SNIPE EVALUATION (CTRL+CLICK TO BAN)' : '🔥 SMART SUGGESTIONS (TOP 5)'}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {getSuggestions().length === 0 ? (
                  <div style={{ color: '#888', fontSize: '10px', fontStyle: 'italic', textAlign: 'center', padding: '4px' }}>Not enough data or maps to suggest.</div>
                ) : (
                  getSuggestions().map((s, i) => (
                    <div key={i} onClick={(e) => toggleCiv(s.civ, isSnipePhase ? 'p2' : 'p1', e)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1e212b', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer', borderLeft: `2px solid ${s.reasons[0]?.color || '#555'}`, opacity: isSnipePhase && draft.p1_snipe === s.civ ? 0.4 : 1, transition: 'all 0.2s', height: '20px' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2a2d36'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1e212b'}>
                      <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: '15px', textAlign: 'left' }}>
                        <span style={{ fontWeight: 'bold', color: isSnipePhase ? '#ff6666' : '#fff', fontSize: '11px', width: '85px', textAlign: 'left', textDecoration: isSnipePhase && draft.p1_snipe === s.civ ? 'line-through' : 'none' }}>{s.civ}</span>
                        {!isSnipePhase && <span style={{ color: '#aaa', fontSize: '10px', width: '135px', textAlign: 'left' }}>🗺️ {s.bestMap}</span>}
                        {!isSnipePhase && s.altMaps?.length > 0 && (<span style={{ color: '#666', fontSize: '9px', fontStyle: 'italic', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' }}>Also: {s.altMaps.join(', ')}</span>)}
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        {s.reasons.map((r, idx) => (
                          <span key={idx} title={r.title} style={{ backgroundColor: `${r.color}22`, color: r.color, border: `1px solid ${r.color}55`, padding: '0 4px', borderRadius: '2px', fontSize: '8px', fontWeight: 'bold', lineHeight: '14px', cursor: 'help' }}>
                            {r.text}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 5. TABLAS TOP 7 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              
              {/* TABLA TOP 7 LADDER */}
              <div style={{ backgroundColor: '#1a1c23', padding: '8px', borderRadius: '6px', border: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ color: '#ffd700', fontSize: '11px', margin: '0 0 2px 0', textTransform: 'uppercase' }}>TOP 7 WIN RATE</h3>
                <div style={{fontSize: '9px', color: '#888', marginBottom: '4px', fontStyle: 'italic'}}>(WR% | matches)</div>
                <table style={{width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'fixed', flex: 1}}>
                  <thead>
                    <tr style={{color: '#888', borderBottom: '1px solid #333'}}>
                      <th style={{padding: '2px', width: '25px'}}>#</th>
                      <th style={{padding: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{draft.maps[0] || 'Map 1'}</th>
                      <th style={{padding: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{draft.maps[1] || 'Map 2'}</th>
                      <th style={{padding: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{draft.maps[2] || 'Map 3'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[0,1,2,3,4,5,6].map(i => (
                      <tr key={i} style={{borderBottom: '1px solid #2a2d36', backgroundColor: i%2===0?'transparent':'#161920', height: '22px'}}>
                        <td style={{padding: '2px', color: '#ffd700', fontWeight: 'bold'}}>#{i+1}</td>
                        <td style={{padding: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.3px', ...getCivStyle(draft.maps[0], draft.analysis?.top_wr?.[draft.maps[0]]?.[i])}}>
                          {draft.analysis?.top_wr?.[draft.maps[0]]?.[i] || '-'}
                        </td>
                        <td style={{padding: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.3px', ...getCivStyle(draft.maps[1], draft.analysis?.top_wr?.[draft.maps[1]]?.[i])}}>
                          {draft.analysis?.top_wr?.[draft.maps[1]]?.[i] || '-'}
                        </td>
                        <td style={{padding: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.3px', ...getCivStyle(draft.maps[2], draft.analysis?.top_wr?.[draft.maps[2]]?.[i])}}>
                          {draft.analysis?.top_wr?.[draft.maps[2]]?.[i] || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* TABLA TOP 7 PROS */}
              <div style={{ backgroundColor: '#1a1c23', padding: '8px', borderRadius: '6px', border: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ color: '#ffd700', fontSize: '11px', margin: '0 0 2px 0', textTransform: 'uppercase' }}>
                  TOP 7 <span title={tooltipCDPS} style={{ cursor: 'help', textDecoration: 'underline dotted #ffd700', textUnderlineOffset: '2px' }}>CDPS</span>
                </h3>
                <div style={{fontSize: '9px', color: '#888', marginBottom: '4px', fontStyle: 'italic'}}>(Score | matches)</div>
                <table style={{width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'fixed', flex: 1}}>
                  <thead>
                    <tr style={{color: '#888', borderBottom: '1px solid #333'}}>
                      <th style={{padding: '2px', width: '25px'}}>#</th>
                      <th style={{padding: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{draft.maps[0] || 'Map 1'}</th>
                      <th style={{padding: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{draft.maps[1] || 'Map 2'}</th>
                      <th style={{padding: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{draft.maps[2] || 'Map 3'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[0,1,2,3,4,5,6].map(i => (
                      <tr key={i} style={{borderBottom: '1px solid #2a2d36', backgroundColor: i%2===0?'transparent':'#161920', height: '22px'}}>
                        <td style={{padding: '2px', color: '#ffd700', fontWeight: 'bold'}}>#{i+1}</td>
                        <td style={{padding: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.3px', ...getCivStyle(draft.maps[0], draft.analysis?.top_cdps?.[draft.maps[0]]?.[i])}}>
                          {draft.analysis?.top_cdps?.[draft.maps[0]]?.[i] || '-'}
                        </td>
                        <td style={{padding: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.3px', ...getCivStyle(draft.maps[1], draft.analysis?.top_cdps?.[draft.maps[1]]?.[i])}}>
                          {draft.analysis?.top_cdps?.[draft.maps[1]]?.[i] || '-'}
                        </td>
                        <td style={{padding: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.3px', ...getCivStyle(draft.maps[2], draft.analysis?.top_cdps?.[draft.maps[2]]?.[i])}}>
                          {draft.analysis?.top_cdps?.[draft.maps[2]]?.[i] || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>

            {/* 6. TABLAS DE COUNTERS TRANSPESTAS */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              
              {/* LADDER COUNTERS */}
              <div style={{ backgroundColor: '#1a1c23', padding: '8px', borderRadius: '6px', border: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ color: '#ffd700', fontSize: '11px', margin: '0 0 2px 0', textTransform: 'uppercase' }}>TOP 3 COUNTERS (LADDER)</h3>
                <div style={{fontSize: '9px', color: '#888', marginBottom: '4px', fontStyle: 'italic'}}>(WR% | matches)</div>
                <table style={{width: '100%', fontSize: '9px', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'fixed', flex: 1}}>
                  <thead>
                    <tr style={{color: '#888', borderBottom: '1px solid #333'}}>
                      <th style={{padding: '2px 1px', width: '45px'}}>OPP CIV</th>
                      <th style={{padding: '2px 1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{draft.maps[0] || 'Map 1'}</th>
                      <th style={{padding: '2px 1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{draft.maps[1] || 'Map 2'}</th>
                      <th style={{padding: '2px 1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{draft.maps[2] || 'Map 3'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.p2_picks.length === 0 ? (
                      <tr><td colSpan={4} style={{padding: '4px', color: '#888', textAlign: 'center'}}>Waiting for Opp Picks...</td></tr>
                    ) : (
                      draft.p2_picks.map((c, i) => (
                        <tr key={i} style={{borderBottom: '1px solid #2a2d36', backgroundColor: i%2===0?'transparent':'#161920', opacity: draft.p1_snipe === c ? 0.3 : 1}}>
                          <td style={{padding: '2px 1px', color: '#ff6666', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'top', textDecoration: draft.p1_snipe === c ? 'line-through' : 'none'}}>{c.substring(0,4)}</td>
                          {[0, 1, 2].map(j => {
                            const m = draft.maps[j];
                            if (!m) return <td key={j} style={{padding: '2px 1px'}}></td>;
                            const counters = draft.analysis?.counters_ladder?.[m]?.[c.toLowerCase()] || ["-", "-", "-"];
                            return (
                              <td key={j} style={{padding: '2px 1px', verticalAlign: 'top'}}>
                                {counters.map((cnt, idx) => {
                                  const style = getCivStyle(m, cnt);
                                  return <div key={idx} style={{marginBottom: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.3px', color: style.color, fontWeight: style.fontWeight, textDecoration: style.textDecoration}}>{cnt}</div>
                                })}
                              </td>
                            )
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* PROS COUNTERS */}
              <div style={{ backgroundColor: '#1a1c23', padding: '8px', borderRadius: '6px', border: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ color: '#ffd700', fontSize: '11px', margin: '0 0 2px 0', textTransform: 'uppercase' }}>TOP 3 COUNTERS (PROS)</h3>
                <div style={{fontSize: '9px', color: '#888', marginBottom: '4px', fontStyle: 'italic'}}>(WR% | matches)</div>
                <table style={{width: '100%', fontSize: '9px', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'fixed', flex: 1}}>
                  <thead>
                    <tr style={{color: '#888', borderBottom: '1px solid #333'}}>
                      <th style={{padding: '2px 1px', width: '45px'}}>OPP CIV</th>
                      <th style={{padding: '2px 1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{draft.maps[0] || 'Map 1'}</th>
                      <th style={{padding: '2px 1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{draft.maps[1] || 'Map 2'}</th>
                      <th style={{padding: '2px 1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{draft.maps[2] || 'Map 3'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.p2_picks.length === 0 ? (
                      <tr><td colSpan={4} style={{padding: '4px', color: '#888', textAlign: 'center'}}>Waiting for Opp Picks...</td></tr>
                    ) : (
                      draft.p2_picks.map((c, i) => (
                        <tr key={i} style={{borderBottom: '1px solid #2a2d36', backgroundColor: i%2===0?'transparent':'#161920', opacity: draft.p1_snipe === c ? 0.3 : 1}}>
                          <td style={{padding: '2px 1px', color: '#ff6666', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'top', textDecoration: draft.p1_snipe === c ? 'line-through' : 'none'}}>{c.substring(0,4)}</td>
                          {[0, 1, 2].map(j => {
                            const m = draft.maps[j];
                            if (!m) return <td key={j} style={{padding: '2px 1px'}}></td>;
                            const counters = draft.analysis?.counters_pros?.[m]?.[c.toLowerCase()] || ["-", "-", "-"];
                            return (
                              <td key={j} style={{padding: '2px 1px', verticalAlign: 'top'}}>
                                {counters.map((cnt, idx) => {
                                  const style = getCivStyle(m, cnt);
                                  return <div key={idx} style={{marginBottom: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.3px', color: style.color, fontWeight: style.fontWeight, textDecoration: style.textDecoration}}>{cnt}</div>
                                })}
                              </td>
                            )
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

            </div>

            {/* 7. FLEX PICKS */}
            <div style={{ backgroundColor: '#1a1c23', padding: '8px', borderRadius: '6px', border: '1px solid #333', marginTop: '10px' }}>
              <h3 style={{ color: '#ffd700', fontSize: '11px', margin: '0 0 6px 0', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid #444', paddingBottom: '4px' }}>FLEX PICKS (TOP 10)</h3>
              <table style={{width: '100%', fontSize: '10px', borderCollapse: 'collapse', textAlign: 'center', tableLayout: 'fixed'}}>
                 <thead>
                   <tr style={{color: '#888', borderBottom: '1px solid #333'}}>
                     <th style={{padding: '4px', width: '30px'}}>#</th>
                     <th style={{padding: '4px', textAlign: 'left', width: '25%'}}>Civ</th>
                     <th style={{padding: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{draft.maps[0] || 'Map 1'}</th>
                     <th style={{padding: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{draft.maps[1] || 'Map 2'}</th>
                     <th style={{padding: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{draft.maps[2] || 'Map 3'}</th>
                   </tr>
                 </thead>
                 <tbody>
                   {getFlexPicks().map((f, i) => (
                     <tr key={f.civ} style={{borderBottom: '1px solid #2a2d36', backgroundColor: i%2===0?'transparent':'#161920', height: '22px'}}>
                       <td style={{color: '#ffd700', fontWeight: 'bold'}}>{i+1}</td>
                       <td style={{textAlign: 'left', fontWeight: 'bold', color: '#e0e0e0'}}>{f.civ}</td>
                       <td style={{color: f.stats[0] === 'Both' ? '#b266ff' : f.stats[0] === 'CDPS' ? '#66b2ff' : f.stats[0] === 'WR' ? '#4caf50' : '#555', fontWeight: f.stats[0] !== '-' ? 'bold' : 'normal'}}>{f.stats[0]}</td>
                       <td style={{color: f.stats[1] === 'Both' ? '#b266ff' : f.stats[1] === 'CDPS' ? '#66b2ff' : f.stats[1] === 'WR' ? '#4caf50' : '#555', fontWeight: f.stats[1] !== '-' ? 'bold' : 'normal'}}>{f.stats[1]}</td>
                       <td style={{color: f.stats[2] === 'Both' ? '#b266ff' : f.stats[2] === 'CDPS' ? '#66b2ff' : f.stats[2] === 'WR' ? '#4caf50' : '#555', fontWeight: f.stats[2] !== '-' ? 'bold' : 'normal'}}>{f.stats[2]}</td>
                     </tr>
                   ))}
                   {getFlexPicks().length === 0 && <tr><td colSpan={5} style={{padding: '10px', color: '#555', fontStyle: 'italic'}}>{draft.maps.filter(m => m).length < 2 ? 'Need at least 2 maps to calculate flex picks' : 'No flex picks matching the criteria (Top 12) found for these maps'}</td></tr>}
                 </tbody>
              </table>
            </div>

          </div>
        )}

        {activeTab === 'civAnalyzer' && (
          <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* CONTROLES */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '40px', backgroundColor: '#1a1c23', padding: '20px', borderRadius: '6px', border: '1px solid #333' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <select value={civA} onChange={e => setCivA(e.target.value)} style={{ backgroundColor: '#1e212b', color: '#66b2ff', border: '2px solid #66b2ff', padding: '8px 16px', borderRadius: '4px', fontSize: '16px', fontWeight: 'bold', outline: 'none', cursor: 'pointer', width: '260px' }}>
                  <option value="" disabled>- Select Civ A (Required) -</option>
                  {civs.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div style={{ width: '60px', height: '60px', borderRadius: '4px', border: civA ? '2px solid #66b2ff' : '2px dashed #444', backgroundColor: '#161920', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {civA ? <img src={`/civs/${civA.toLowerCase()}.png`} alt={civA} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => e.target.style.display='none'} /> : <span style={{color: '#555', fontSize: '24px'}}>?</span>}
                </div>
              </div>

              <div style={{ color: '#ffd700', fontSize: '24px', fontWeight: 'bold', fontStyle: 'italic' }}>VS</div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '4px', border: civB ? '2px solid #ff6666' : '2px dashed #444', backgroundColor: '#161920', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {civB ? <img src={`/civs/${civB.toLowerCase()}.png`} alt={civB} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => e.target.style.display='none'} /> : <span style={{color: '#555', fontSize: '24px'}}>?</span>}
                </div>
                <select value={civB} onChange={e => setCivB(e.target.value)} style={{ backgroundColor: '#1e212b', color: '#ff6666', border: '2px solid #ff6666', padding: '8px 16px', borderRadius: '4px', fontSize: '16px', fontWeight: 'bold', outline: 'none', cursor: 'pointer', width: '260px' }}>
                  <option value="">- Select Civ B (Optional) -</option>
                  {civs.filter(c => c !== civA).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

            </div>

            {/* TABLA DINÁMICA */}
            {civAnalysis && civA && (
              <div style={{ backgroundColor: '#1a1c23', borderRadius: '6px', border: '1px solid #333', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '10px', tableLayout: 'fixed' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#1e212b', color: '#888', borderBottom: '1px solid #444', height: '36px', textTransform: 'uppercase', fontSize: '9px' }}>
                      <th style={{ width: '12%', padding: '0 4px' }}>Map</th>
                      <th style={{ width: '13%', color: '#66b2ff', padding: '0 4px' }}>{civA} WR</th>
                      <th style={{ width: '13%', color: '#66b2ff', padding: '0 4px' }}>
                        {civA} <span title={tooltipCDPS} style={{ cursor: 'help', textDecoration: 'underline dotted #66b2ff', textUnderlineOffset: '2px' }}>CDPS</span>
                      </th>
                      {civB && <th style={{ width: '18%', color: '#ffd700', padding: '0 4px' }}>H2H WR</th>}
                      {civB && <th style={{ width: '18%', color: '#b266ff', padding: '0 4px' }}>H2H CDPS</th>}
                      {civB && <th style={{ width: '13%', color: '#ff6666', padding: '0 4px' }}>{civB} WR</th>}
                      {civB && <th style={{ width: '13%', color: '#ff6666', padding: '0 4px' }}>
                        {civB} <span title={tooltipCDPS} style={{ cursor: 'help', textDecoration: 'underline dotted #ff6666', textUnderlineOffset: '2px' }}>CDPS</span>
                      </th>}
                    </tr>
                  </thead>
                  <tbody>
                    {mapPool.map((map, i) => {
                      const mData = civAnalysis.maps?.[map];
                      if (!mData) return null;

                      const formatData = (rank, val, picks, isWr) => {
                        if (rank === '-' || rank === undefined) return <span style={{color: '#555'}}>-</span>;
                        const isTop = parseInt(rank) <= 7;
                        const pStr = picks >= 1000 ? (picks/1000).toFixed(1).replace('.0', '').replace('.', ',') + 'k' : picks;
                        const formattedVal = isWr ? (val*100).toFixed(1).replace('.', ',') + '%' : Number(val).toFixed(1).replace('.', ',');
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
                            <span style={{ color: isTop ? (isWr ? '#ffd700' : '#66b2ff') : '#e0e0e0', fontWeight: isTop ? 'bold' : 'normal' }}>
                              {isTop ? `★ #${rank}` : `#${rank}`}
                            </span>
                            <span style={{ fontSize: '8.5px', color: '#aaa' }}>({formattedVal} | {pStr} m)</span>
                          </div>
                        );
                      };

                      let h2hBg = 'transparent';
                      let h2hText = <span style={{color: '#555'}}>-</span>;
                      if (civB && mData.matchup) {
                        const wrA = mData.matchup.wr_a;
                        const games = mData.matchup.games;
                        if (games >= 10) { 
                          if (wrA > 0.55) h2hBg = 'rgba(102, 178, 255, 0.15)'; 
                          else if (wrA < 0.45) h2hBg = 'rgba(255, 102, 102, 0.15)'; 
                        }
                        h2hText = (
                          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
                            <span>{(wrA * 100).toFixed(1).replace('.', ',')}%</span>
                            <span style={{ fontSize: '8.5px', color: '#888', fontWeight: 'normal' }}>{games} m</span>
                          </div>
                        );
                      }

                      let h2hCdpsBg = 'transparent';
                      let h2hCdpsText = <span style={{color: '#555'}}>-</span>;
                      if (civB && mData.matchup_cdps) {
                        const wrACdps = mData.matchup_cdps.wr_a;
                        const gamesCdps = mData.matchup_cdps.games;
                        if (gamesCdps >= 3) { 
                          if (wrACdps > 0.55) h2hCdpsBg = 'rgba(102, 178, 255, 0.15)'; 
                          else if (wrACdps < 0.45) h2hCdpsBg = 'rgba(255, 102, 102, 0.15)'; 
                        }
                        h2hCdpsText = (
                           <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
                            <span>{(wrACdps * 100).toFixed(1).replace('.', ',')}%</span>
                            <span style={{ fontSize: '8.5px', color: '#888', fontWeight: 'normal' }}>{gamesCdps} m</span>
                          </div>
                        );
                      }

                      return (
                        <tr key={map} style={{ borderBottom: '1px solid #2a2d36', backgroundColor: i % 2 === 0 ? '#161920' : '#1a1c23', height: '42px' }}>
                          <td style={{ fontWeight: 'bold', color: '#fff', borderRight: '1px solid #2a2d36', padding: '0 4px', fontSize: '10px' }}>{map}</td>
                          <td style={{ borderRight: '1px dotted #333', padding: '0 4px' }}>{formatData(mData.a?.rank_wr, mData.a?.wr, mData.a?.picks_w, true)}</td>
                          <td style={{ borderRight: civB ? '1px solid #444' : 'none', padding: '0 4px' }}>{formatData(mData.a?.rank_cdps, mData.a?.cdps, mData.a?.picks_c, false)}</td>
                          
                          {civB && (
                            <td style={{ backgroundColor: h2hBg, fontWeight: 'bold', color: h2hBg !== 'transparent' ? (mData.matchup?.wr_a > 0.5 ? '#66b2ff' : '#ff6666') : '#aaa', borderRight: '1px solid #444', padding: '0 4px' }}>
                              {h2hText}
                            </td>
                          )}
                          {civB && (
                            <td style={{ backgroundColor: h2hCdpsBg, fontWeight: 'bold', color: h2hCdpsBg !== 'transparent' ? (mData.matchup_cdps?.wr_a > 0.5 ? '#b266ff' : '#ff6666') : '#aaa', borderRight: '1px solid #444', padding: '0 4px' }}>
                              {h2hCdpsText}
                            </td>
                          )}
                          
                          {civB && <td style={{ borderRight: '1px dotted #333', padding: '0 4px' }}>{formatData(mData.b?.rank_wr, mData.b?.wr, mData.b?.picks_w, true)}</td>}
                          {civB && <td style={{ padding: '0 4px' }}>{formatData(mData.b?.rank_cdps, mData.b?.cdps, mData.b?.picks_c, false)}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

export default App