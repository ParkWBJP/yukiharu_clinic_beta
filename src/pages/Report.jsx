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
  return (
    <div className="container" style={{ maxWidth: 1100 }}>
      <div className="card" style={{ margin: '18px auto' }}>
        <h2 className="page-title">AI 검색 리포트</h2>
        {!data && <p className="muted">리포트 데이터를 불러오는 중입니다…</p>}
        {data && (
          <>
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
                  <div className="small" style={{ margin:'6px 0' }}>AI 요약: 키워드/이유 기반으로 상위에 노출됩니다.</div>
                  <div className="small muted">인식 지표</div>
                  <div className="table-wrap">
                    <table className="table">
                      <tbody>
                        <tr><td>시술 주제 인식도</td><td>높음</td></tr>
                        <tr><td>사용자 경험 데이터</td><td>중간~높음</td></tr>
                        <tr><td>문맥 명료도</td><td>중간</td></tr>
                        <tr><td>의미 연결성</td><td>중간</td></tr>
                        <tr><td>AI 접근 신호</td><td>중간</td></tr>
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

            {/* Trend Keywords */}
            <h3 style={{ marginTop: 16, marginBottom: 8 }}>경쟁 사이트 트렌드 키워드</h3>
            <div className="card">
              <div className="pill-wrap">
                {(trend.topKeywords||[]).map((t,idx)=> (<span key={idx} className="pill">{t.word} ({t.freq})</span>))}
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
                        <ul>
                          {(qrec.items||[]).map((it,ii)=> (
                            <li key={ii}>
                              <a href={it.url} target="_blank" rel="noreferrer">{it.name || it.url}</a>
                              <span className="small muted"> — {(it.keywords||[]).slice(0,5).join(', ')}</span>
                            </li>
                          ))}
                        </ul>
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
