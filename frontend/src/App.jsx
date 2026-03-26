import { useState, useEffect } from 'react'

function App() {
  const mapPool = ["Skukuza", "Fortified Clearing", "Islands", "Coast to Mountain", "Kawasan", "Thames", "Stranded", "Sardis", "Arabia", "Megarandom"].sort()
  
  // Tu lista de civilizaciones MASIVA
  const civs = ["Armenians", "Aztecs", "Bengalis", "Berbers", "Bohemians", "Britons", "Bulgarians", "Burgundians", "Burmese", "Byzantines", "Celts", "Chinese", "Cumans", "Dravidians", "Ethiopians", "Franks", "Georgians", "Goths", "Gurjaras", "Hindustanis", "Huns", "Incas", "Italians", "Japanese", "Jurchens", "Khitans", "Khmer", "Koreans", "Lithuanians", "Magyars", "Malay", "Malians", "Mapuche", "Mayans", "Mongols", "Muisca", "Persians", "Poles", "Portuguese", "Romans", "Saracens", "Shu", "Sicilians", "Slavs", "Spanish", "Tatars", "Teutons", "Tupi", "Turks", "Vietnamese", "Vikings", "Wei", "Wu"].sort()

  const [selectedMap, setSelectedMap] = useState(mapPool[0])
  const [mapData, setMapData] = useState(null)
  const [mapError, setMapError] = useState(null)
  
  const [activeTab, setActiveTab] = useState('draftAssistant')
  
  const [globalData, setGlobalData] = useState(null)
  const [globalError, setGlobalError] = useState(null)
  
  const [draft, setDraft] = useState({ maps: ["", "", ""], p1_picks: [], p2_picks: [], bans: [], plan_p1: ["", "", ""], plan_p2: ["", "", ""], analysis: null })

  const [auth, setAuth] = useState(false);
  const [pass, setPass] = useState("");
  
  const getCivStyle = (mapName, civStr) => {
    if (!civStr || civStr === '-' || !draft.analysis) return { color: '#e0e0e0', fontWeight: 'normal', textDecoration: 'none' };
    
    const civ = civStr.split(' ')[0].trim();
    const mapIndex = draft.maps.indexOf(mapName);
    
    // Condición estricta: miramos exclusivamente a la civilización que el rival tiene asignada a ESTE mapa
    const oppSelected = draft.plan_p2[mapIndex];
    
    // Si no hay un rival asignado manualmente a este mapa, no se colorean los counters
    if (!oppSelected) {
      return { color: '#e0e0e0', fontWeight: 'normal', textDecoration: 'none' };
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
    
    const inCounterLadder = lList.some(s => s.split(' ')[0].trim() === civ);
    const inCounterPros = pList.some(s => s.split(' ')[0].trim() === civ);

    const countTop = (inTopWr ? 1 : 0) + (inTopCdps ? 1 : 0);
    const countCounters = (inCounterLadder ? 1 : 0) + (inCounterPros ? 1 : 0);

    let color = '#e0e0e0';
    let fontWeight = 'normal';

    if (countTop === 2 && countCounters === 2) {
      color = '#ffd700'; // Oro
      fontWeight = 'bold';
    } else if ((countTop === 2 && countCounters === 1) || (countTop === 1 && countCounters === 2)) {
      color = '#9abfe6'; // Plata (Azulado metálico)
      fontWeight = 'bold';
    } else if (countTop === 1 && countCounters === 1) {
      color = '#e69950'; // Bronce
      fontWeight = 'bold';
    }

    return { color, fontWeight, textDecoration: 'none' };
  };

  useEffect(() => {
    fetch(`https://leat11-backend.onrender.com/api/map/${selectedMap}`)
      .then(res => res.json())
      .then(data => {
        if (!data.error) { setMapData(data); setMapError(null); } 
        else { setMapError(data.error); setMapData(null); }
      })
      .catch(() => setMapError("Could not connect to engine."))
  }, [selectedMap])

  useEffect(() => {
    fetch('https://leat11-backend.onrender.com/api/global')
      .then(res => res.json())
      .then(data => {
        if (!data.error) { setGlobalData(data); setGlobalError(null); } 
        else { setGlobalError(data.error); setGlobalData(null); }
      })
      .catch(() => setGlobalError("Could not connect to engine."))
  }, [])

  useEffect(() => {
    if (activeTab === 'draftAssistant') {
      fetch('https://leat11-backend.onrender.com/api/draft/analyze', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(draft) 
      })
      .then(res => res.json())
      .then(data => setDraft(prev => ({ ...prev, analysis: data })))
      .catch(err => console.error("Draft error:", err));
    }
  }, [draft.p1_picks, draft.p2_picks, draft.bans, draft.maps, activeTab])

  const resetDraft = () => {
    setDraft({ maps: ["", "", ""], p1_picks: [], p2_picks: [], bans: [], plan_p1: ["", "", ""], plan_p2: ["", "", ""], analysis: null });
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
  const getSuggestions = () => {
    if (!draft.analysis || draft.maps.filter(m => m).length === 0) return [];
    const excluded = [...draft.bans, ...draft.p1_picks, ...draft.p2_picks];
    const suggestions = [];

    civs.forEach(civ => {
      if (excluded.includes(civ)) return;
      const civPrefix = civ.substring(0, 4).toLowerCase();
      let score = 0;
      const reasons = [];
      let bestMap = '';
      let bestMapScore = -1;

      draft.maps.forEach(m => {
        if (!m) return;
        const mapIndex = draft.maps.indexOf(m);
        
        // El mapa NO se ignora, pero verificamos si está cubierto para aplicar penalizaciones (picks de banquillo)
        const isCovered = draft.plan_p1[mapIndex] && draft.p1_picks.includes(draft.plan_p1[mapIndex]);
        let mapScore = 0;

        const plannedOpponent = draft.plan_p2[mapIndex];
        const unassignedOpponents = draft.p2_picks.filter(c => !draft.plan_p2.includes(c));

        // CRITERIO 1A: Counter Directo (Rival asignado al mapa)
        if (plannedOpponent) {
          const oppLow = plannedOpponent.toLowerCase();
          const ladderCounters = draft.analysis.counters_ladder?.[m]?.[oppLow] || [];
          const prosCounters = draft.analysis.counters_pros?.[m]?.[oppLow] || [];
          const isCounter = ladderCounters.some(c => typeof c === 'string' && c.toLowerCase().startsWith(civPrefix)) ||
                            prosCounters.some(c => typeof c === 'string' && c.toLowerCase().startsWith(civPrefix));
          if (isCounter) {
            const pts = isCovered ? 25 : 40;
            const col = isCovered ? '#66b2ff' : '#ffd700'; // Azul/Plata si está cubierto (backup), Oro si está libre
            score += pts;
            mapScore += pts;
            reasons.push({ text: `🎯 VS ${plannedOpponent.substring(0,4).toUpperCase()}`, color: col, points: pts, title: `Counter letal contra ${plannedOpponent} en ${m} ${isCovered ? '(Opción de backup)' : ''}` });
          }
        }

        // CRITERIO 1B: Counter Potencial (Rival sin asignar)
        unassignedOpponents.forEach(p2_civ => {
          const oppLow = p2_civ.toLowerCase();
          const ladderCounters = draft.analysis.counters_ladder?.[m]?.[oppLow] || [];
          const prosCounters = draft.analysis.counters_pros?.[m]?.[oppLow] || [];
          const isCounter = ladderCounters.some(c => typeof c === 'string' && c.toLowerCase().startsWith(civPrefix)) ||
                            prosCounters.some(c => typeof c === 'string' && c.toLowerCase().startsWith(civPrefix));
          if (isCounter) {
            const pts = isCovered ? 5 : 15;
            score += pts;
            mapScore += pts;
            reasons.push({ text: `⚔️ VS ${p2_civ.substring(0,4).toUpperCase()}`, color: '#cd7f32', points: pts, title: `Buen counter contra ${p2_civ} en ${m} (si decide jugarla aquí)` });
          }
        });

        // CRITERIO 2: Desglose de Top 7
        const topCdps = (draft.analysis.top_cdps?.[m] || []).slice(0, 7);
        const topWr = (draft.analysis.top_wr?.[m] || []).slice(0, 7);
        const inCdps = topCdps.some(c => typeof c === 'string' && c.toLowerCase().startsWith(civPrefix));
        const inWr = topWr.some(c => typeof c === 'string' && c.toLowerCase().startsWith(civPrefix));
        
        if (inCdps && inWr) {
          const pts = isCovered ? 25 : 35;
          const col = isCovered ? '#66b2ff' : '#ffd700';
          score += pts;
          mapScore += pts;
          reasons.push({ text: '🌟 TOP BOTH', color: col, points: pts, title: `Top 7 en Win Rate y CDPS en ${m} ${isCovered ? '(Opción de backup)' : ''}` });
        } else if (inCdps) {
          const pts = isCovered ? 10 : 25;
          const col = isCovered ? '#cd7f32' : '#66b2ff';
          score += pts;
          mapScore += pts;
          reasons.push({ text: '📈 TOP CDPS', color: col, points: pts, title: `Top 7 en CDPS (Meta Pro) en ${m}` });
        } else if (inWr) {
          const pts = isCovered ? 10 : 25;
          const col = isCovered ? '#cd7f32' : '#66b2ff';
          score += pts;
          mapScore += pts;
          reasons.push({ text: '🏆 TOP WR', color: col, points: pts, title: `Top 7 en Win Rate (Ladder) en ${m}` });
        }

        if (mapScore > bestMapScore) {
          bestMapScore = mapScore;
          if (mapScore > 0) bestMap = m;
        }
      });

      // CRITERIO 3: Flex Pick (Bronce, 15 pts)
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
        reasons.push({ text: '🔄 FLEX', color: '#cd7f32', points: 15, title: `Pick flexible: Top 12 en ${flexMaps.join(' y ')}` });
        
        // Si sus puntos en un mapa concreto son más débiles que su valor como flex, indicamos los mapas flex
        if (bestMapScore < 15) {
          bestMap = flexMaps.map(m => m.length > 10 ? m.substring(0, 4) + '.' : m).join(' / ');
        }
      }

      if (score > 0) {
        // Limpiar duplicados y quedarse con la etiqueta de mayor puntuación (ej: si es Top en 2 mapas, se queda el Oro si uno está libre)
        const uniqueTexts = Array.from(new Set(reasons.map(r => r.text)));
        const uniqueReasons = uniqueTexts.map(text => {
           const matching = reasons.filter(r => r.text === text);
           return matching.reduce((prev, current) => (prev.points > current.points) ? prev : current);
        });
        
        // Ordena estrictamente de mayor puntuación a menor (Oro -> Azulito -> Bronce)
        uniqueReasons.sort((a, b) => b.points - a.points);

        suggestions.push({ civ, score, reasons: uniqueReasons, bestMap: bestMap || 'Global' });
      }
    });

    return suggestions.sort((a, b) => b.score - a.score).slice(0, 5);
  };
  const toggleCiv = (civ, type) => {
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

      if (type === 'ban') {
        if (isP1 || isP2) return prev; 
        if (isBanned) {
          newD.bans = newD.bans.filter(c => c !== civ); 
        } else {
          if (newD.bans.length >= 7) return prev; 
          newD.bans.push(civ);
        }
      } 
      else if (type === 'p1' || type === 'p2') {
        if (newD.bans.length < 7) return prev; 
        if (isBanned) return prev; 

        const myPicks = type === 'p1' ? newD.p1_picks : newD.p2_picks;
        const oppPicks = type === 'p1' ? newD.p2_picks : newD.p1_picks;

        if (myPicks.includes(civ)) {
          // AQUI ESTA LA MAGIA: Si devuelves el pick, lo borra también del Planner
          if (type === 'p1') {
             newD.p1_picks = newD.p1_picks.filter(c => c !== civ);
             newD.plan_p1 = newD.plan_p1.map(c => c === civ ? "" : c);
          }
          if (type === 'p2') {
             newD.p2_picks = newD.p2_picks.filter(c => c !== civ);
             newD.plan_p2 = newD.plan_p2.map(c => c === civ ? "" : c);
          }
        } else {
          if (myPicks.length >= 5) return prev;

          if (oppPicks.includes(civ)) {
            if (myPicks.length !== 0 || oppPicks[0] !== civ) {
              return prev; 
            }
          }
          if (type === 'p1') newD.p1_picks.push(civ);
          if (type === 'p2') newD.p2_picks.push(civ);
        }
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
          <h2 style={{ color: '#ffd700', fontSize: '16px', letterSpacing: '2px', marginBottom: '20px' }}>LEAT11 ENGINE - ACCESO RESTRINGIDO</h2>
          <input 
            type="password" 
            value={pass} 
            onChange={e => setPass(e.target.value)}
            onKeyDown={e => { if(e.key === 'Enter' && pass === "Emputors") setAuth(true) }}
            style={{ backgroundColor: '#1e212b', border: '1px solid #444', color: 'white', padding: '10px', borderRadius: '4px', outline: 'none', textAlign: 'center' }} 
            placeholder="Introduce la clave"
          />
          <br /><br />
          <button 
            onClick={() => { if (pass === "Emputors") setAuth(true) }} 
            style={{ backgroundColor: '#66b2ff', color: '#161920', border: 'none', padding: '8px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginTop: '10px' }}>
            ENTRAR
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
                <RenderTable title="Dataset General (All)" dataset={mapData.dataset_all} totalMatches={mapData.total_matches_all} />
                <RenderTable title="Dataset Élite (VOD)" dataset={mapData.dataset_elite} totalMatches={mapData.total_matches_elite} isClickable={true} />
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
                    <div key={i} onClick={() => toggleCiv(c, 'p1')} style={{ position: 'relative', width: '36px', height: '36px', border: '1.5px solid #66b2ff', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#1e212b', cursor: 'pointer' }}>                      <img src={`/civs/${c.toLowerCase()}.png`} alt={c} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display='none'; }} />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '14px', backgroundColor: 'rgba(0,0,0,0.85)', color: 'white', fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{c.substring(0,4)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ backgroundColor: '#161920', padding: '6px', borderRadius: '6px', border: '1px dashed #555', minHeight: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <h3 style={{ color: '#888', margin: '0 0 4px 0', fontSize: '11px', letterSpacing: '1px' }}>GLOBAL BANS</h3>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', minHeight: '36px' }}>
                  {draft.bans.map((c, i) => (
                    <div key={i} onClick={() => toggleCiv(c, 'ban')} style={{ position: 'relative', width: '36px', height: '36px', border: '1px solid #555', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#1e212b', cursor: 'pointer' }}>
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
                    <div key={i} onClick={() => toggleCiv(c, 'p2')} style={{ position: 'relative', width: '36px', height: '36px', border: '1.5px solid #ff6666', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#1e212b', cursor: 'pointer' }}>
                      <img src={`/civs/${c.toLowerCase()}.png`} alt={c} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display='none'; }} />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '14px', backgroundColor: 'rgba(0,0,0,0.85)', color: 'white', fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{c.substring(0,4)}</div>
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
                    <div key={c} onClick={e => toggleCiv(c, (e.ctrlKey || e.metaKey) ? 'ban' : e.altKey ? 'p2' : 'p1')} 
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
                    {draft.p1_picks.filter(c => !draft.plan_p1.includes(c)).map(c => <span key={c}>{c}</span>)}
                  </div>
                  <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '1px' }}>
                    UNASSIGNED / BENCH
                  </div>
                  <div style={{ display: 'flex', gap: '10px', color: '#ff6666', fontSize: '11px', fontWeight: 'bold' }}>
                    {draft.p2_picks.filter(c => !draft.plan_p2.includes(c)).map(c => <span key={c}>{c}</span>)}
                  </div>
                </div>
              </div>
            </div>

            {/* SUGERENCIAS DEL DRAFT */}
            <div style={{ backgroundColor: '#1a1c23', padding: '6px 8px', borderRadius: '6px', border: '1px solid #ffd700', marginTop: '10px', marginBottom: '10px' }}>
              <h3 style={{ color: '#ffd700', fontSize: '11px', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid #444', paddingBottom: '2px' }}>🔥 SMART SUGGESTIONS (TOP 5)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {getSuggestions().length === 0 ? (
                  <div style={{ color: '#888', fontSize: '10px', fontStyle: 'italic', textAlign: 'center', padding: '4px' }}>Faltan datos o mapas para sugerir.</div>
                ) : (
                  getSuggestions().map((s, i) => (
                    <div key={i} onClick={() => toggleCiv(s.civ, 'p1')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1e212b', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer', borderLeft: `2px solid ${s.reasons[0]?.color || '#555'}`, transition: 'background 0.2s', height: '20px' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2a2d36'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1e212b'}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '11px', width: '80px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.civ}</span>
                        <span style={{ color: '#aaa', fontSize: '10px', width: '100px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>🗺️ {s.bestMap}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
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
                <h3 style={{ color: '#ffd700', fontSize: '11px', margin: '0 0 2px 0', textTransform: 'uppercase' }}>TOP 7 CDPS</h3>
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
                        <tr key={i} style={{borderBottom: '1px solid #2a2d36', backgroundColor: i%2===0?'transparent':'#161920'}}>
                          <td style={{padding: '2px 1px', color: '#ff6666', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'top'}}>{c.substring(0,4)}</td>
                          {[0, 1, 2].map(j => {
                            const m = draft.maps[j];
                            if (!m) return <td key={j} style={{padding: '2px 1px'}}></td>;
                            const counters = draft.analysis?.counters_ladder?.[m]?.[c.toLowerCase()] || ["-", "-", "-"];
                            return (
                              <td key={j} style={{padding: '2px 1px', verticalAlign: 'top'}}>
                                {counters.map((cnt, idx) => {
                                  const style = getCivStyle(m, cnt);
                                  return <div key={idx} style={{marginBottom: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.3px', color: cnt === '-' ? '#555' : style.color, fontWeight: style.fontWeight, textDecoration: style.textDecoration}}>{cnt}</div>
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
                        <tr key={i} style={{borderBottom: '1px solid #2a2d36', backgroundColor: i%2===0?'transparent':'#161920'}}>
                          <td style={{padding: '2px 1px', color: '#ff6666', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'top'}}>{c.substring(0,4)}</td>
                          {[0, 1, 2].map(j => {
                            const m = draft.maps[j];
                            if (!m) return <td key={j} style={{padding: '2px 1px'}}></td>;
                            const counters = draft.analysis?.counters_pros?.[m]?.[c.toLowerCase()] || ["-", "-", "-"];
                            return (
                              <td key={j} style={{padding: '2px 1px', verticalAlign: 'top'}}>
                                {counters.map((cnt, idx) => {
                                  const style = getCivStyle(m, cnt);
                                  return <div key={idx} style={{marginBottom: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.3px', color: cnt === '-' ? '#555' : style.color, fontWeight: style.fontWeight, textDecoration: style.textDecoration}}>{cnt}</div>
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

      </div>
    </div>
  )
}

export default App