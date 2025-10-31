import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8790;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || process.env.VITE_OPENAI_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_MODEL = process.env.OPENAI_MODEL || process.env.VITE_OPENAI_MODEL || 'gpt-4o-mini';

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});
// Alias for Vercel serverless path
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/generate', async (req, res) => {
  try {
    const tStart = Date.now();
    if (!OPENAI_API_KEY) return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });

    const form = req.body?.form || {};
    const webSummary = req.body?.webSummary || {};

    const system = `You are the assistant for the hospital SEO service "YukiHaru AI".
Inputs you may receive:
1) formData (user-provided hospital info) — ALWAYS PRESENT
2) webSummary (summary from the hospital website) — OPTIONAL

Task: Produce exactly 10 personas that best reflect the clinic's real services and target users.
For EACH persona, produce exactly 3 natural search-style questions.

If webSummary is missing or empty, rely on formData only. Do not fail.

Output format (JSON ONLY, no markdown, no comments):
{ "personas": [ { "name":"...", "age_range":"20대", "gender":"여성|남성", "interests":["..."], "goal":"...", "questions":["q1","q2","q3"] } ] }

Rules:
- Use webSummary when available; otherwise use formData only.
- Center around formData.serviceKeywords; keep questions/personas naturally related to those keywords.
- Exclude unrelated procedures; write all text in Korean.
- Do NOT include a location field.
- Exactly 10 personas; each has exactly 3 questions (total 30 questions).
- Return pure JSON only.`;

    const body = {
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `formData: ${JSON.stringify(form)}\nwebSummary: ${JSON.stringify(webSummary)}` }
      ],
      temperature: 0.4,
      response_format: { type: 'json_object' }
    };

    function laxParseJSON(str) {
      if (!str) return null;
      try { return JSON.parse(str); } catch {}
      try {
        let s = String(str);
        s = s.replace(/```json|```/gi, '').trim();
        // Normalize quotes and trailing commas
        s = s.replace(/[\u2018\u2019\u201C\u201D]/g, '"');
        s = s.replace(/,\s*([}\]])/g, '$1');
        const start = s.indexOf('{');
        const end = s.lastIndexOf('}');
        if (start >= 0 && end > start) {
          const core = s.slice(start, end + 1);
          return JSON.parse(core);
        }
      } catch {}
      return null;
    }

    async function callUpstream() {
      const limit = Number(process.env.GENERATE_TIMEOUT_MS || 60000);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), limit);
      const resp = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...body, max_tokens: 900 }),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!resp.ok) {
        const t = await resp.text().catch(() => '');
        throw new Error(`upstream_error:${t}`);
      }
      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content || '{}';
      if (process.env.DEBUG_GEN) {
        try { console.log('[upstream content]', String(content).slice(0, 200)); } catch {}
      }
      const clean = String(content).replace(/```json|```/g, '').trim();
      const parsed = laxParseJSON(clean);
      return parsed || { personas: [], questions: [] };
    }

    // One strict retry to coerce valid JSON when upstream returned empty
    async function strictRetry() {
      const prompt = `JSON ONLY. Return exactly {"personas":[{name,age_range,gender,interests,goal,questions} x10]}.
Each persona:
- name: Korean
- age_range: one of 10대/20대/30대/40대/50대/60대/70대 이상
- gender: 여성 or 남성
- interests: array of Korean keywords from formData.serviceKeywords/webSummary
- goal: short Korean sentence
- questions: EXACTLY 3 Korean strings (natural search questions)
No markdown, no comments, no extra fields, no location.`;
      const body2 = {
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: `formData: ${JSON.stringify(form)}\nwebSummary: ${JSON.stringify(webSummary)}` }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      };
      const resp = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body2, max_tokens: 900 })
      });
      if (!resp.ok) return { personas: [], questions: [] };
      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content || '{}';
      if (process.env.DEBUG_GEN) {
        try { console.log('[retry content]', String(content).slice(0, 200)); } catch {}
      }
      const clean = String(content).replace(/```json|```/g, '').trim();
      const parsed = laxParseJSON(clean);
      return parsed || { personas: [], questions: [] };
    }

    // Strict normalize only when personas exist (no fabrication)
    async function enforceShape(current) {
      if (!Array.isArray(current.personas) || current.personas.length === 0) return current;
      // Sanitize questions: ensure array of strings, max 3
      current.personas = current.personas.map((p) => {
        const qs = Array.isArray(p?.questions) ? p.questions : [];
        const norm = qs.map((q) => typeof q === 'string' ? q : (q?.text ?? String(q))).filter(Boolean).slice(0, 3);
        return { ...p, questions: norm };
      });
      const bad = current.personas.some((p) => !Array.isArray(p?.questions));
      if (!bad && current.personas.length === 10) return current;
      const prompt = 'Return JSON ONLY with exactly 10 personas; each persona has name, age_range, gender, interests (array), and questions (EXACTLY 3 strings). Keep original content; do not invent new topics.';
      const fix = {
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: JSON.stringify(current).slice(0, 12000) }
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      };
      const resp = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fix, max_tokens: 900 })
      });
      if (!resp.ok) return current;
      try {
        const data = await resp.json();
        return JSON.parse(data.choices?.[0]?.message?.content || '{}');
      } catch { return current; }
    }

    const tOpenAIStart = Date.now();
    let upstream = await callUpstream();
    if (!Array.isArray(upstream.personas) || upstream.personas.length === 0) {
      upstream = await strictRetry();
    }
    const final = await enforceShape(upstream);
    if (!Array.isArray(final.personas) || final.personas.length === 0) {
      console.warn('[generate] upstream_empty openaiMs=', Date.now() - tOpenAIStart, 'totalMs=', Date.now() - tStart);
      return res.status(502).json({ error: 'upstream_empty' });
    }
    // Timing and payload headers for diagnostics
    res.set('X-Timing-OpenAI-ms', String(Date.now() - tOpenAIStart));
    res.set('X-Timing-Total-ms', String(Date.now() - tStart));
    try {
      res.set('X-Payload-Form-Bytes', String(JSON.stringify(form).length));
      res.set('X-Payload-WebSummary-Bytes', String(JSON.stringify(webSummary).length));
    } catch {}
    return res.json(final);
  } catch (e) {
    if (e.name === 'AbortError') return res.status(504).json({ error: 'timeout' });
    console.error('[generate] error:', e?.message || e);
    return res.status(500).json({ error: 'server_error', detail: String(e?.message || e) });
  }
});

