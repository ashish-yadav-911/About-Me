const screen = document.getElementById('screen');

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

function print(text, cls = '') {
  const div = document.createElement('div');
  div.className = 'line ' + cls;
  div.textContent = text;
  screen.appendChild(div);
  screen.scrollTop = screen.scrollHeight;
  return div;
}

function prompt(cmd) {
  print('ashish@portfolio:~$ ' + cmd, 'prompt');
}

let vapi = null;
let config = null;
let callActive = false;
let ending = false;
let activeLine = null; // { el, span, name, role }

function clearActiveLine() {
  activeLine = null;
}

function updateTranscript(role, text, isFinal) {
  const label = role === 'assistant' ? 'Ashish' : 'You';
  const cls = role === 'assistant' ? 'assistant' : 'user';
  if (!activeLine) {
    const div = document.createElement('div');
    div.className = 'line ' + cls;
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = label + ': ';
    const span = document.createElement('span');
    span.className = 'transcript';
    span.textContent = text;
    div.appendChild(name);
    div.appendChild(span);
    screen.appendChild(div);
    screen.scrollTop = screen.scrollHeight;
    activeLine = { el: div, span, name, role };
  } else {
    // Overwrite in place, including when the speaker changes: the new turn
    // replaces the previous turn's line instead of printing a new one.
    activeLine.el.className = 'line ' + cls;
    activeLine.name.textContent = label + ': ';
    activeLine.span.textContent = text;
    activeLine.role = role;
    screen.scrollTop = screen.scrollHeight;
  }
  // Keep a single live slot; do not spawn new lines for finals.
}

async function init() {
  try {
    const r = await fetch('/api/config');
    config = await r.json();
  } catch (e) {
    config = { assistantId: null, publicKey: null };
  }

  try {
    const urlKey = new URLSearchParams(location.search).get('vapiPublicKey');
    const storedKey = localStorage.getItem('vapiPublicKey');
    const runtimeKey = urlKey || storedKey;
    if (runtimeKey) {
      config = { ...config, publicKey: runtimeKey };
      if (urlKey) localStorage.setItem('vapiPublicKey', urlKey);
    }
  } catch (e) {}

  prompt('whoami');
  await delay(260);
  print('Ashish Yadav', 'name');
  print('AI Engineer', 'title');
  await delay(180);

  prompt('cat about.txt');
  await delay(260);
  print('I design and ship AI agents, voice assistants, and LLM-powered products.');
  print('Talk to my voice assistant below to learn more about me.');
  await delay(180);

  prompt('ls projects/');
  await delay(200);
  print('voice-agent/   (interactive)');
  await delay(260);

  if (!config || !config.publicKey) {
    print('[setup] Voice assistant is not configured yet.', 'warn');
    print('[setup] Get a public key from dashboard.vapi.ai (API Keys),', 'warn');
    print('[setup] then set VAPI_PUBLIC_KEY in your Render environment.', 'warn');
    print('[setup] For local testing, open this page with ?vapiPublicKey=pk_...', 'muted');
  } else {
    print('[ready] Voice assistant is online. Press "Start voice chat" to begin.', 'ok');
  }

  renderControls();

  const tail = document.createElement('div');
  tail.className = 'line prompt';
  tail.textContent = 'ashish@portfolio:~$ ';
  const cursor = document.createElement('span');
  cursor.className = 'cursor';
  tail.appendChild(cursor);
  screen.appendChild(tail);
  screen.scrollTop = screen.scrollHeight;
}

function renderControls() {
  const wrap = document.createElement('div');
  wrap.className = 'controls';
  const startBtn = document.createElement('button');
  startBtn.textContent = 'Start voice chat';
  startBtn.className = 'btn';
  startBtn.addEventListener('click', startCall);
  const stopBtn = document.createElement('button');
  stopBtn.textContent = 'End call';
  stopBtn.className = 'btn danger';
  stopBtn.addEventListener('click', stopCall);
  wrap.appendChild(startBtn);
  wrap.appendChild(stopBtn);
  screen.appendChild(wrap);
}

async function ensureVapi() {
  if (vapi) return vapi;
  if (!config || !config.publicKey) {
    print('[error] Voice assistant is not configured.', 'err');
    return null;
  }
  try {
    print('[...] loading voice assistant...', 'muted');
    const mod = await import('https://cdn.jsdelivr.net/npm/@vapi-ai/web@latest/+esm');
    const Ctor = (mod && mod.default && mod.default.default) || (mod && mod.default && mod.default.Vapi) || (mod && mod.Vapi) || (mod && mod.default);
    if (typeof Ctor !== 'function') throw new Error('Voice SDK did not expose a constructor');
    vapi = new Ctor(config.publicKey);

    vapi.on('call-start', () => {
      print('[call] connected — you can start speaking.', 'ok');
      callActive = true;
    });
    vapi.on('call-end', () => {
      if (ending) print('[call] hanged up.', 'muted');
      else print('[call] call ended.', 'muted');
      callActive = false;
      ending = false;
      clearActiveLine();
    });
    vapi.on('message', (m) => {
      if (!m) return;
      if (m.type === 'transcript' && m.transcript) {
        updateTranscript(m.role, m.transcript, m.transcriptType === 'final');
      }
    });
    vapi.on('error', (e) => {
      if (ending || !callActive) return; // ignore errors during/after hangup
      const msg = e && e.message ? e.message : (typeof e === 'string' ? e : (e ? JSON.stringify(e) : 'unknown error'));
      print('[error] ' + msg, 'err');
    });
    return vapi;
  } catch (e) {
    print('[error] failed to load voice SDK: ' + (e && e.message ? e.message : e), 'err');
    return null;
  }
}

async function startCall() {
  if (callActive) {
    print('[info] a call is already active', 'muted');
    return;
  }
  ending = false;
  clearActiveLine();
  prompt('start voice chat');
  print('[...] requesting microphone access...', 'muted');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    print('[ok] microphone access granted', 'ok');
  } catch (e) {
    print('[error] microphone access denied: ' + (e && e.message ? e.message : e), 'err');
    return;
  }
  const v = await ensureVapi();
  if (!v) return;
  print('[...] connecting to voice assistant...', 'muted');
  try {
    await v.start(config.assistantId);
  } catch (e) {
    print('[error] ' + (e && e.message ? e.message : e), 'err');
  }
}

async function stopCall() {
  prompt('end call');
  if (vapi && callActive) {
    ending = true;
    try { vapi.stop(); } catch (e) {}
    print('[call] hanging up...', 'muted');
  } else {
    print('[info] no active call', 'muted');
  }
}

init();
