import React from 'react';
import { useNavigate } from 'react-router-dom';

function useFocusTrap(containerRef) {
  React.useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const selector = [
      'a[href]', 'button:not([disabled])', 'textarea:not([disabled])',
      'input[type="text"]:not([disabled])', 'input[type="url"]:not([disabled])',
      'select:not([disabled])', '[tabindex]:not([tabindex="-1"])'
    ].join(',');
    const focusables = () => Array.from(node.querySelectorAll(selector));
    function onKeyDown(e) {
      if (e.key !== 'Tab') return;
      const els = focusables();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          last.focus();
          e.preventDefault();
        }
      } else if (document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    }
    node.addEventListener('keydown', onKeyDown);
    return () => node.removeEventListener('keydown', onKeyDown);
  }, [containerRef]);
}

export default function LoadingPage() {
  const navigate = useNavigate();
  const [error, setError] = React.useState(null);
  const [running, setRunning] = React.useState(true);
  const cardRef = React.useRef(null);
  const retryBtnRef = React.useRef(null);
  useFocusTrap(cardRef);

  const startedRef = React.useRef(false);
  const finishedRef = React.useRef(false);

  const start = React.useCallback(() => {
    if (startedRef.current || finishedRef.current) return;
    startedRef.current = true;
    setError(null);
    setRunning(true);
    let cancelled = false;

    // Load latest form data
    let form = null;
    try { form = JSON.parse(localStorage.getItem('hospitalForm') || 'null'); } catch {}

    // Pick API base: env → 8790 → 8787 (first that works)
    const envBase = import.meta.env.VITE_API_BASE && String(import.meta.env.VITE_API_BASE);
    const fallbackBase = (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost')
      ? 'http://localhost:8790' : '/api';
    const candidates = [envBase || fallbackBase];

    const tryPost = async (baseList) => {
      for (const base of baseList) {
        try {
          const controller = new AbortController();
          // Match server timeout (env or 60s) with a bit of headroom
          const timer = setTimeout(() => controller.abort(), 90000);
          // 1) Build overview first; when done, move to results immediately
          if (form?.website) {
            try {
              const rs = await fetch(`${base}/api/summarize`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: form.website }), signal: controller.signal
              });
              if (rs.ok) {
                const data = await rs.json();
                try { localStorage.setItem('yh_overview', JSON.stringify(data)); } catch {}
                // eslint-disable-next-line no-console
                console.log('[overview] stored');
              }
            } catch (_) {
              // ignore overview errors; still navigate to results
            } finally {
              clearTimeout(timer);
            }
            return { base, payload: { ok: true } };
          } else {
            // website가 없어도 결과 페이지로 진행(결과 페이지에서 생성 시도)
            clearTimeout(timer);
            return { base, payload: { ok: true } };
          }
        } catch (_) { /* try next */ }
      }
      throw new Error('all_failed');
    };

    tryPost(candidates)
      .then(({ payload }) => {
        if (cancelled) return;
        setRunning(false);
        finishedRef.current = true;
        // 개요가 준비되면 결과 페이지로 즉시 이동(페르소나는 결과 페이지에서 생성)
        navigate('/results');
      })
      .catch((e) => {
        if (cancelled) return;
        setRunning(false);
        // 개요 실패여도 결과 페이지에서 생성 시도하도록 이동
        navigate('/results');
        setError('error');
      });

    return () => { cancelled = true; };
  }, [navigate]);

  React.useEffect(() => {
    const cancel = start();
    return cancel;
  }, [start]);

  // Hard fallback: 8초가 지나도 완료 신호가 없으면 결과 페이지로 이동
  React.useEffect(() => {
    const t = setTimeout(() => {
      if (!finishedRef.current) {
        // eslint-disable-next-line no-console
        console.log('[loading] timed fallback -> /results');
        navigate('/results');
      }
    }, 8000);
    return () => clearTimeout(t);
  }, [navigate]);

  React.useEffect(() => {
    // focus the Retry button initially
    retryBtnRef.current?.focus();
  }, []);

  return (
    <div className="loading-wrap">
      <div className="loading-card" ref={cardRef} role="dialog" aria-modal="true" aria-labelledby="loading-title">
        <div className="loading-spinner" aria-hidden="true" />
        <h2 id="loading-title" className="loading-title">YukiHaru AI</h2>
        <div className="loading-status" aria-live="polite">
          <p className="loading-line">가상의 고객 프로필과 AI 검색 질문을 생성 중입니다.<span className="dots" aria-hidden>...</span></p>
          <p className="loading-line">仮想の顧客プロフィールとAI検索質問を生成しています.<span className="dots" aria-hidden>...</span></p>
        </div>
        <div className="loading-helper">최대 30초 정도 걸릴 수 있어요 · 最大30秒ほどかかる場合があります</div>

        <div className="progress" aria-hidden={running ? 'false' : 'true'}>
          <div className="bar" />
        </div>

        {error && (
          <div className="toast error" role="status">
            {error === 'timeout' ? '요청이 시간 초과되었습니다 (30초). 再試行してください。' : '오류가 발생했습니다。エラーが発生しました。'}
          </div>
        )}

        <div className="actions" style={{ justifyContent: 'flex-end' }}>
          <button ref={retryBtnRef} className="btn btn-primary" onClick={() => { start(); }} disabled={running}>
            다시 시도 / 再試行
          </button>
          <button className="btn btn-ghost" onClick={() => navigate('/')}>취소 / 中止</button>
        </div>
      </div>
    </div>
  );
}
