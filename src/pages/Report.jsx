import React from 'react';

export default function ReportPage() {
  const [data, setData] = React.useState(null);
  React.useEffect(() => {
    try { const d = JSON.parse(localStorage.getItem('yh_report') || 'null'); setData(d); } catch {}
  }, []);
  const ranking = Array.isArray(data?.ranking) ? data.ranking : [];
  return (
    <div className="container" style={{ maxWidth: 1100 }}>
      <div className="card" style={{ margin: '18px auto' }}>
        <h2 className="page-title">AI 검색 리포트</h2>
        {!data && <p className="muted">리포트 데이터가 없습니다. 다시 실행해 주세요.</p>}
        {data && (
          <>
            <h3 style={{ marginTop: 8, marginBottom: 6 }}>📊 질문 결과 랭킹</h3>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>순위</th>
                    <th>사이트명</th>
                    <th>도메인</th>
                    <th>노출</th>
                    <th>연관 키워드</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.slice(0,15).map((r, idx) => (
                    <tr key={r.domain}>
                      <td>{idx+1}</td>
                      <td>{r.name || '-'}</td>
                      <td><a href={r.sampleUrl} target="_blank" rel="noreferrer">{r.domain}</a></td>
                      <td>{r.count}</td>
                      <td>{(r.keywords||[]).slice(0,6).join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
