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

    // Enforce hints strictly if provided
    if (hintGender && typeof persona === 'object') {
      persona.gender = hintGender;
    }
    if (hintAgeRange && typeof persona === 'object') {
      persona.age_range = hintAgeRange;
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

    const system = '너는 병원을 찾는 실제 고객이다. 친근한 AI에게 병원 추천을 받고 싶어서 묻는 상황이다. 너무 자유롭게 말하지 말고, 자연스럽지만 문법적으로 매끄럽고 의미가 명확한 질문만 만든다. 출력은 JSON ONLY.';
    const rules = `입력
persona: ${persona.age_range || persona.ageRange || ''} / ${persona.gender || ''}
services: ${services.join(', ')}
locationKeyword: ${locationKeyword}
fallbackLocation: ${fallbackLocation}
clinicIntro(선택): ${clinicIntro}
tone: ${tone}

목표
- 폼의 서비스/위치/연령·성별/(선택)한줄 소개를 참고하여, 실제 사용자가 AI에게 병원 추천을 부탁하는 질문 3개 생성

생성 규칙
1) 총 3개의 질문 생성
2) 모든 질문에 services 중 1~2개 반드시 포함
3) 세 질문 중 정확히 1개만 위치 포함(우선순위: locationKeyword → 없으면 fallbackLocation). 나머지 2개는 위치 언급 금지
4) 각 질문은 "추천을 부탁하거나 좋은 병원을 묻는 톤"으로 끝난다 (예: "추천해줘", "알려줄래?", "어디가 괜찮을까?", "있을까?")
5) 문장 길이 35~60자 (최대 2문장; 짧은 도입+질문 허용)
7) 과도한 부사·감탄·중복 구조 금지(같은 접두어나 수식어 반복 X)
8) 세 질문의 목적을 서로 다르게(위치 기반/후기/조건/신뢰/장비/케어 등) — 참고만, 장황한 설명 금지
9) clinicIntro가 있으면 분위기·핵심 키워드를 문체/포커스에 살짝 반영(과장 금지)

출력 형식
- JSON ONLY: {"questions":["문장1","문장2","문장3"]}
- 마크다운/설명/주석/코드펜스 금지

Self-check: 길이(35~60)·서비스 포함(각 문장 ≥1)·정확히 1개만 위치 포함·추천 톤 어미 준수. 미충족 시 자체 재작성 후 JSON만 출력`;

    const prompt = {
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: rules }
      ],
      temperature: 0.75,
      presence_penalty: 0.6,
      frequency_penalty: 0.3,
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
    function hasRecLexicon(q) {
      const s = String(q).trim();
      const pats = [
        /추천(해|해줘| 부탁| 가능|받)/,
        /(알려줄래|알려줘|알려주.*수)/,
        /어디(?:가|서).*(괜찮|좋|나을)/,
        /후기.*좋/,
        /괜찮은?\s*곳/,
        /있(?:을까|나요|을지)/
      ];
      return pats.some(r => r.test(s));
    }
    function violatesFAQ(q) {
      const s = String(q).trim();
      // 허용: 추천 맥락에서의 비용/가격/보험 문의
      const allowRec = /(추천|알려|어디|있(?:을까|나요)|후기.*좋|괜찮|좋은\s*곳)/;
      if (/(보험|비용|가격)/.test(s) && allowRec.test(s)) return false;
      // 금지: 전형적인 FAQ 어투
      const faq = /(얼마나\s*걸리|어떻게\s*진행|부작용|안전(?:한가요)?)/;
      return faq.test(s);
    }
    function endsWithRec(q) {
      const s = String(q).trim();
      return /\?$/.test(s) || ['추천해줘','알려줄래?','알려줘','어디가 괜찮을까?','있을까?'].some(k => s.endsWith(k));
    }
    function diverseStarts(qs) {
      const heads = qs.map(q => String(q).slice(0, 2));
      return !(heads[0] === heads[1] && heads[1] === heads[2]);
    }
    function diverseEndings(qs) {
      const tails = qs.map(q => String(q).slice(-2));
      return !(tails[0] === tails[1] && tails[1] === tails[2]);
    }
    function basicValid(qs) {
      if (qs.length !== 3) return false;
      const lenOk = qs.every(q => {
        const L = String(q).trim().length;
        return L >= 35 && L <= 60;
      });
      const svcOk = qs.every(q => containsService(q));
      const toneOk = qs.some(hasRecLexicon) && qs.every(q => !violatesFAQ(q) && endsWithRec(q));
      return lenOk && svcOk && includesLocationOnce(qs) && toneOk;
    }

    // Deterministic synthesis as a last resort to guarantee tone/length/diversity
    function synthesizeQuestions() {
      const age = String(persona.age_range || persona.ageRange || '').replace(/\s+/g,'') || '30대';
      const gender = String(persona.gender || '').includes('남') ? '남성' : '여성';
      const svcList = services.length ? services : ['상담'];
      const pickSvc = () => svcList[Math.floor(Math.random()*svcList.length)] || '상담';
      const pickSvc2 = () => {
        const a = pickSvc();
        const b = pickSvc();
        return a===b ? a : `${a}·${b}`;
      };
      const polite = ['50대','60대','70대'].some(k => age.includes(k));
      // 고정된 문장 시작어는 사용하지 않고, 끝맺음만 톤에 맞게 분기
      const endAsk = polite
        ? [' 추천해 주실 수 있을까요?',' 어디가 좋을까요?',' 알려주실 수 있을까요?']
        : [' 추천해줄래?',' 어디가 괜찮아?',' 알려줘!'];
      const flair = ['자연스럽게','부담 적게','티 나지 않게','무난하게','깔끔하게'];
      const locWord = locationKeyword || fallbackLocation || '';
      const lineWithLoc = () => {
        const s = pickSvc();
        const f = flair[Math.floor(Math.random()*flair.length)];
        const e = endAsk[Math.floor(Math.random()*endAsk.length)];
        const base = `${locWord} 근처에서 ${s} ${f} 해주는 병원${e}`;
        return base.length < 35 ? `${base.replace('?','')} 후기 괜찮은 곳이면 더 좋아.` : base;
      };
      const lineGeneral = () => {
        const s2 = pickSvc2();
        const f = flair[Math.floor(Math.random()*flair.length)];
        const e = endAsk[Math.floor(Math.random()*endAsk.length)];
        let txt = `${s2} ${f} 해주는 병원, 후기 좋은 곳${e}`;
        if (txt.length < 35) txt = `${s2} 잘하는 곳 중에서 후기 좋은 병원${e}`;
        return txt;
      };
      const qs = [lineWithLoc(), lineGeneral(), lineGeneral()]
        .map(s => s.replace(/\s+/g,' ').trim()).slice(0,3);
      // Ensure diversity starts
      const heads = qs.map(x => x.slice(0,2));
      if (heads[0] === heads[1]) qs[1] = `그리고 ${qs[1]}`;
      if (heads[0] === heads[2]) qs[2] = `또 ${qs[2]}`;
      return qs.map(s => s.slice(0,60));
    }

    if (!basicValid(questions)) {
      // One strict retry to coerce format
      const fixU = {
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: rules + '\n\n방금 출력은 조건을 일부 위반했어. FAQ 어조(얼마나/부작용/보험/비용/안전 등) 금지, 추천 톤(추천/괜찮/후기/어디가/상담/알려줘 등) 포함, 문두/어미 다양화까지 만족하도록 JSON ONLY로 다시 생성해.' }
        ],
        temperature: 0.65,
        presence_penalty: 0.6,
        frequency_penalty: 0.3,
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
    // Enforce recommendation tone and remove FAQ-ish wording as last resort
    questions = questions.map((q, i) => {
      let s = String(q);
      ['얼마나','얼마','기간','부작용','보험','안전','진행되','비용','가격'].forEach(b => { s = s.replaceAll(b, ''); });
      if (!hasRecLexicon(s)) {
        const recTail = i % 2 === 0 ? ' 추천해줄래?' : ' 어디가 좋을지 알려줄 수 있어?';
        const svc = services[0] || '';
        s = (svc ? `${svc} 관련해서 ` : '') + s.replace(/\s+/g,' ').trim();
        if (!/[?.!]$/.test(s)) s += recTail;
      }
      return s.trim();
    });
    // 문두를 강제로 주입하지 않고, 추천 톤/길이/서비스/위치 규칙만 보장
    // If still not valid tone/length/diversity, synthesize deterministically
    if (!basicValid(questions)) {
      questions = synthesizeQuestions();
    }
    // Final trim to <= 60 chars (best effort)
    questions = questions.map((q) => String(q).trim().slice(0, 60));

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
