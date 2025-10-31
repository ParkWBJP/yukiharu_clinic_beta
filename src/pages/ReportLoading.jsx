import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function ReportLoading() {
  const navigate = useNavigate();
  const [progress, setProgress] = React.useState(0);
  const steps = [
    { key: 'ask', label: '생성된 페르소나가 AI에게 질문을 하고 있습니다.' },
    { key: 'compose', label: '취합된 답변을 활용하여 리포트를 생성중입니다.' },
  ];n+  const currentStep = progress < 70 ? 0 : 1;

  React.useEffect(() => {
    let p = 0;
    const intv = setInterval(() => {
      p = Math.min(100, p + (p < 70 ? 2 : 1));
      setProgress(p);
      if (p >= 100) {
        clearInterval(intv);
        setTimeout(() => navigate('/report'), 500); // 완료 후 리포트 화면으로 이동
      }
    }, 40);
    return () => clearInterval(intv);
  }, [navigate]);

  return (
    <div className="loading-wrap center">
      <div className="report-loading-card" role="status" aria-live="polite">
        <h2 className="rl-title">AI 검색 리포트 준비 중</h2>
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
        <div className="rl-hint muted small">잠시만 기다려 주세요. 완료되면 리포트 화면으로 이동합니다.</div>
      </div>
    </div>
  );
}

