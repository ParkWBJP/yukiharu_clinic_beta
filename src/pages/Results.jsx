import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
function useIO(callback) {
  const cbRef = React.useRef(callback);
  React.useEffect(() => { cbRef.current = callback; }, [callback]);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) cbRef.current?.();
      });
    }, { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}
// Safe gender avatar using unicode escapes (no encoding issues)
function GenderAvatar({ gender }) {
  const s = String(gender || '').toLowerCase();
  const isFemale = /female|\uC5EC/.test(s); // '?? in unicode
  const emoji = isFemale ? '\u{1F469}' : '\u{1F468}';
  return <div className="avatar" aria-hidden><span className="avatar-emoji">{emoji}</span></div>;
}
function PersonaCard({ data, onChange }) {
  const [draft, setDraft] = React.useState(data);
  const [dirty, setDirty] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const ioRef = useIO(() => setVisible(true));
  const [editingQ, setEditingQ] = React.useState(-1);
  const [editLine, setEditLine] = React.useState(false);
  React.useEffect(() => { setDraft(data); setDirty(false); }, [data]);
  const update = (patch) => { const next = { ...draft, ...patch }; setDraft(next); setDirty(true); };
  const save = async () => { onChange?.(draft); setDirty(false); };
  const cancel = () => { setDraft(data); setDirty(false); };
  const questions = draft.questions || [];
  return (
    <div className={`persona-card ${dirty ? 'dirty' : ''}`} ref={ioRef}>
      <div className="pc-head left">
        <GenderAvatar gender={draft.gender} />
        <div className="pc-title">
          <input className="inline-edit name-center" value={draft.name} onChange={(e) => update({ name: e.target.value })} aria-label="이름" />
          {editLine ? (
            <div className="pc-line-editor">
              <input className="inline-edit small-edit" value={draft.ageRange || ''} onChange={(e)=>update({ ageRange: e.target.value })} placeholder="30대" aria-label="연령" />
              <input className="inline-edit small-edit" value={draft.gender || ''} onChange={(e)=>update({ gender: e.target.value })} placeholder="여성/남성" aria-label="성별" />
              <button className="edit-btn" type="button" onClick={()=>setEditLine(false)}>완료</button>
            </div>
          ) : (
            <div className="pc-sentence">
              {'\uB300\uD55C\uBBFC\uAD6D\uC5D0 \uAC70\uC8FC\uC911\uC778'} {draft.ageRange || '20대'} {draft.gender || '여성'}
              <button type="button" className="icon-btn" aria-label="edit" onClick={()=>setEditLine(true)}>✏️</button>
            </div>
          )}
        </div>
        {dirty && <span className="badge">수정됨</span>}
      </div>
      {/* persona loading indicator is rendered in ResultsPage, not here */}
      <div className="pc-body">
        <div className="pc-row">
          <label>방문 목적</label>
          <div className="option-box">
            <div className="checks">
              {['상담','시술','가격비교','후기확인','예약','기타'].map(p => (
                <label key={p} className="check">
                  <input type="checkbox" checked={(draft.purposes||[]).includes(p)} onChange={(e)=>{
                    const cur = new Set(draft.purposes||[]);
                    if (e.target.checked) cur.add(p); else cur.delete(p);
                    update({ purposes: Array.from(cur) });
                  }} />
                  <span>{p}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="pc-row">
          <label>직업</label>
          <div className="option-box">
            <div className="checks">
              {['학생','직장인','주부','자영업자','프리랜서','공무원','기타'].map(job => (
                <label key={job} className="check">
                  <input type="checkbox" checked={(draft.jobs||[]).includes(job)} onChange={(e)=>{
                    const set = new Set(draft.jobs||[]);
                    if (e.target.checked) set.add(job); else set.delete(job);
                    update({ jobs: Array.from(set) });
                  }} />
                  <span>{job}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="pc-row">
          <label>예산대</label>
          <div className="range-wrap">
            <input className="range-long" type="range" min="0" max="500" step="10" value={draft.budget || 100} onChange={(e)=>update({ budget: Number(e.target.value) })} />
            <span className="muted small">~ {draft.budget || 100} 만원</span>
          </div>
        </div>
      </div>
      <div className="pc-questions">
        <div className="pc-q-title">AI 검색질문</div>
        {(questions).map((q, idx) => (
          <div key={idx} className="q-row">
            <div className="q-text" onClick={() => setEditingQ(idx)}>
              {editingQ === idx ? (
                <input
                  className="inline-edit q-editor"
                  autoFocus
                  value={typeof q.text === 'string' ? q.text : String(q)}
                  onChange={(e)=>{
                    const next = [...questions]; next[idx] = { ...q, text: e.target.value }; update({ questions: next });
                  }}
                  onBlur={() => setEditingQ(-1)}
                  onKeyDown={(e)=>{ if(e.key==='Enter'||e.key==='Escape'){ e.currentTarget.blur(); } }}
                />
              ) : (
                <>{typeof q.text === 'string' ? q.text : String(q)}</>
              )}
            </div>
          </div>
        ))}
      </div>
      {dirty && (
        <div className="pc-actions">
          <button className="btn btn-primary" onClick={save}>저장</button>
          <button className="btn btn-ghost" onClick={cancel}>취소</button>
        </div>
      )}
    </div>
  );
}
// Re-render only when the specific card's data reference changes
const MemoPersonaCard = React.memo(PersonaCard, (prev, next) => prev.data === next.data);
// mock generator removed (use API only)
export default function ResultsPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [items, setItems] = React.useState([]);
  function normalizeName(name, i) {
    const pool = ['김서연','이수민','박지훈','최유진','정현우','한소희','오지민','유다인','서지우','강민서'];
    if (!name) return pool[i % pool.length];
    const ascii = /^[\x00-\x7F]+$/.test(String(name));
    if (ascii || /female|male|young/i.test(String(name))) return pool[i % pool.length];
    return String(name);
  }
  function toKoGender(g) {
    const s = String(g || "").toLowerCase();
    if (s.includes("여") || s.includes("female")) return "여성";
    if (s.includes("남") || s.includes("male")) return "남성";
    return "여성";
  }
  function toKoAge(a) {
    const s = String(a || "");
    const m = s.match(/(\d{2})/);
    if (m) return `${m[1]}대`;
    return s || "20대";
  }
  const [visibleCount, setVisibleCount] = React.useState(0);
  const [summary, setSummary] = React.useState({ status: 'idle', lines: [] });
  const [hospitalName, setHospitalName] = React.useState('');
  const source = 'api';
  const [apiLoading, setApiLoading] = React.useState(false);
  const TOTAL = 10;
  const CONCURRENCY = 3;
  const [pending, setPending] = React.useState(TOTAL);
  const [done, setDone] = React.useState(0);
  const [failed, setFailed] = React.useState(0);
  const [avgLatency, setAvgLatency] = React.useState(0);
  const [toast, setToast] = React.useState(null);
  const genIdRef = React.useRef(0);
  const activeControllers = React.useRef(new Set());

  function dispatchProgress(doneCount, totalCount, avgMs) {
    try { window.dispatchEvent(new CustomEvent('progress_updated', { detail: { doneCount, totalCount, avgLatencyMs: Math.round(avgMs || 0) } })); } catch {}
  }
  function dispatchCreated(id, startedAt, finishedAt, latencyMs) {
    try { window.dispatchEvent(new CustomEvent('persona_created', { detail: { id, startedAt, finishedAt, latencyMs } })); } catch {}
  }
  function dispatchFailed(id, errorCode, retryCount) {
    try { window.dispatchEvent(new CustomEvent('persona_failed', { detail: { id, errorCode, retryCount } })); } catch {}
  }

  async function fetchOnePersona(idx, retry = 0) {
    const startedAt = Date.now();
    const API_BASE = (import.meta.env.VITE_API_BASE && String(import.meta.env.VITE_API_BASE)) ||
      (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost' ? 'http://localhost:8790' : '/api');
    const controller = new AbortController();
    activeControllers.current.add(controller);
    let softTimer = null;
    const clearTimers = () => { if (softTimer) clearTimeout(softTimer); };
    try {
      softTimer = setTimeout(() => {
        setToast('응답이 지연되고 있어 자동 재시도합니다.');
        try { controller.abort(); } catch {}
      }, 10000);
      let form = null;
      try { form = JSON.parse(localStorage.getItem('hospitalForm') || 'null'); } catch {}
      const r = await fetch(`${API_BASE}/generate/persona`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form, index: idx }),
        signal: controller.signal
      });
      clearTimers();
      activeControllers.current.delete(controller);
      if (!r.ok) throw new Error(`upstream:${r.status}`);
      const finishedAt = Date.now();
      const latencyMs = finishedAt - startedAt;
      const payload = await r.json();
      const p = payload?.persona;
      if (!p) throw new Error('empty_persona');
      const view = {
        id: idx + 1,
        name: normalizeName(p.name, idx),
        gender: toKoGender(p.gender || p.gender_focus),
        ageRange: toKoAge(p.age_range || '20대'),
        interests: p.interests || [],
        purposes: [],
        budget: 120,
        questions: (p.questions || []).slice(0,3).map((q) => ({ text: typeof q === 'string' ? q : (q.text || String(q)) }))
      };
      dispatchCreated(view.id, startedAt, finishedAt, latencyMs);
      return { ok: true, view, latencyMs };
    } catch (e) {
      clearTimers();
      activeControllers.current.delete(controller);
      if (retry < 2) {
        return fetchOnePersona(idx, retry + 1);
      }
      dispatchFailed(idx + 1, String(e?.message || e), retry);
      return { ok: false, error: e };
    }
  }

  const startStreaming = React.useCallback(() => {
    const myGen = ++genIdRef.current;
    setItems([]);
    setPending(TOTAL);
    setDone(0);
    setFailed(0);
    setAvgLatency(0);
    setToast(null);
    const latencies = [];
    let nextIndex = 0;
    let running = 0;
    let cancelled = false;
    const maybeUpdate = () => {
      const doneCount = latencies.length + failed;
      const avg = latencies.length ? (latencies.reduce((a,b)=>a+b,0) / latencies.length) : 0;
      setAvgLatency(avg);
      dispatchProgress(doneCount, TOTAL, avg);
    };
    const launch = () => {
      if (cancelled) return;
      while (running < CONCURRENCY && nextIndex < TOTAL) {
        const idx = nextIndex++;
        running++;
        fetchOnePersona(idx).then((res) => {
          if (genIdRef.current !== myGen) return;
          running--;
          setPending((n) => n - 1);
          if (res.ok) {
            setItems((arr) => [...arr, res.view]);
            setDone((d) => d + 1);
            latencies.push(res.latencyMs);
          } else {
            setFailed((f) => f + 1);
            setItems((arr) => [...arr, { id: idx + 1, name: '생성 실패', gender: '', ageRange: '', interests: [], purposes: [], budget: 0, questions: [], failed: true }]);
          }
          maybeUpdate();
          launch();
        });
      }
    };
    launch();
    return () => { cancelled = true; };
  }, [failed]);

  const cancelAll = () => {
    activeControllers.current.forEach((c) => { try { c.abort(); } catch {} });
    activeControllers.current.clear();
  };
  const restartAll = () => {
    cancelAll();
    if (summary.status === 'error') {
      // Retry overview as well when it previously failed
      try { fetchOverview(); } catch {}
    }
    startStreaming();
  };
  // Prevent duplicate API calls (React StrictMode, multi triggers)
  const bootOnceRef = React.useRef(false);
  const busyRef = React.useRef(false);
  // Animate only when list length grows (prevent full-page flash on save)
  const prevLenRef = React.useRef(0);
  React.useEffect(() => {
    const total = items.length;
    const prev = prevLenRef.current;
    if (total <= 0) { setVisibleCount(0); return; }
    if (total > prev) {
      const stepMs = Math.floor(3000 / (total || 1));
      let i = prev;
      const timer = setInterval(() => {
        i += 1;
        setVisibleCount((n) => Math.min(total, Math.max(n, i)));
        if (i >= total) clearInterval(timer);
      }, Math.max(120, stepMs));
      return () => clearInterval(timer);
    }
    // length unchanged: keep current visibleCount
    setVisibleCount((n) => n || total);
  }, [items.length]);
  React.useEffect(() => { prevLenRef.current = items.length; }, [items.length]);
  const fetchOverview = React.useCallback(() => {
    let form = null;
    try { form = JSON.parse(localStorage.getItem('hospitalForm') || 'null'); } catch {}
    const url = form?.website;
    if (form?.hospitalName) setHospitalName(form.hospitalName);
    if (!url) { setSummary({ status: 'error', lines: ['병원 URL이 없어 요약할 수 없습니다.'] }); return; }
    const API_BASE = (import.meta.env.VITE_API_BASE && String(import.meta.env.VITE_API_BASE)) ||
      (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost' ? 'http://localhost:8790' : '/api');
    setSummary({ status: 'loading', lines: [] });
    fetch(`${API_BASE}/summarize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.lines)) setSummary({ status: 'done', lines: data.lines });
        else setSummary({ status: 'error', lines: ['요약을 불러오지 못했습니다.'] });
      })
      .catch(() => setSummary({ status: 'error', lines: ['요약을 불러오지 못했습니다.'] }));
  }, []);

  React.useEffect(() => {
    if (bootOnceRef.current) return; // run once on first mount
    bootOnceRef.current = true;
    // Start streaming generation immediately
    startStreaming();
    // Fetch overview
    fetchOverview();
  }, [startStreaming, fetchOverview]);
  // remove bulk regenerate; using streaming instead
  const applyChange = (index, next) => {
    setItems((arr) => arr.map((it, i) => i === index ? next : it));
  };
  const filtered = items; // stream: show immediately
  const toCSV = () => {
    const rows = [['name','gender','ageRange','interests','purposes','budget','question']];
    items.forEach((p) => (p.questions||[]).forEach((q) => {
      rows.push([p.name,p.gender,p.ageRange,(p.interests||[]).join('|'),(p.purposes||[]).join('|'),p.budget,q.text]);
    }));
    return rows.map(r => r.map(v => '"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n');
  };
  const download = (content, name, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
  };
  const exportJSON = () => download(JSON.stringify(items, null, 2), 'profiles.json', 'application/json');
  const exportCSV = () => download(toCSV(), 'profiles.csv', 'text/csv');
  
  return (
    <div className="container results-container">
      <div className="summary-card">
        <div className="summary-title2">{hospitalName ? `${hospitalName} AI Over view` : 'AI Over view'}</div>
        <div className="summary-title">AI 병원 요약 정보</div>
        <div className="summary-note muted small">
          {done}/{TOTAL} 생성됨 · 평균 {Math.round(avgLatency)}ms {done < TOTAL ? <>· ETA ~ {Math.max(0, Math.round((TOTAL - done) * (avgLatency || 1000) / CONCURRENCY / 1000))}s</> : null}
        </div>
        {summary.status === 'loading' ? (
          <div className="summary-loading"><span className="spinner" /> 요약 중</div>
        ) : (
          <>
            <ul className="summary-list">
              {summary.lines.map((l, i) => (<li key={i}>{l}</li>))}
            </ul>
            <div className="summary-note muted small">This overview is generated from your website content.</div>
          </>
        )}
      </div>
      {items.length === 0 && (
        <div className="persona-loading" aria-live="polite">
          <span className="spinner" /> Generating profiles...
        </div>
      )}
      <div className="grid">
        {filtered.map((p, idx) => (
          p.failed
            ? (
              <div key={`failed-${p.id}`} className="persona-card">
                <div className="pc-head left">
                  <div className="pc-title">
                    <div className="inline-edit name-center">생성 실패</div>
                    <span className="badge">실패</span>
                  </div>
                </div>
              </div>
            ) : (
              <MemoPersonaCard key={p.id} data={p} onChange={(next)=>applyChange(idx, next)} />
            )
        ))}
      </div>
      <div className="center-actions">
        {(summary.status === 'error' || failed > 0) && (
          <button className="btn btn-primary" onClick={restartAll}>재시작</button>
        )}
        <button className="btn btn-primary" onClick={()=>navigate('/persona')}>AI 검색 리포트 확인</button>
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
