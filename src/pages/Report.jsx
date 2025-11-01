import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function ReportPage() {
  const navigate = useNavigate();
  const [data, setData] = React.useState(null);

  React.useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem('yh_report') || 'null');
      if (!d) {
        navigate('/report-loading', { replace: true });
        return;
      }
      setData(d);
    } catch {
      navigate('/report-loading', { replace: true });
    }
  }, [navigate]);

  const ranking = Array.isArray(data?.ranking) ? data.ranking : [];
  const intents = Array.isArray(data?.intents) ? data.intents : [];
  const trend = data?.trend || { topKeywords: [] };
  const visibility = Array.isArray(data?.visibility) ? data.visibility : [];

  const [intentFilter, setIntentFilter] = React.useState('all');
  const domains = ranking;
  const top5 = ranking.slice(0,5);
  const personaList = Array.isArray(data?.personas) ? data.personas : [];
  const [detailIdx, setDetailIdx] = React.useState(-1);
  const [topAnalysis, setTopAnalysis] = React.useState([]);
  const [miniCards, setMiniCards] = React.useState([]);
  const [ovSummary, setOvSummary] = React.useState({ status: 'idle', lines: [] });
  const [hospitalName, setHospitalName] = React.useState('');

  React.useEffect(() => {
    if (!data) return;
    // fetch top analysis once
    const API_BASE = (import.meta.env.VITE_API_BASE && String(import.meta.env.VITE_API_BASE)) ||
      (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost' ? 'http://localhost:8790/api' : '/api');
    if (top5.length) {
      fetch(`${API_BASE}/report/analyze-top`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ domains: top5 }) })
        .then(r=>r.json()).then(j => { if (Array.isArray(j?.items)) setTopAnalysis(j.items); }).catch(()=>{});
    }
    // synthesize 3 mini-cards from cached/detailed overview lines
    try {
      const ov = JSON.parse(localStorage.getItem('yh_overview')||'null');
      const lines = Array.isArray(ov?.lines) ? ov.lines.join(' ') : '';
      const cards = [];
      if (/후기|리뷰/.test(lines)) cards.push({ icon:'💬', title:'후기 데이터 구조화', hint:'후기/사례를 Schema로 구조화하면 신뢰도 인식이 올라갑니다.' });
      if (/시술|수술|설명|가이드/.test(lines)) cards.push({ icon:'🧩', title:'시술 의미 구조 개선', hint:'시술명/개념을 자연어로 다양하게 표현하면 주제 인식이 향상됩니다.' });
      if (/보험|가격|청구/.test(lines)) cards.push({ icon:'💡', title:'보험/가격 문맥 명시', hint:'보험/가격 문구를 명시적으로 안내하면 탐색률이 높아집니다.' });
      setMiniCards(cards.slice(0,3));
    } catch {}
  }, [data]);

  // Load detailed overview (same as Results layout)
  React.useEffect(() => {
    try {
      let form = null; try { form = JSON.parse(localStorage.getItem('hospitalForm')||'null'); } catch {}
      if (form?.hospitalName) setHospitalName(form.hospitalName);
      const cached = JSON.parse(localStorage.getItem('yh_overview')||'null');
      if (cached && Array.isArray(cached.lines)) { setOvSummary({ status:'done', lines: cached.lines }); return; }
    } catch {}
    // fallback fetch if missing
    try {
      let form = null; try { form = JSON.parse(localStorage.getItem('hospitalForm')||'null'); } catch {}
      const url = form?.website; if (!url) { setOvSummary({ status:'error', lines: [] }); return; }
      setOvSummary({ status:'loading', lines: [] });
      const API_BASE = (import.meta.env.VITE_API_BASE && String(import.meta.env.VITE_API_BASE)) ||
        (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost' ? 'http://localhost:8790/api' : '/api');
      fetch(`${API_BASE}/summarize`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ url }) })
        .then(r=>r.json()).then(j=>{ if (Array.isArray(j?.lines)) setOvSummary({ status:'done', lines: j.lines }); else setOvSummary({ status:'error', lines: [] }); })
        .catch(()=> setOvSummary({ status:'error', lines: [] }));
    } catch { setOvSummary({ status:'error', lines: [] }); }
  }, []);
  return (
    <div className="container" style={{ maxWidth: 1100 }}>
      <div className="card" style={{ margin: '18px auto' }}>
        <h2 className="page-title">AI 검색 리포트</h2>
        {!data && <p className="muted">리포트 데이터를 불러오는 중입니다…</p>}
        {data && (
          <>
            {/* Overview (detailed, same layout as Results) */}
            <div className="overview-card" style={{ marginBottom: 12 }}>
              <div className="overview-header">
                <div className="overview-title">{hospitalName ? `${hospitalName} AI Overview` : 'AI Overview'}</div>
                <div className="overview-sub">AI Overview</div>
              </div>
              {ovSummary.status === 'loading' ? (
                <div className="summary-loading"><span className="spinner" /> 오버뷰 생성 중</div>
              ) : (
                <div className="overview-body">
                  {(ovSummary.lines||[]).map((raw, i) => {
                    const l = String(raw || '');
                    if (/^\s*$/.test(l)) return <div key={i} className="ov-divider" />;
                    if (l.startsWith('🧠') || l.startsWith('🔍') || l.startsWith('🚀')) return <div key={i} className="ov-section">{l}</div>;
                    if (l.startsWith('주요 키워드')) {
                      const tags = l.replace('주요 키워드 :','').trim().split(/\s+/).filter(t=>t.startsWith('#'));
                      return <div key={i} className="pill-wrap">{tags.map((t,idx)=>(<span className="pill" key={idx}>{t.replace(/^#/, '')}</span>))}</div>;
                    }
                    const m = l.match(/^([^:：]+)\s*[:：]\s*(.*)$/);
                    if (m) return (
                      <div key={i} className="row">
                        <div className="row-key">{m[1]}</div>
                        <div className="row-val">{m[2]}</div>
                      </div>
                    );
                    return <div key={i} className="ov-line">{l}</div>;
                  })}
                  <div className="summary-note muted small">This overview is generated from your website content.</div>
                </div>
              )}
            </div>
            <h3 style={{ marginTop: 8, marginBottom: 6 }}>질문 결과 랭킹</h3>
            <div className="toolbar" style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
              <label className="small muted">필터:</label>
              <select className="select-input" style={{ maxWidth:180 }} value={intentFilter} onChange={e=>setIntentFilter(e.target.value)}>
                <option value="all">전체</option>
                {intents.map(it => (<option key={it.label} value={it.label}>{it.label}</option>))}
              </select>
              <div className="toolbar-spacer" />
              {intents.length > 0 && (
                <div className="small muted">평균 링크 수: {intents.map(it=>`${it.label}:${it.avgLinks}`).join(' / ')}</div>
              )}
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>순위</th>
                    <th>사이트명</th>
                    <th>링크</th>
                    <th>노출 횟수</th>
                    <th>연관 키워드</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.slice(0, 15).map((r, idx) => (
                    <tr key={r.domain}>
                      <td>{idx + 1}</td>
                      <td>{r.name || '-'}</td>
                      <td>
                        <a href={r.sampleUrl} target="_blank" rel="noreferrer">
                          {r.domain}
                        </a>
                      </td>
                      <td>{r.count}</td>
                      <td>{(r.keywords || []).slice(0, 6).join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Top 5 Site Analysis */}
            <h3 style={{ marginTop: 16, marginBottom: 8 }}>상위 1~5위 사이트 분석</h3>
            <div className="grid">
              {top5.map((s)=> (
                <div key={s.domain} className="card">
                  <div style={{ fontWeight:700 }}>{s.name || s.domain} <span className="muted small">({s.domain})</span></div>
                  <div className="small" style={{ margin:'6px 0' }}>
                    {(() => {
                      const a = (topAnalysis||[]).find(x => x.domain === s.domain);
                      return a?.summary || 'AI 요약: 키워드/이유 기반으로 상위에 노출됩니다.';
                    })()}
                  </div>
                  <div className="small muted">인식 지표</div>
                  <div className="table-wrap">
                    <table className="table">
                      <tbody>
                        {(() => {
                          const a = (topAnalysis||[]).find(x => x.domain === s.domain);
                          const sc = a?.scores || {};
                          const rows = [
                            ['시술 주제 인식도', sc.topic],
                            ['사용자 경험 데이터', sc.ux],
                            ['문맥 명료도', sc.clarity],
                            ['의미 연결성', sc.connected],
                            ['AI 접근 신호', sc.signals]
                          ];
                          return rows.map(([k,v],i)=>(<tr key={i}><td>{k}</td><td>{typeof v==='number'? Math.round(v*100)+'%':'중간'}</td></tr>));
                        })()}
                      </tbody>
                    </table>
                  </div>
                  <a className="btn btn-ghost" href={s.sampleUrl} target="_blank" rel="noreferrer">샘플 링크 열기</a>
                </div>
              ))}
            </div>

            {/* Persona Detail */}
            <h3 style={{ marginTop: 16, marginBottom: 8 }}>페르소나별 결과 상세</h3>
            <div className="grid">
              {personaList.slice(0,10).map((p, i)=> (
                <div key={p.id||i} className="card">
                  <div style={{ fontWeight:700 }}>{p.name || `P${i+1}`}</div>
                  <div className="small muted">질문 {Array.isArray(p.questions)? p.questions.length:0}개</div>
                  <button className="btn btn-primary" style={{ marginTop:6 }} onClick={()=>setDetailIdx(i)}>자세히 보기</button>
                </div>
              ))}
            </div>

            {/* Overview Mini Cards */}
            <h3 style={{ marginTop: 16, marginBottom: 8 }}>AIO 개선 제안</h3>
            <div className="grid">
              {(miniCards.length? miniCards : [
                {icon:'🧩', title:'시술 의미 구조 개선', hint:'시술명/개념을 자연어로 다양하게 표현하면 주제 인식 향상'},
                {icon:'💬', title:'후기 데이터 구조화', hint:'후기/사례를 Schema로 구조화하여 신뢰도 강화'},
                {icon:'💡', title:'보험/가격 문맥 명시', hint:'보험/가격 문구를 명시적으로 안내하여 탐색률 증대'}
              ]).map((c,idx)=> (
                <div key={idx} className="card"><div style={{fontWeight:700}}>{c.icon} {c.title}</div><div className="small muted">{c.hint}</div></div>
              ))}
            </div>

            {/* Trend Keywords */}
            <h3 style={{ marginTop: 16, marginBottom: 8 }}>경쟁 사이트 트렌드 키워드</h3>
            <div className="card">
              <div className="pill-wrap" style={{ marginBottom:8 }}>
                {(trend.topKeywords||[]).slice(0,18).map((t,idx)=> (<span key={idx} className="pill">{t.word} ({t.freq})</span>))}
              </div>
              <div>
                {(trend.topKeywords||[]).slice(0,10).map((t,idx)=> (
                  <div key={idx} style={{ display:'grid', gridTemplateColumns:'140px 1fr', alignItems:'center', gap:8, margin:'4px 0' }}>
                    <div className="small muted">{t.word}</div>
                    <div style={{ background:'#f1f3f5', height:8, borderRadius:999 }}>
                      <div style={{ width:`${Math.min(100, t.freq*10)}%`, height:'100%', background:'#7ac143', borderRadius:999 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Visibility Map */}
            <h3 style={{ marginTop: 16, marginBottom: 8 }}>AI 시야</h3>
            <div className="card">
              {(visibility||[]).map((v,idx)=> (
                <div key={idx} style={{ display:'grid', gridTemplateColumns:'180px 1fr', alignItems:'center', gap:8, margin:'6px 0' }}>
                  <div className="small muted">{v.label}</div>
                  <div style={{ background:'#f1f3f5', height:10, borderRadius:999 }}>
                    <div style={{ width:`${Math.round((v.score||0)*100)}%`, height:'100%', background:'#7ac143', borderRadius:999 }} />
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div style={{ margin:'16px 0' }}>
              <button className="btn btn-primary">AIO 개선 요청하기</button>
            </div>
            {ranking.length === 0 && (
             <div className="muted" style={{ marginTop: 10 }}>
                수집된 링크가 없어 랭킹이 비어 있습니다. 다시 시도하시려면{' '}
                <button className="link-btn" onClick={() => navigate('/report-loading')}>리포트 재실행</button>
                을 눌러주세요.
              </div>
            )}
            {detailIdx >= 0 && (
              <div className="card" style={{ position:'fixed', inset:'10% 10% auto 10%', background:'#fff', zIndex:1000, maxHeight:'80%', overflow:'auto' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <h3 style={{ margin:0 }}>페르소나 상세</h3>
                  <button className="btn btn-ghost" onClick={()=>setDetailIdx(-1)}>닫기</button>
                </div>
                {personaList[detailIdx] && (
                  <div>
                    <div className="small muted" style={{ margin:'6px 0' }}>{personaList[detailIdx].name}</div>
                    {(personaList[detailIdx].questions||[]).map((qrec,qi)=> (
                      <div key={qi} style={{ margin:'10px 0' }}>
                        <div style={{ fontWeight:700 }}>Q{qi+1}. {qrec.q}</div>
                        {(Array.isArray(qrec.items) && qrec.items.length > 0) ? (
                          <ul>
                            {qrec.items.map((it,ii)=> (
                              <li key={ii}>
                                <a href={it.url} target="_blank" rel="noreferrer">{it.name || it.url}</a>
                                <span className="small muted"> — {(it.keywords||[]).slice(0,5).join(', ')}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="small muted">출처 부족: 이 질문에 대해 신뢰할 수 있는 URL을 찾지 못했습니다.</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