// Generate a single persona (stream-friendly endpoint)
app.post('/api/generate/persona', async (req, res) => {
  try {
    const tStart = Date.now();
    if (!OPENAI_API_KEY) return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });

    const form = req.body?.form || {};
    const webSummary = req.body?.webSummary || {};
    const index = Number.isFinite(req.body?.index) ? Number(req.body.index) : null;
    const hintGender = (req.body?.hintGender || '').trim(); // "여성" | "남성" | ''
    const hintAgeRange = (req.body?.hintAgeRange || '').trim(); // e.g., "20대"
    const clinicSummary = (req.body?.clinicSummary || '').trim();

    const system = `You are the assistant for the hospital SEO service "YukiHaru AI".
Return JSON ONLY, no markdown. Generate exactly ONE persona tailored from hints.

Output format (JSON ONLY):
{ "persona": { "name":"...", "age_range":"20대", "gender":"여성|남성", "interests":["..."], "goal":"...", "questions":["q1","q2","q3"] } }

Rules:
- Use webSummary when available; otherwise use formData only.
- Focus on formData.serviceKeywords; write all text in Korean.
- Do NOT include a location field.
- questions must be EXACTLY 3 Korean strings.
- If hintGender is given, gender MUST be that value exactly (여성 or 남성).
- If hintAgeRange is given, age_range MUST be that value exactly (one of 10대/20대/30대/40대/50대/60대/70대 이상).`;

    const body = {
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `formData: ${JSON.stringify(form)}\nwebSummary: ${JSON.stringify(webSummary)}${index !== null ? `\nindex:${index}` : ''}${hintGender ? `\nhintGender:${hintGender}` : ''}${hintAgeRange ? `\nhintAgeRange:${hintAgeRange}` : ''}${clinicSummary ? `\nclinicSummary:${clinicSummary}` : ''}` }
      ],
      temperature: 0.5,
      response_format: { type: 'json_object' }
    };

    function laxParseJSON(str) {
      if (!str) return null;
      try { return JSON.parse(str); } catch {}
      try {
        let s = String(str);
        s = s.replace(/```json|```/gi, '').trim();
        s = s.replace(/[\u2018\u2019\u201C\u201D]/g, '"').replace(/,\s*([}\]])/g, '$1');
        const start = s.indexOf('{'); const end = s.lastIndexOf('}');
        if (start >= 0 && end > start) return JSON.parse(s.slice(start, end + 1));
      } catch {}
      return null;
    }

    const limit = Number(process.env.GENERATE_TIMEOUT_MS || 60000);
    const controller = new AbortController();
    const tOpenAIStart = Date.now();
    const timer = setTimeout(() => controller.abort(), limit);
    const resp = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, max_tokens: 400 }),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      throw new Error(`upstream_error:${t}`);
    }
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    const parsed = laxParseJSON(String(content).replace(/```json|```/g, '').trim()) || {};
    const persona = parsed.persona || (Array.isArray(parsed.personas) ? parsed.personas[0] : null);
    if (!persona) {
      console.warn('[generate/persona] upstream_empty');
      return res.status(502).json({ error: 'upstream_empty' });
    }

    res.set('X-Timing-OpenAI-ms', String(Date.now() - tOpenAIStart));
    res.set('X-Timing-Total-ms', String(Date.now() - tStart));
    try {
      res.set('X-Payload-Form-Bytes', String(JSON.stringify(form).length));
      res.set('X-Payload-WebSummary-Bytes', String(JSON.stringify(webSummary).length));
    } catch {}
    return res.json({ persona });
  } catch (e) {
    if (e.name === 'AbortError') return res.status(504).json({ error: 'timeout' });
    console.error('[generate/persona] error:', e?.message || e);
    return res.status(500).json({ error: 'server_error', detail: String(e?.message || e) });
  }
});

