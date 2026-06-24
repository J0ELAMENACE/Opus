
const { useState, useEffect, useCallback, useMemo, useRef, createContext, useContext } = React;

/* ─── CONFIG ── */
const API      = null; // Electron : stockage fichier local via IPC
const OMDB_KEY = 'f9674bd';
const RAWG_KEY = '21c8b94ddeba47c8a8411a221b374c83';

/* ─── THEME CONTEXT ── */
const DarkCtx = createContext(false);
const useDark = () => useContext(DarkCtx);

/* helper — retourne les couleurs de surface selon le thème */
function useT() {
  const dm = useDark();
  return {
    bg:       dm ? '#080808' : '#F5F5F5',
    surface:  dm ? '#0D0D0D' : '#ffffff',
    surface2: dm ? '#111111' : '#F0F0F0',
    hover:    dm ? '#181818' : '#E8E8E8',
    border:   dm ? '#1E1E1E' : '#E0E0E0',
    border2:  dm ? '#2A2A2A' : '#C8C8C8',
    t1:       dm ? '#EEEEEE' : '#111111',
    t2:       dm ? '#888888' : '#666666',
    t3:       dm ? '#505050' : '#999999',
  };
}

/* ─── CONSTANTS ── */
const CATS = {
  movie:  { label:'Films',  icon:'🎬', color:'#DC2626', light:'#FEF2F2', lightDark:'#2A1212', creator:'Réalisateur' },
  series: { label:'Séries', icon:'📺', color:'#16A34A', light:'#F0FDF4', lightDark:'#0E2318', creator:'Créateur'    },
  anime:  { label:'Animés', icon:'⛩️', color:'#D97706', light:'#FFFBEB', lightDark:'#2A1F07', creator:'Studio'      },
  book:   { label:'Livres', icon:'📚', color:'#6090CC', light:'#EFF4FF', lightDark:'#0D1520', creator:'Auteur'      },
  game:   { label:'Jeux',   icon:'🎮', color:'#2563EB', light:'#EFF6FF', lightDark:'#0D1A33', creator:'Studio'      },
};
const STATUSES = {
  todo:    { label:'À faire',   color:'#9CA3AF', bg:'#F9FAFB', bgDark:'#1A1A1A' },
  doing:   { label:'En cours',  color:'#D97706', bg:'#FFFBEB', bgDark:'#1F1507' },
  done:    { label:'Terminé',   color:'#16A34A', bg:'#F0FDF4', bgDark:'#0A1F10' },
  dropped: { label:'Abandonné', color:'#DC2626', bg:'#FEF2F2', bgDark:'#1F0A0A' },
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

/* ─── API SEARCH ── */
async function searchMovies(q, limit=5) {
  try {
    const r = await fetch(`https://www.omdbapi.com/?apikey=${OMDB_KEY}&s=${encodeURIComponent(q)}&type=movie`);
    const d = await r.json();
    if (!d.Search) return [];
    return Promise.all(d.Search.slice(0, limit).map(async item => {
      try {
        const r2 = await fetch(`https://www.omdbapi.com/?apikey=${OMDB_KEY}&i=${item.imdbID}`);
        const dd = await r2.json();
        return { title:dd.Title, creator:dd.Director!=='N/A'?dd.Director:null, year:dd.Year?.slice(0,4)||null, cover:dd.Poster!=='N/A'?dd.Poster:null, genre:dd.Genre!=='N/A'?dd.Genre?.split(',')[0].trim():null, description:dd.Plot!=='N/A'?dd.Plot:null };
      } catch { return { title:item.Title, year:item.Year?.slice(0,4), cover:item.Poster!=='N/A'?item.Poster:null, creator:null, genre:null, description:null }; }
    }));
  } catch { return []; }
}
async function searchSeries(q, limit=5) {
  try {
    const r = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`);
    const d = await r.json();
    return d.slice(0, limit).map(({ show:s }) => ({ title:s.name, creator:null, year:s.premiered?.slice(0,4)||null, cover:s.image?.original||s.image?.medium||null, genre:s.genres?.[0]||null, description:s.summary?.replace(/<[^>]*>/g,'').slice(0,200)||null }));
  } catch { return []; }
}
async function searchAnime(q, limit=5) {
  try {
    const r = await fetch('https://graphql.anilist.co', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ query:`query($s:String,$n:Int){Page(perPage:$n){media(search:$s,type:ANIME,sort:POPULARITY_DESC){title{romaji english}startDate{year}genres coverImage{extraLarge large}description(asHtml:false)}}}`, variables:{s:q,n:limit} }) });
    const d = await r.json();
    return (d.data?.Page?.media||[]).map(m => ({ title:m.title.english||m.title.romaji, creator:null, year:m.startDate?.year?.toString()||null, cover:m.coverImage?.extraLarge||m.coverImage?.large||null, genre:m.genres?.[0]||null, description:m.description?.replace(/<[^>]*>/g,'').slice(0,200)||null }));
  } catch { return []; }
}
async function searchBooks(q, limit=5) {
  try {
    const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=${limit}&orderBy=relevance&langRestrict=fr`);
    const d = await r.json();
    if (!d.items) return [];
    return d.items.map(b => {
      const info = b.volumeInfo||{};
      const cover = info.imageLinks?.extraLarge||info.imageLinks?.large||info.imageLinks?.thumbnail||null;
      return { title:info.title||null, creator:info.authors?.[0]||null, year:info.publishedDate?.slice(0,4)||null, cover:cover?cover.replace('http://','https://').replace('&zoom=1','&zoom=3'):null, genre:info.categories?.[0]?.split('/')[0].trim()||null, description:info.description?.slice(0,200)||null };
    });
  } catch { return []; }
}
async function searchGames(q, limit=5) {
  try {
    const r = await fetch(`https://api.rawg.io/api/games?key=${RAWG_KEY}&search=${encodeURIComponent(q)}&page_size=${limit}`);
    const d = await r.json();
    return (d.results||[]).map(g => ({ title:g.name, creator:null, year:g.released?.slice(0,4)||null, cover:g.background_image||null, genre:g.genres?.[0]?.name||null, description:null }));
  } catch { return []; }
}
const SEARCH_FNS = { movie:searchMovies, series:searchSeries, anime:searchAnime, book:searchBooks, game:searchGames };

