import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function ReportLoading() {
  const navigate = useNavigate();
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState(null);

  const steps = [
    { key: 'ask', label: '생성된 페르소나가 AI에게 질문을 하고 있습니다.' },
    { key: 'compose', label: '취합된 답변을 활용하여 리포트를 생성중입니다.' },
  ];
  const currentStep = progress < 70 ? 0 : 1;

  React.useEffect(() => {
    let cancelled = false;
    let intv;
    const API_BASE = (import.meta.env.VITE_API_BASE && String(import.meta.env.VITE_API_BASE)) ||
      (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost' ? 'http://localhost:8790/api' : '/api');

    const run = async () => {
      setError(null);
      setProgress(0);
      // simple visual progress
      let p = 0; if (intv) clearInterval(intv);
      intv = setInterval(() => { p = Math.min(95, p + (p < 70 ? 2 : 1)); setProgress(p); }, 40);

      try {
        let personas = [];
        try { personas = JSON.parse(localStorage.getItem('yh_results_items') || '[]'); } catch {}
        const slim = personas.map(p => ({ id: p.id, name: p.name, ageRange: p.ageRange, gender: p.gender, budget: p.budget, purposes: p.purposes, questions: (p.questions||[]).map(q=> (typeof q === 'string' ? q : q.text)) }));
        if (!Array.isArray(slim) || slim.length === 0) {
          setError('페르소나가 없습니다. 결과 페이지에서 먼저 생성해 주세요.');
          return;
        }
        const r = await fetch(`${API_BASE}/report/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ personas: slim }) });
        if (!r.ok) throw new Error(`upstream:${r.status}`);
        const data = await r.json();
        if (cancelled) return;
        try { localStorage.setItem('yh_report', JSON.stringify(data)); } catch {}
        setProgress(100);
        setTimeout(() => navigate('/report'), 400);
      } catch (e) {
        if (cancelled) return;
        setError('리포트 생성 중 오류가 발생했습니다. 다시 시도해 주세요.');
        if (intv) { clearInterval(intv); intv = null; }
      }
    };

    run();
    return () => { cancelled = true; if (intv) clearInterval(intv); };
  }, [navigate]);

  return (
    <div className="loading-wrap center">
      <div className="report-loading-card" role="status" aria-live="polite">
        <h2 className="rl-title">AI 검색 리포트 생성중</h2>
        <ul className="rl-steps">
          {steps.map((s, i) => (
            <li key={s.key} className={i < currentStep ? 'done' : (i === currentStep ? 'active' : '')}>
              <span className="dot" /> {s.label}
            </li>
          ))}
        </ul>
        <div className="rl-progress">
          <div className="bar" style={{ width: `${progress}%` }} />
          <div className="pct">{progress}%</div>
        </div>
        {error ? (
          <div className="rl-hint" style={{ marginTop: 10 }}>
            <div className="error" role="alert">{error}</div>
            <div style={{ marginTop: 8 }}>
              <button className="primary-btn" onClick={() => window.location.reload()}>재시도</button>
              <button className="secondary-btn" style={{ marginLeft: 8 }} onClick={() => navigate('/results')}>결과로 돌아가기</button>
            </div>
          </div>
        ) : (
          <div className="rl-hint muted small">잠시만 기다려주세요. 완료되면 리포트 화면으로 이동합니다.</div>
        )}
      </div>
    </div>
  );
}