async function summarizeUrl(target) {
  if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');
  const url = target.startsWith('http') ? target : `https://${target}`;
  let html = '';
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'YukiHaruBot/1.0 (+http://localhost)' }, redirect: 'follow' });
    html = await r.text();
  } catch {}
  const text = (html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 6000);

  const prompt = 'Return JSON ONLY as {"lines":["..."]} with 3-5 short Korean lines describing key services, target audience, keywords, and tone. Each line <= 80 Korean characters.';
  const body = {
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: `URL: ${url}\nTEXT: ${text}` }
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' }
  };
  const resp = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const err = await resp.text().catch(() => '');
    throw new Error(`upstream_error:${err}`);
  }
  const data = await resp.json();
  try {
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    const lines = Array.isArray(parsed?.lines) ? parsed.lines : [];
    return { lines: lines.length ? lines : ['요약을 불러오지 못했습니다.'] };
  } catch {
    return { lines: ['요약을 불러오지 못했습니다.'] };
  }
}

app.post('/api/summarize', async (req, res) => {
  try {
    const url = req.body?.url;
    if (!url) return res.status(400).json({ error: 'missing_url' });
    const t0 = Date.now();
    const result = await summarizeUrl(url);
    res.set('X-Timing-Total-ms', String(Date.now() - t0));
    return res.json(result);
  } catch (e) {
    const msg = String(e?.message || e);
    const status = msg.startsWith('upstream_error') ? 502 : 500;
    return res.status(status).json({ error: msg });
  }
});