/* ─── STORAGE ── */
const IS_ELECTRON = typeof window !== 'undefined' && !!window.electronAPI;

async function loadItems() {
  if (IS_ELECTRON) return window.electronAPI.loadItems();
  if (API) { try { const r=await fetch(`${API}/items`); return r.json(); } catch { return []; } }
  try { return JSON.parse(localStorage.getItem('opus-v2')||'[]'); } catch { return []; }
}
function persist(items) {
  if (!IS_ELECTRON) localStorage.setItem('opus-v2',JSON.stringify(items));
}
async function saveNew(item) {
  if (IS_ELECTRON) { await window.electronAPI.addItem(item); return; }
  if (API) { await fetch(`${API}/items`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item)}); return; }
  const all=await loadItems(); all.unshift(item); persist(all);
}
async function updateItem(item) {
  if (IS_ELECTRON) { await window.electronAPI.updateItem(item); return; }
  if (API) { await fetch(`${API}/items/${item.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(item)}); return; }
  const all=await loadItems(); const idx=all.findIndex(i=>i.id===item.id); if(idx>=0) all[idx]=item; persist(all);
}
async function deleteItem(id) {
  if (IS_ELECTRON) { await window.electronAPI.deleteItem(id); return; }
  if (API) { await fetch(`${API}/items/${id}`,{method:'DELETE'}); return; }
  const all=await loadItems(); persist(all.filter(i=>i.id!==id));
}

/* ─── STAR RATING ── */
function StarRating({ value=0, onChange, size='md' }) {
  const [hover, setHover] = useState(0);
  const sz = size==='lg' ? '1.8rem' : '1.2rem';
  return (
    <div style={{display:'flex',gap:'2px'}}>
      {[1,2,3,4,5].map(n => (
        <span key={n} className="star-btn select-none"
          style={{fontSize:sz, color: n<=(hover||value) ? '#F59E0B' : 'var(--border2)'}}
          onClick={() => onChange && onChange(n===value?0:n)}
          onMouseEnter={() => onChange && setHover(n)}
          onMouseLeave={() => onChange && setHover(0)}>★</span>
      ))}
    </div>
  );
}

/* ─── TOAST ── */
function Toast({ msg, visible }) {
  if (!visible) return null;
  return <div className="toast-in fixed bottom-6 right-6 z-50 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-2xl pointer-events-none" style={{background:'var(--t1)'}}>{msg}</div>;
}

/* ─── CARD ── */
function Card({ item, onOpen, onEdit, onDelete }) {
  const dm  = useDark();
  const cat = CATS[item.cat]||CATS.movie;
  const st  = STATUSES[item.status]||STATUSES.todo;
  const catLight = dm ? cat.lightDark : cat.light;
  const stBg     = dm ? st.bgDark    : st.bg;
  return (
    <div className="card-root card-lift rounded-2xl overflow-hidden cursor-pointer relative"
      style={{background:'var(--surface)', border:'1px solid var(--border)'}}
      onClick={() => onOpen(item.id)}>
      <div className="relative overflow-hidden" style={{aspectRatio:'2/3', background:catLight}}>
        {item.cover ? <img src={item.cover} alt={item.title} loading="lazy" className="w-full h-full object-cover" onError={e=>{e.currentTarget.style.display='none';e.currentTarget.nextSibling.style.display='flex';}} /> : null}
        <div className="w-full h-full items-center justify-center text-5xl absolute inset-0" style={{background:catLight, display:item.cover?'none':'flex'}}>{cat.icon}</div>
        {item.cover && <div className="cover-gradient absolute inset-0 pointer-events-none" />}
        <div className="absolute top-2 left-2">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{background:stBg, color:st.color, border:`1px solid ${st.color}40`}}>{st.label}</span>
        </div>
        <div className="action-btn absolute top-2 right-2 flex gap-1" onClick={e=>e.stopPropagation()}>
          <button onClick={()=>onEdit(item.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors" style={{background:'rgba(255,255,255,0.9)',backdropFilter:'blur(4px)',color:'#374151'}}>✎</button>
          <button onClick={()=>onDelete(item.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-colors" style={{background:'rgba(255,255,255,0.9)',backdropFilter:'blur(4px)',color:'#374151'}}>✕</button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[3px]" style={{background:cat.color}} />
      </div>
      <div className="p-3">
        <div className="text-[13px] font-semibold truncate leading-snug mb-0.5" style={{color:'var(--t1)'}} title={item.title}>{item.title}</div>
        <div className="text-[11px] truncate" style={{color:'var(--t3)'}}>{[item.creator,item.year].filter(Boolean).join(' · ')}</div>
        {item.genre && <div className="mt-2"><span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{background:catLight, color:cat.color}}>{item.genre}</span></div>}
        {item.status==='done' && item.rating>0 && (
          <div className="mt-1.5 flex">{[1,2,3,4,5].map(n=><span key={n} style={{fontSize:'11px',color:n<=item.rating?'#F59E0B':'var(--border2)'}}>★</span>)}</div>
        )}
      </div>
    </div>
  );
}

/* ─── SEARCH MODAL ── */
function SearchModal({ open, initialCat, onClose, onAddMany, onManual }) {
  const dm = useDark();
  const T  = useT();
  const [cat,      setCat]      = useState(initialCat||'movie');
  const [query,    setQuery]    = useState('');
  const [results,  setResults]  = useState([]);
  const [phase,    setPhase]    = useState('idle');
  const [limit,    setLimit]    = useState(5);
  const [selected, setSelected] = useState(new Set());
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) { setCat(initialCat||'movie'); setQuery(''); setResults([]); setPhase('idle'); setSelected(new Set()); setTimeout(()=>inputRef.current?.focus(),120); }
  }, [open, initialCat]);

  const doSearch = async () => {
    if (!query.trim()) return;
    if (!navigator.onLine) { setPhase('offline'); setResults([]); setSelected(new Set()); return; }
    setPhase('loading'); setResults([]); setSelected(new Set());
    try { const res=await SEARCH_FNS[cat](query.trim(),limit); setResults(res); setPhase(res.length?'done':'empty'); }
    catch { setPhase('error'); }
  };

  const toggleSelect = i => setSelected(prev => { const n=new Set(prev); n.has(i)?n.delete(i):n.add(i); return n; });
  const handleAddSelected = () => {
    onAddMany([...selected].map(i=>({...results[i],cat,id:uid(),status:'todo',rating:0,added:Date.now()})));
    setSelected(new Set());
  };

  if (!open) return null;
  const catObj = CATS[cat];
  const catLight = dm ? catObj.lightDark : catObj.light;

  return (
    <div className="backdrop-in fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{background:'rgba(0,0,0,0.6)',backdropFilter:'blur(8px)'}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-in rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col" style={{maxHeight:'90vh',background:T.surface,border:`1px solid ${T.border}`}}>

        <div className="p-6 pb-4">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-xl font-bold" style={{color:T.t1}}>Ajouter une œuvre</h2>
            <button onClick={onClose} className="text-lg leading-none transition-colors" style={{color:T.t3}}>✕</button>
          </div>
          <div className="flex gap-1.5 flex-wrap mb-4">
            {Object.entries(CATS).map(([k,v]) => (
              <button key={k} onClick={()=>{setCat(k);setResults([]);setPhase('idle');setSelected(new Set());}}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={cat===k?{background:v.color,color:'white'}:{background:dm?v.lightDark:v.light,color:v.color}}>
                {v.icon} {v.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doSearch()}
              placeholder="Rechercher…"
              className="flex-1 rounded-xl px-4 py-2.5 text-sm transition-colors"
              style={{background:T.surface2,border:`1.5px solid ${T.border}`,color:T.t1}} />
            <select value={limit} onChange={e=>setLimit(Number(e.target.value))}
              className="rounded-xl px-3 py-2.5 text-sm cursor-pointer text-center appearance-none"
              style={{background:T.surface2,border:`1.5px solid ${T.border}`,color:T.t1}}>
              {[5,10,15,20].map(n=><option key={n} value={n}>{n}</option>)}
            </select>
            <button onClick={doSearch} disabled={phase==='loading'}
              className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-50 active:scale-95"
              style={{background:catObj.color}}>
              {phase==='loading'?'⟳':'Chercher'}
            </button>
          </div>
          {phase==='done' && results.length>0 && (
            <div className="flex items-center justify-between mt-3 pt-3" style={{borderTop:`1px solid ${T.border}`}}>
              <button onClick={()=>setSelected(selected.size===results.length?new Set():new Set(results.map((_,i)=>i)))}
                className="text-xs font-medium transition-colors" style={{color:T.t2}}>
                {selected.size===results.length?'Tout désélectionner':'Tout sélectionner'}
              </button>
              <span className="text-xs" style={{color:T.t3}}>{results.length} résultat{results.length>1?'s':''} · coche pour sélectionner</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-2">
          {phase==='loading' && [0,1,2].map(i=>(
            <div key={i} className="flex gap-3 p-3 rounded-xl" style={{border:`1px solid ${T.border}`}}>
              <div className="shimmer w-10 h-14 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2 pt-1"><div className="shimmer h-3 rounded-full w-3/4" /><div className="shimmer h-3 rounded-full w-1/2" /></div>
            </div>
          ))}
          {phase==='empty'   && <div className="text-center py-10 text-sm" style={{color:T.t3}}>Aucun résultat. Essaie un autre terme.</div>}
          {phase==='error'   && <div className="text-center py-10 text-sm text-red-400">Erreur réseau. Utilise la saisie manuelle.</div>}
          {phase==='offline' && <div className="text-center py-10 text-sm" style={{color:T.t2}}>📡 Pas de connexion internet.<br/>La recherche automatique est indisponible.<br/><span style={{color:T.t3}}>Utilise la saisie manuelle →</span></div>}
          {phase==='idle'    && <div className="text-center py-10 text-sm" style={{color:T.t3}}>Tape un titre et lance la recherche.</div>}
          {results.map((r,i) => {
            const isSel = selected.has(i);
            return (
              <div key={i} className="flex gap-3 p-3 rounded-xl cursor-pointer transition-all"
                style={isSel?{borderColor:catObj.color,background:catLight,border:`1.5px solid ${catObj.color}`}:{border:`1.5px solid ${T.border}`,background:'transparent'}}
                onClick={()=>toggleSelect(i)}>
                <div className="flex-shrink-0 self-center">
                  <div className="w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all"
                    style={isSel?{background:catObj.color,borderColor:catObj.color}:{borderColor:T.border2}}>
                    {isSel && <span className="text-white text-[11px] font-bold leading-none">✓</span>}
                  </div>
                </div>
                <div className="w-10 h-14 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center text-xl" style={{background:catLight}}>
                  {r.cover ? <img src={r.cover} alt="" className="w-full h-full object-cover" onError={e=>{e.target.style.display='none';}} /> : catObj.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold leading-tight" style={{color:T.t1}}>{r.title}</div>
                  <div className="text-xs mt-0.5" style={{color:T.t3}}>{[r.creator,r.year,r.genre].filter(Boolean).join(' · ')}</div>
                  {r.description && <div className="text-xs mt-1 line-clamp-2 leading-relaxed" style={{color:T.t2}}>{r.description}</div>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-6 py-4 flex items-center justify-between gap-3" style={{borderTop:`1px solid ${T.border}`}}>
          <button onClick={onClose} className="text-sm transition-colors flex-shrink-0" style={{color:T.t3}}>Fermer</button>
          <div className="flex gap-2 flex-1 justify-end">
            {selected.size>0 && (
              <button onClick={handleAddSelected} className="text-sm font-semibold px-4 py-2 rounded-xl text-white transition-all active:scale-95 flex-shrink-0" style={{background:catObj.color}}>
                Ajouter la sélection ({selected.size})
              </button>
            )}
            <button onClick={()=>onManual(cat)} className="text-sm font-semibold px-4 py-2 rounded-xl transition-colors flex-shrink-0" style={{background:T.surface2,color:T.t1}}>
              Saisie manuelle →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── ADD/EDIT MODAL ── */
function AddEditModal({ open, item, defaultCat, onClose, onSave }) {
  const dm = useDark();
  const T  = useT();
  const blank = { cat:defaultCat||'movie', title:'', creator:'', year:'', cover:'', genre:'', status:'todo', rating:0, note:'' };
  const [form, setForm] = useState(blank);

  useEffect(() => {
    if (!open) return;
    if (item) setForm({ cat:item.cat, title:item.title, creator:item.creator||'', year:item.year||'', cover:item.cover||'', genre:item.genre||'', status:item.status, rating:item.rating||0, note:item.note||'' });
    else setForm({...blank, cat:defaultCat||'movie'});
  }, [open, item, defaultCat]);

  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const handleSave = () => {
    if (!form.title.trim()) return;
    onSave({ id:item?.id||uid(), cat:form.cat, title:form.title.trim(), creator:form.creator.trim()||null, year:form.year.trim()||null, cover:form.cover.trim()||null, genre:form.genre.trim()||null, status:form.status, rating:form.status==='done'?(form.rating||0):0, note:form.note.trim()||null, added:item?.added||Date.now() });
  };

  if (!open) return null;
  const catObj = CATS[form.cat];
  const inputStyle = { background:T.surface2, border:`1.5px solid ${T.border}`, color:T.t1, borderRadius:'12px', width:'100%', padding:'9px 12px', fontSize:'0.85rem', transition:'border-color 0.15s' };
  const labelStyle = { display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.1em', color:T.t3, marginBottom:'5px' };

  return (
    <div className="backdrop-in fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{background:'rgba(0,0,0,0.6)',backdropFilter:'blur(8px)'}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-in rounded-3xl w-full max-w-md shadow-2xl flex flex-col" style={{maxHeight:'92vh',background:T.surface,border:`1px solid ${T.border}`}}>
        <div className="p-6 overflow-y-auto flex-1">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl font-bold" style={{color:T.t1}}>{item?'Modifier':'Ajouter manuellement'}</h2>
            <button onClick={onClose} className="text-lg leading-none" style={{color:T.t3}}>✕</button>
          </div>
          <div className="space-y-4">
            <div>
              <label style={labelStyle}>Catégorie</label>
              <div className="flex gap-1.5 flex-wrap">
                {Object.entries(CATS).map(([k,v]) => (
                  <button key={k} onClick={()=>set('cat',k)} className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                    style={form.cat===k?{background:v.color,color:'white'}:{background:dm?v.lightDark:v.light,color:v.color}}>
                    {v.icon} {v.label}
                  </button>
                ))}
              </div>
            </div>
            <div><label style={labelStyle}>Titre *</label><input value={form.title} onChange={e=>set('title',e.target.value)} placeholder="Titre…" style={inputStyle} /></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
              <div><label style={labelStyle}>{catObj.creator}</label><input value={form.creator} onChange={e=>set('creator',e.target.value)} placeholder="Nom…" style={inputStyle} /></div>
              <div><label style={labelStyle}>Année</label><input value={form.year} onChange={e=>set('year',e.target.value)} placeholder="2024" style={inputStyle} /></div>
            </div>
            <div><label style={labelStyle}>Genre</label><input value={form.genre} onChange={e=>set('genre',e.target.value)} placeholder="Action, RPG, Thriller…" style={inputStyle} /></div>
            <div><label style={labelStyle}>URL Couverture</label><input value={form.cover} onChange={e=>set('cover',e.target.value)} placeholder="https://…" style={inputStyle} /></div>
            <div>
              <label style={labelStyle}>État</label>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(STATUSES).map(([k,v]) => (
                  <button key={k} onClick={()=>set('status',k)} className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                    style={form.status===k?{background:v.color,color:'white',borderColor:v.color}:{color:v.color,borderColor:v.color+'50',background:'transparent'}}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            {form.status==='done' && (
              <div><label style={labelStyle}>Note</label><StarRating value={form.rating} onChange={v=>set('rating',v)} size="lg" /></div>
            )}
            <div><label style={labelStyle}>Note personnelle</label>
              <textarea value={form.note} onChange={e=>set('note',e.target.value)} placeholder="Recommandé par… / Contexte…" rows={3}
                style={{...inputStyle, resize:'vertical', minHeight:'60px'}} />
            </div>
          </div>
        </div>
        <div className="px-6 py-4 flex gap-3 justify-end" style={{borderTop:`1px solid ${T.border}`}}>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm transition-all" style={{color:T.t2,border:`1px solid ${T.border}`}}>Annuler</button>
          <button onClick={handleSave} disabled={!form.title.trim()} className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 active:scale-95" style={{background:catObj.color}}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

/* ─── DETAIL MODAL ── */
function DetailModal({ open, item, onClose, onEdit, onUpdate }) {
  const dm  = useDark();
  const T   = useT();
  if (!open||!item) return null;
  const cat = CATS[item.cat]||CATS.movie;
  const st  = STATUSES[item.status]||STATUSES.todo;
  const catLight = dm ? cat.lightDark : cat.light;

  return (
    <div className="backdrop-in fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{background:'rgba(0,0,0,0.6)',backdropFilter:'blur(8px)'}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-in rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col" style={{maxHeight:'92vh',background:T.surface,border:`1px solid ${T.border}`}}>
        <div className="relative flex-shrink-0" style={{height:'220px',background:catLight}}>
          {item.cover ? <img src={item.cover} alt={item.title} className="w-full h-full object-cover" onError={e=>{e.target.style.display='none';}} /> : <div className="w-full h-full flex items-center justify-center text-7xl">{cat.icon}</div>}
          {item.cover && <div className="cover-gradient absolute inset-0 pointer-events-none" />}
          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-sm text-white transition-colors" style={{background:'rgba(0,0,0,0.4)',backdropFilter:'blur(4px)'}}>✕</button>
          {item.cover && (
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <div className="font-display text-white font-bold text-lg leading-tight">{item.title}</div>
              {(item.creator||item.year) && <div className="text-white/75 text-xs mt-0.5">{[item.creator,item.year].filter(Boolean).join(' · ')}</div>}
            </div>
          )}
        </div>
        <div className="overflow-y-auto flex-1 p-5">
          {!item.cover && (
            <div className="mb-4">
              <div className="font-display font-bold text-lg leading-tight" style={{color:T.t1}}>{item.title}</div>
              {(item.creator||item.year) && <div className="text-sm mt-0.5" style={{color:T.t2}}>{[item.creator,item.year].filter(Boolean).join(' · ')}</div>}
            </div>
          )}
          <div className="flex gap-2 flex-wrap mb-4 mt-2">
            <span className="text-[11px] font-bold px-3 py-1 rounded-full" style={{background:catLight,color:cat.color}}>{cat.icon} {cat.label}</span>
            {item.genre && <span className="text-[11px] font-bold px-3 py-1 rounded-full" style={{background:T.surface2,color:T.t2}}>{item.genre}</span>}
            <span className="text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5" style={{background:dm?st.bgDark:st.bg,color:st.color}}>
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{background:st.color}} />{st.label}
            </span>
          </div>
          <div className="text-[11px] mb-4" style={{color:T.t3}}>Ajouté le {new Date(item.added).toLocaleDateString('fr-FR')}</div>
          {item.status==='done' && (
            <div className="mb-4 p-4 rounded-2xl" style={{background:dm?'#1F1507':'#FFFBEB',border:'1px solid #FDE68A'}}>
              <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{color:T.t3}}>Ma note</div>
              <StarRating value={item.rating||0} onChange={v=>onUpdate({...item,rating:v})} size="lg" />
            </div>
          )}
          <div className="mb-4">
            <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{color:T.t3}}>Changer l'état</div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(STATUSES).map(([k,v]) => (
                <button key={k} onClick={()=>onUpdate({...item,status:k,rating:k==='done'?item.rating:0})}
                  className="py-2.5 rounded-xl text-xs font-semibold border transition-all active:scale-95"
                  style={item.status===k?{background:v.color,color:'white',borderColor:v.color}:{color:v.color,borderColor:v.color+'40',background:dm?v.bgDark:v.bg}}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          {item.note && (
            <div className="p-4 rounded-2xl" style={{background:T.surface2,border:`1px solid ${T.border}`}}>
              <p className="text-xs italic leading-relaxed" style={{color:T.t2}}>{item.note}</p>
            </div>
          )}
        </div>
        <div className="px-5 pb-5 pt-3 flex gap-3" style={{borderTop:`1px solid ${T.border}`}}>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm transition-all" style={{border:`1px solid ${T.border}`,color:T.t2}}>Fermer</button>
          <button onClick={()=>onEdit(item.id)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-95" style={{background:cat.color}}>Modifier</button>
        </div>
      </div>
    </div>
  );
}

/* ─── APP ── */
/* ─── SIDEBAR HELPERS ── */
const CATS_LIST = [
  { key:'movie',  label:'Films',  rgb:'224,82,82',   color:'#E05252', icon:<svg viewBox="0 0 16 16" fill="none" stroke="#E05252" strokeWidth="1.7"><rect x="1" y="3" width="14" height="10" rx="2"/><path d="M1 6h14M4 3v3M7 3v3M10 3v3M13 3v3"/></svg> },
  { key:'series', label:'Séries', rgb:'72,199,122',  color:'#48C77A', icon:<svg viewBox="0 0 16 16" fill="none" stroke="#48C77A" strokeWidth="1.7"><rect x="1" y="2" width="14" height="10" rx="2"/><path d="M5 14h6M8 12v2"/></svg> },
  { key:'anime',  label:'Animés', rgb:'244,168,75',  color:'#F4A84B', icon:<svg viewBox="0 0 16 16" fill="none" stroke="#F4A84B" strokeWidth="1.7"><path d="M8 2C4.7 2 2 4.4 2 7.5c0 1.8.9 3.4 2.3 4.4.2.5.3 1.1.2 1.6L6 14h4l1.5-.5c-.1-.5 0-1.1.2-1.6C13.1 10.9 14 9.3 14 7.5 14 4.4 11.3 2 8 2z"/></svg> },
  { key:'book',   label:'Livres', rgb:'96,144,204',  color:'#6090CC', icon:<svg viewBox="0 0 16 16" fill="none" stroke="#6090CC" strokeWidth="1.7"><path d="M3 2h8a1 1 0 0 1 1 1v11l-4.5-2L3 14V2z"/><path d="M7 2v11"/></svg> },
  { key:'game',   label:'Jeux',   rgb:'75,156,244',  color:'#4B9CF4', icon:<svg viewBox="0 0 16 16" fill="none" stroke="#4B9CF4" strokeWidth="1.7"><rect x="1" y="4" width="14" height="8" rx="3"/><path d="M5 8h4M7 6v4"/><circle cx="11" cy="7" r=".5" fill="#4B9CF4"/><circle cx="11" cy="9" r=".5" fill="#4B9CF4"/></svg> },
];
const STATUS_LIST = [
  { key:'todo',    label:'À faire',   color:'#606060', glow:false },
  { key:'doing',   label:'En cours',  color:'#F4A84B', glow:true  },
  { key:'done',    label:'Terminé',   color:'#48C77A', glow:true  },
  { key:'dropped', label:'Abandonné', color:'#E05252', glow:false },
];
const IB = { width:'32px', height:'32px', borderRadius:'8px', background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--t3)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 };

function NavItem({ label, count, active, onClick, icon }) {
  return (
    <div onClick={onClick} style={{display:'flex', alignItems:'center', gap:'9px', padding:'7px 9px', borderRadius:'8px', fontSize:'12.5px', fontWeight:500, color:active?'var(--t1)':'var(--t2)', cursor:'pointer', background:active?'rgba(255,255,255,0.06)':'transparent', position:'relative', transition:'all 0.1s'}}>
      {active && <div style={{position:'absolute', left:0, top:6, bottom:6, width:'2.5px', borderRadius:'2px', background:'var(--t1)'}} />}
      {icon}
      {label}
      <span style={{marginLeft:'auto', fontSize:'10px', fontWeight:700, color:'var(--t3)', background:'var(--surface2)', border:'1px solid var(--border)', padding:'0 5px', borderRadius:'4px', minWidth:'20px', textAlign:'center'}}>{count}</span>
    </div>
  );
}

function App() {
  const [items,      setItems]      = useState([]);
  const [fCat,       setFCat]       = useState('all');
  const [fSt,        setFSt]        = useState('all');
  const [fLetter,    setFLetter]    = useState('all');
  const [fYear,      setFYear]      = useState('all');
  const [sort,       setSort]       = useState('added');
  const [query,      setQuery]      = useState('');
  const [modal,      setModal]      = useState(null);
  const [editItem,   setEditItem]   = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const [manualCat,  setManualCat]  = useState('movie');
  const [toast,      setToast]      = useState({ msg:'', on:false });
  const [dm,         setDm]         = useState(() => localStorage.getItem('opus-dm')==='1');

  /* dark mode persistence */
  useEffect(() => {
    document.body.classList.toggle('dark', dm);
    localStorage.setItem('opus-dm', dm?'1':'0');
  }, [dm]);

  /* Escape */
  useEffect(() => {
    const h = e => { if (e.key==='Escape') setModal(null); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const refresh = useCallback(async () => { const data=await loadItems(); setItems(data); }, []);
  useEffect(() => { refresh(); }, []);

  const showToast = msg => { setToast({msg,on:true}); setTimeout(()=>setToast(t=>({...t,on:false})),2600); };

  const filtered = useMemo(() => {
    let list = items.filter(it => {
      if (fCat!=='all'    && it.cat!==fCat) return false;
      if (fSt!=='all'     && it.status!==fSt) return false;
      if (fLetter!=='all' && it.title?.[0]?.toUpperCase()!==fLetter) return false;
      if (fYear!=='all'   && it.year!==fYear) return false;
      if (query && !it.title.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
    if (sort==='alpha') list.sort((a,b)=>a.title.localeCompare(b.title,'fr'));
    else if (sort==='year') list.sort((a,b)=>(b.year||0)-(a.year||0));
    else list.sort((a,b)=>b.added-a.added);
    return list;
  }, [items, fCat, fSt, fLetter, fYear, sort, query]);

  /* lettres et années présentes dans la bibliothèque */
  const usedLetters = useMemo(() => new Set(items.map(i => i.title?.[0]?.toUpperCase()).filter(Boolean)), [items]);
  const availableYears = useMemo(() => [...new Set(items.map(i=>i.year).filter(Boolean))].sort((a,b)=>b-a), [items]);

  const stats = useMemo(() => ({ total:items.length, doing:items.filter(i=>i.status==='doing').length, done:items.filter(i=>i.status==='done').length }), [items]);

  const handleAdd     = async item => { await saveNew(item); await refresh(); setModal(null); showToast(`"${item.title}" ajouté !`); };
  const handleAddMany = async its  => {
    for (const it of its) await saveNew(it);
    await refresh();
    setModal(null);
    showToast(its.length===1 ? `"${its[0].title}" ajouté !` : `${its.length} œuvres ajoutées !`);
  };
  const handleSave    = async item => {
    if (editItem) { await updateItem(item); showToast('Modifié !'); }
    else          { await saveNew(item);    showToast(`"${item.title}" ajouté !`); }
    await refresh(); setModal(null); setEditItem(null);
  };
  const handleDelete  = async id => {
    if (!confirm('Supprimer cette œuvre ?')) return;
    await deleteItem(id); await refresh(); showToast('Supprimé.');
  };
  const handleEdit    = id => { setEditItem(items.find(i=>i.id===id)); setDetailItem(null); setModal('add'); };
  const handleUpdate  = async updated => { await updateItem(updated); await refresh(); setDetailItem(updated); };
  const openDetail    = id => { setDetailItem(items.find(i=>i.id===id)); setModal('detail'); };
  const openManual    = cat => { setManualCat(cat); setEditItem(null); setModal('add'); };

  /* ── EXPORT ── */
  const handleExport = async () => {
    if (IS_ELECTRON) {
      const res = await window.electronAPI.exportJSON();
      if (res.ok) showToast(`${res.count} œuvres exportées !`);
      return;
    }
    const data = JSON.stringify(items, null, 2);
    const blob  = new Blob([data], { type: 'application/json' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    const date  = new Date().toISOString().slice(0,10);
    a.href      = url;
    a.download  = `opus-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`${items.length} œuvres exportées !`);
  };

  /* ── IMPORT ── */
  const importRef = useRef(null);
  const handleImport = async e => {
    if (IS_ELECTRON) {
      const res = await window.electronAPI.importJSON();
      if (!res.ok) { showToast(res.error || 'Import annulé.'); return; }
      if (res.count === 0) { showToast('Aucune nouvelle œuvre à importer.'); return; }
      await refresh();
      showToast(`${res.count} œuvre${res.count>1?'s':''} importée${res.count>1?'s':''} !`);
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (!Array.isArray(imported)) { showToast('Fichier invalide.'); return; }
        const existingIds = new Set(items.map(i => i.id));
        const toAdd = imported.filter(i => i.id && i.title && !existingIds.has(i.id));
        if (toAdd.length === 0) { showToast('Aucune nouvelle œuvre à importer.'); return; }
        for (const it of toAdd) await saveNew(it);
        await refresh();
        showToast(`${toAdd.length} œuvre${toAdd.length>1?'s':''} importée${toAdd.length>1?'s':''} !`);
      } catch { showToast('Erreur de lecture du fichier.'); }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <DarkCtx.Provider value={dm}>
      <div style={{height:'100vh', overflow:'hidden', display:'flex', flexDirection:'column', background:'var(--bg)'}}>

        {/* ── TOPBAR ── */}
        <header style={{height:'52px', flexShrink:0, background:'var(--surface)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', padding:'0 16px', gap:'10px', zIndex:20}}>
          <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
            <img src="assets/logo.svg" alt="Opus" style={{width:'28px', height:'28px'}} />
            <span style={{fontSize:'15px', fontWeight:700, letterSpacing:'-0.04em', color:'var(--t1)'}}>Opus</span>
          </div>
          <div style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:'6px'}}>
            <button onClick={()=>setDm(d=>!d)} style={IB} title={dm?'Mode clair':'Mode sombre'}>
              {dm
                ? <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" style={{width:'14px',height:'14px'}}><circle cx="8" cy="8" r="3"/><path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.2 3.2l1 1M11.8 11.8l1 1M3.2 12.8l1-1M11.8 4.2l1-1"/></svg>
                : <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" style={{width:'14px',height:'14px'}}><path d="M13.5 8.5A6 6 0 0 1 6 2 6 6 0 1 0 13.5 8.5z"/></svg>
              }
            </button>
            <button onClick={handleExport} style={IB} title="Exporter">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" style={{width:'14px',height:'14px'}}><path d="M8 11V2M5 5l3-3 3 3"/><path d="M3 13h10"/></svg>
            </button>
            <button onClick={IS_ELECTRON ? handleImport : ()=>importRef.current?.click()} style={IB} title="Importer">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" style={{width:'14px',height:'14px'}}><path d="M8 2v9M5 8l3 3 3-3"/><path d="M3 13h10"/></svg>
            </button>
            {!IS_ELECTRON && <input ref={importRef} type="file" accept=".json" style={{display:'none'}} onChange={handleImport} />}
            <button onClick={()=>{setEditItem(null);setModal('search');}} style={{display:'flex',alignItems:'center',gap:'6px',padding:'7px 15px',borderRadius:'8px',background:'var(--surface2)',border:'1px solid var(--border2)',color:'var(--t1)',fontSize:'12px',fontWeight:700,cursor:'pointer',letterSpacing:'-0.01em'}}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" style={{width:'13px',height:'13px'}}><path d="M8 3v10M3 8h10"/></svg>
              Ajouter
            </button>
          </div>
        </header>

        {/* ── LAYOUT ── */}
        <div style={{display:'flex', flex:1, overflow:'hidden'}}>

          {/* ── SIDEBAR ── */}
          <aside style={{width:'216px', flexShrink:0, background:'var(--surface)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', overflowY:'auto', overflowX:'hidden'}}>

            {/* Search */}
            <div style={{margin:'12px 10px 4px', position:'relative'}}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" style={{position:'absolute',left:'9px',top:'50%',transform:'translateY(-50%)',width:'13px',height:'13px',color:'var(--t3)',pointerEvents:'none'}}><circle cx="6.5" cy="6.5" r="4"/><path d="M11 11l2.5 2.5"/></svg>
              <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Filtrer…" style={{width:'100%',background:'var(--surface2)',border:'1.5px solid var(--border)',borderRadius:'9px',padding:'8px 12px 8px 32px',fontSize:'12px',color:'var(--t1)'}} />
            </div>

            {/* Stats */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px',margin:'8px 10px'}}>
              <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'8px',padding:'9px 10px'}}>
                <div style={{fontSize:'18px',fontWeight:700,letterSpacing:'-0.04em',lineHeight:1,color:'var(--t1)'}}>{stats.total}</div>
                <div style={{fontSize:'9px',color:'var(--t3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginTop:'3px'}}>Total</div>
              </div>
              <div style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'8px',padding:'9px 10px'}}>
                <div style={{fontSize:'18px',fontWeight:700,letterSpacing:'-0.04em',lineHeight:1,color:'#F4A84B'}}>{stats.doing}</div>
                <div style={{fontSize:'9px',color:'var(--t3)',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginTop:'3px'}}>En cours</div>
              </div>
            </div>

            <div style={{height:'1px',background:'var(--border)',margin:'4px 10px 8px'}} />

            {/* Catégories */}
            <div style={{padding:'6px 10px'}}>
              <div style={{fontSize:'9px',fontWeight:800,textTransform:'uppercase',letterSpacing:'0.14em',color:'var(--t3)',padding:'0 8px',marginBottom:'5px'}}>Catégorie</div>
              <NavItem label="Tout" count={items.length} active={fCat==='all'} onClick={()=>{setFCat('all');setFSt('all');}}
                icon={<div style={{width:'20px',height:'20px',borderRadius:'5px',background:'rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><svg viewBox="0 0 16 16" fill="none" stroke="var(--t2)" strokeWidth="1.7" style={{width:'11px',height:'11px'}}><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg></div>}
              />
              {CATS_LIST.map(c=>(
                <NavItem key={c.key} label={c.label} count={items.filter(i=>i.cat===c.key).length} active={fCat===c.key} onClick={()=>{setFCat(c.key);setFSt('all');}}
                  icon={<div style={{width:'20px',height:'20px',borderRadius:'5px',background:`rgba(${c.rgb},0.14)`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{c.icon}</div>}
                />
              ))}
            </div>

            <div style={{height:'1px',background:'var(--border)',margin:'4px 10px 8px'}} />

            {/* État */}
            <div style={{padding:'6px 10px'}}>
              <div style={{fontSize:'9px',fontWeight:800,textTransform:'uppercase',letterSpacing:'0.14em',color:'var(--t3)',padding:'0 8px',marginBottom:'5px'}}>État</div>
              {STATUS_LIST.map(s=>(
                <NavItem key={s.key} label={s.label} count={items.filter(i=>i.status===s.key).length} active={fSt===s.key} onClick={()=>{setFSt(s.key);setFCat('all');}}
                  icon={<div style={{width:'7px',height:'7px',borderRadius:'50%',background:s.color,flexShrink:0,boxShadow:s.glow?`0 0 6px ${s.color}80`:'none'}} />}
                />
              ))}
            </div>

            <div style={{height:'1px',background:'var(--border)',margin:'4px 10px 8px'}} />

            {/* A–Z */}
            <div style={{padding:'6px 10px 16px'}}>
              <div style={{fontSize:'9px',fontWeight:800,textTransform:'uppercase',letterSpacing:'0.14em',color:'var(--t3)',padding:'0 8px',marginBottom:'8px'}}>Initiale</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:'3px',padding:'0 2px'}}>
                {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l=>{
                  const has=usedLetters.has(l), active=fLetter===l;
                  return (
                    <button key={l} onClick={()=>has&&setFLetter(active?'all':l)}
                      style={{width:'26px',height:'26px',borderRadius:'6px',fontSize:'10px',fontWeight:700,border:'none',cursor:has?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',background:active?'var(--border2)':has?'var(--surface2)':'transparent',color:active?'var(--t1)':has?'var(--t2)':'var(--border2)'}}>
                      {l}
                    </button>
                  );
                })}
                {fLetter!=='all' && <button onClick={()=>setFLetter('all')} style={{fontSize:'10px',color:'#E05252',background:'transparent',border:'none',cursor:'pointer',marginTop:'4px'}}>✕ reset</button>}
              </div>
            </div>

          </aside>

          {/* ── MAIN ── */}
          <main style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column'}}>

            {/* Main header */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'20px 22px 14px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
              <div>
                <div style={{fontSize:'18px',fontWeight:700,letterSpacing:'-0.03em',display:'flex',alignItems:'baseline',gap:'8px',color:'var(--t1)'}}>
                  {fCat==='all'?'Tout':(CATS[fCat]?.label||'Tout')}
                  {fSt!=='all' && <span style={{fontSize:'12px',color:'var(--t3)',fontWeight:500}}>· {STATUS_LIST.find(s=>s.key===fSt)?.label}</span>}
                  <span style={{fontSize:'12px',color:'var(--t3)',fontWeight:500}}>{filtered.length} résultats</span>
                </div>
                <div style={{fontSize:'12px',color:'var(--t3)',fontWeight:500,marginTop:'2px'}}>
                  {sort==='added'?'Triés par date d\'ajout':sort==='alpha'?'Triés A → Z':'Triés par année'}
                </div>
              </div>
              <div style={{display:'flex',gap:'4px'}}>
                {[['added','Récents'],['alpha','A → Z'],['year','Année']].map(([k,l])=>(
                  <button key={k} onClick={()=>setSort(k)} style={{padding:'5px 11px',borderRadius:'6px',fontSize:'11px',fontWeight:700,background:sort===k?'var(--surface2)':'transparent',border:`1px solid ${sort===k?'var(--border2)':'transparent'}`,color:sort===k?'var(--t1)':'var(--t3)',cursor:'pointer'}}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid */}
            <div style={{padding:'18px 22px',flex:1}}>
              {filtered.length===0 ? (
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'80px 0',gap:'10px'}}>
                  <div style={{fontSize:'48px',opacity:0.2}}>{fCat!=='all'?CATS[fCat]?.icon:'📂'}</div>
                  <div style={{fontSize:'14px',fontWeight:600,color:'var(--t3)'}}>Rien à afficher</div>
                  <div style={{fontSize:'12px',color:'var(--t3)',opacity:0.6}}>Clique sur Ajouter pour commencer</div>
                </div>
              ) : (
                <div className="card-group" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(155px,1fr))',gap:'12px'}}>
                  {filtered.map(item=><Card key={item.id} item={item} onOpen={openDetail} onEdit={handleEdit} onDelete={handleDelete}/>)}
                </div>
              )}
            </div>

          </main>
        </div>

        {/* MODALS */}
        <SearchModal open={modal==='search'} initialCat={fCat!=='all'?fCat:'movie'} onClose={()=>setModal(null)} onAddMany={handleAddMany} onManual={openManual}/>
        <AddEditModal open={modal==='add'} item={editItem} defaultCat={manualCat} onClose={()=>{setModal(null);setEditItem(null);}} onSave={handleSave}/>
        <DetailModal open={modal==='detail'} item={detailItem} onClose={()=>{setModal(null);setDetailItem(null);}} onEdit={handleEdit} onUpdate={handleUpdate}/>
        <Toast msg={toast.msg} visible={toast.on}/>
      </div>
    </DarkCtx.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));