// Generate 3 natural questions (exactly 1 with location) from form/persona context
app.post('/api/generate/questions', async (req, res) => {
  try {
    if (!OPENAI_API_KEY) return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });
    const bodyIn = req.body || {};
    const persona = bodyIn.persona || {};
    const services = Array.isArray(bodyIn.services) ? bodyIn.services : String(bodyIn.services || '').split(',').map(s=>s.trim()).filter(Boolean);
    const locationKeyword = String(bodyIn.locationKeyword || '').trim();
    const fallbackLocation = String(bodyIn.fallbackLocation || '').trim();
    const tone = String(bodyIn.tone || '실제 친근한 AI와 대화하듯');

    const system = '너는 병원을 찾는 실제 사람(고객)이다. 친근한 AI에게 병원 추천을 부탁하는 대화 중이며, 아래 규칙을 엄격히 지켜 "질문 문장"만 만든다. 과장/광고/의학적 단정 표현은 절대 금지. 출력은 JSON ONLY.';
    const rules = `입력
persona: ${persona.age_range || persona.ageRange || ''} / ${persona.gender || ''}
services: ${services.join(', ')}
locationKeyword: ${locationKeyword}
fallbackLocation: ${fallbackLocation}
tone: ${tone}
clinicSummary(선택): ${String(bodyIn.summary || bodyIn.clinicSummary || '').slice(0,200)}

목표
- 병원 입력 폼의 services를 근거로, 해당 페르소나가 실제 AI에게 "추천을 부탁하는 자연스러운 질문" 3개 생성

생성 규칙
1) 정확히 3문장 생성
2) 세 문장 모두에 services 중 1~2개를 자연스럽게 포함(정보/추천 요청 중심, 과장 금지)
3) 세 문장 중 정확히 1문장만 위치 포함(우선순위: locationKeyword → 없으면 fallbackLocation). 나머지 2문장은 위치 언급 금지
4) 추천/탐색 맥락 유지(좋은 곳/후기/예약/상담 접근성 등). 예: "괜찮은 곳 있을까?", "후기 좋은 데 추천해줘"
5) 연령대/성별 말투 반영(20~30대: 가볍고 친근 / 40~50대: 현실적·신뢰 / 60대+: 공손)
6) 길이: 각 25~65자, 최대 2문장(짧은 도입+질문 허용)
7) 중복/유사 문체 금지(문두/접속부/어미/어휘를 다양화: "혹시", "요즘", "괜찮을까", "알려줄래", "어디가 좋을지" 등 서로 다르게)
8) 사이트 콘텐츠는 쓰지 말고, services만 근거로 작성

출력 형식
- JSON ONLY: {"questions":["문장1","문장2","문장3"]}
- 마크다운/설명/주석/코드펜스 금지

Self-check: 길이(25~65자)·서비스 포함(각 문장 1개 이상)·위치 1문장만 포함·톤/중복 다양화. 하나라도 어기면 스스로 재작성 후 최종 JSON만 출력`;

    const prompt = {
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: rules }
      ],
      temperature: 0.5,
      response_format: { type: 'json_object' }
    };

    function laxParseJSON(str) {
      if (!str) return null;
      try { return JSON.parse(str); } catch {}
      try {
        let s = String(str);
        s = s.replace(/```json|```/gi, '').trim();
        s = s.replace(/[\u2018\u2019\u201C\u201D]/g, '"').replace(/,\s*([}\]])/g, '$1');
        const start = s.indexOf('{'); const end = s.lastIndexOf('}');
        if (start >= 0 && end > start) return JSON.parse(s.slice(start, end + 1));
      } catch {}
      return null;
    }

    const limit = Number(process.env.GENERATE_TIMEOUT_MS || 60000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), limit);
    const r = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...prompt, max_tokens: 350 }),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!r.ok) {
      const t = await r.text().catch(()=> '');
      return res.status(502).json({ error: 'upstream_error', detail: t });
    }
    const data = await r.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    let parsed = laxParseJSON(content) || {};
    let questions = Array.isArray(parsed.questions) ? parsed.questions.map(String) : [];

    function includesLocationOnce(qs) {
      const locWord = locationKeyword || fallbackLocation;
      if (!locWord) return true; // nothing to enforce
      const count = qs.reduce((n, q) => n + (String(q).includes(locWord) ? 1 : 0), 0);
      return count === 1;
    }
    function containsService(q) {
      return services.some(s => s && String(q).includes(s));
    }
    function basicValid(qs) {
      if (qs.length !== 3) return false;
      const lenOk = qs.every(q => {
        const L = String(q).trim().length;
        return L >= 25 && L <= 65;
      });
      const svcOk = qs.every(q => containsService(q));
      return lenOk && svcOk && includesLocationOnce(qs);
    }

    if (!basicValid(questions)) {
      // One strict retry to coerce format
      const fixU = {
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: rules + '\n\n방금 출력은 조건을 일부 위반했어. 길이/서비스 포함/위치 1문장만 포함/중복 최소화를 모두 만족하도록 JSON ONLY로 다시 생성해.' }
        ],
        temperature: 0.4,
        response_format: { type: 'json_object' }
      };
      const r2 = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fixU, max_tokens: 350 })
      });
      if (r2.ok) {
        try {
          const d2 = await r2.json();
          const c2 = d2.choices?.[0]?.message?.content || '{}';
          const p2 = laxParseJSON(c2) || {};
          const qs2 = Array.isArray(p2.questions) ? p2.questions.map(String) : [];
          if (basicValid(qs2)) questions = qs2;
        } catch {}
      }
    }

    // Minimal fallback patching if still invalid
    if (questions.length !== 3) {
      questions = (questions || []).slice(0,3);
      while (questions.length < 3) questions.push('상담 예약, 시술 전 확인할 점을 알려주실 수 있나요?');
    }
    // Ensure location exactly once when we have a location to enforce
    const locWord = locationKeyword || fallbackLocation || '';
    if (locWord) {
      // Count occurrences
      let hasIdx = questions.findIndex(q => String(q).includes(locWord));
      if (hasIdx === -1) {
        // inject into the first question
        const svc = services[0] || '상담';
        questions[0] = `${locWord} 쪽에서 ${svc} 잘하는 곳 추천받고 싶은데, 실제로 괜찮은 병원 있을까요?`;
      } else {
        // remove extra mentions if any
        questions = questions.map((q,i) => i===hasIdx ? q : q.replaceAll(locWord, '').trim());
      }
    }

    // Ensure every question includes at least one service keyword
    if (services.length) {
      questions = questions.map((q) => (containsService(q) ? q : `${services[0]} 관련해서 ${String(q).replaceAll('  ',' ').trim()}`));
    }
    // Trim overly long questions to <= 65 chars (best effort)
    questions = questions.map((q) => String(q).trim().slice(0, 65));

    return res.json({ questions });
  } catch (e) {
    const msg = String(e?.message || e);
    return res.status(500).json({ error: 'server_error', detail: msg });
  }
});

app.get('/api/summarize', async (req, res) => {
  try {
    const url = String(req.query.url || '');
    if (!url) return res.status(400).json({ error: 'missing_url' });
    const t0 = Date.now();
    const result = await summarizeUrl(url);
    res.set('X-Timing-Total-ms', String(Date.now() - t0));
    return res.json(result);
  } catch (e) {
    const msg = String(e?.message || e);
    const status = msg.startsWith('upstream_error') ? 502 : 500;
    return res.status(status).json({ error: msg });
  }
});

// Only start a local server when not running on Vercel/serverless
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

export default app;
