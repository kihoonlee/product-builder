'use strict';

// ─────────────────────────────────────────
// State
// ─────────────────────────────────────────
let currentFile = null;
let apiKey = localStorage.getItem('gemini_api_key') || '';

// ─────────────────────────────────────────
// Init
// ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initApiKey();
  initFileUpload();
  initSolver();
  initTabs();
  initFaq();
  initNav();
});

// ─────────────────────────────────────────
// API Key Management
// ─────────────────────────────────────────
function initApiKey() {
  if (apiKey) {
    showSolverForm();
  } else {
    showApiKeyCard();
  }

  document.getElementById('api-key-save').addEventListener('click', saveApiKey);
  document.getElementById('api-key-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveApiKey();
  });
  const changeBtn = document.getElementById('api-key-change');
  if (changeBtn) changeBtn.addEventListener('click', showApiKeyCard);
}

function saveApiKey() {
  const input = document.getElementById('api-key-input');
  const key = input.value.trim();
  if (!key) {
    input.focus();
    return;
  }
  apiKey = key;
  localStorage.setItem('gemini_api_key', key);
  input.value = '';
  showSolverForm();
}

function showApiKeyCard() {
  document.getElementById('api-key-card').classList.remove('hidden');
  document.getElementById('solver-card').classList.add('hidden');
}

function showSolverForm() {
  document.getElementById('api-key-card').classList.add('hidden');
  document.getElementById('solver-card').classList.remove('hidden');
}

// ─────────────────────────────────────────
// File Upload
// ─────────────────────────────────────────
function initFileUpload() {
  const uploadArea = document.getElementById('upload-area');
  const fileInput = document.getElementById('file-input');

  uploadArea.addEventListener('click', () => fileInput.click());
  uploadArea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });

  // Drag and drop
  uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
  uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  });

  document.getElementById('clear-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    clearFile();
  });
}

function handleFile(file) {
  const VALID_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  if (!VALID_TYPES.includes(file.type)) {
    alert('JPEG, PNG, WebP 형식의 이미지만 지원합니다.');
    return;
  }
  if (file.size > 7 * 1024 * 1024) {
    alert('이미지 파일은 7MB 이하여야 합니다.');
    return;
  }

  if (currentFile) URL.revokeObjectURL(document.getElementById('preview-img').src);
  currentFile = file;

  const url = URL.createObjectURL(file);
  document.getElementById('preview-img').src = url;
  document.getElementById('upload-placeholder').classList.add('hidden');
  document.getElementById('preview-wrap').classList.remove('hidden');
  document.getElementById('solve-btn').disabled = false;

  // Reset result/error
  document.getElementById('result-box').classList.add('hidden');
  document.getElementById('error-box').classList.add('hidden');
}

function clearFile() {
  if (currentFile) {
    const img = document.getElementById('preview-img');
    URL.revokeObjectURL(img.src);
    img.src = '';
  }
  currentFile = null;
  document.getElementById('file-input').value = '';
  document.getElementById('preview-wrap').classList.add('hidden');
  document.getElementById('upload-placeholder').classList.remove('hidden');
  document.getElementById('solve-btn').disabled = true;
}

// ─────────────────────────────────────────
// Solver
// ─────────────────────────────────────────
function initSolver() {
  document.getElementById('solve-btn').addEventListener('click', solve);

  document.getElementById('solve-again').addEventListener('click', () => {
    document.getElementById('result-box').classList.add('hidden');
    clearFile();
  });

  document.getElementById('retry-btn').addEventListener('click', solve);
}

async function solve() {
  if (!currentFile) {
    alert('수학 문제 사진을 선택해주세요.');
    return;
  }
  if (!apiKey) {
    showApiKeyCard();
    return;
  }

  const grade = document.querySelector('input[name="grade"]:checked')?.value || '1';
  const solveBtn = document.getElementById('solve-btn');
  const btnText = document.getElementById('btn-text');
  const btnSpinner = document.getElementById('btn-spinner');

  solveBtn.disabled = true;
  btnText.textContent = '풀이 중…';
  btnSpinner.classList.remove('hidden');
  document.getElementById('result-box').classList.add('hidden');
  document.getElementById('error-box').classList.add('hidden');

  try {
    const base64 = await fileToBase64(currentFile);
    const solution = await callGeminiApi(base64, currentFile.type, grade);
    showResult(solution);
  } catch (err) {
    showError(err.message || '풀이 요청에 실패했습니다. 잠시 후 다시 시도해주세요.');
  } finally {
    solveBtn.disabled = !currentFile;
    btnText.textContent = '문제 풀기';
    btnSpinner.classList.add('hidden');
  }
}

async function callGeminiApi(imageBase64, mimeType, grade) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const body = {
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } },
        { text: buildPrompt(grade) },
      ],
    }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
  };

  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.');
  }

  if (!res.ok) {
    if (res.status === 400) throw new Error('API 키가 올바르지 않습니다. API 키를 다시 확인해주세요.');
    if (res.status === 429) throw new Error('요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
    if (res.status === 403) throw new Error('API 키 권한이 없습니다. Gemini API가 활성화된 키인지 확인해주세요.');
    throw new Error(`서버 오류가 발생했습니다 (${res.status}).`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  if (!text) throw new Error('풀이 결과를 받지 못했습니다. 다시 시도해주세요.');
  return text;
}

function buildPrompt(grade) {
  const gradeLabel = { '1': '1학년', '2': '2학년', '3': '3학년' }[grade] || '1학년';
  return `당신은 고등학교 ${gradeLabel} 수준에 맞춰 설명하는 수학 풀이 도우미입니다.

다음 규칙을 지킵니다.
1. 입력받은 수학 문제 이미지를 해당 학년(고등학교 ${gradeLabel})에 맞게 이해하기 쉽게 설명한다.
2. 수학 문제 풀이와 정답 이외의 내용은 답변하지 않는다.
3. 수학 문제 이미지에 풀이 과정을 작성한 흔적이 있다면, 그 흔적에 대해 (1) 어떤 부분을 놓치고 있는지, (2) 어떤 부분을 잘 하고 있는지 함께 설명한다.
4. 반드시 한국어로만 응답한다.
5. 주요 부분은 굵게 표시한다.
6. 풀이는 단계별로 번호를 매겨 설명한다.

위 규칙에 따라 이미지 속 수학 문제의 풀이와 정답(및 작성된 풀이에 대한 피드백)을 작성해 주세요.`;
}

function showResult(text) {
  const content = document.getElementById('result-content');
  content.innerHTML = typeof marked !== 'undefined' ? marked.parse(text) : escapeHtml(text).replace(/\n/g, '<br>');
  document.getElementById('result-box').classList.remove('hidden');
  document.getElementById('result-box').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showError(msg) {
  document.getElementById('error-msg').textContent = msg;
  document.getElementById('error-box').classList.remove('hidden');
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      if (base64) resolve(base64);
      else reject(new Error('이미지를 읽을 수 없습니다.'));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// ─────────────────────────────────────────
// Curriculum Tabs
// ─────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      document.getElementById(`tab-${tabId}`).classList.remove('hidden');
    });
  });
}

// ─────────────────────────────────────────
// FAQ Accordion
// ─────────────────────────────────────────
function initFaq() {
  document.querySelectorAll('.faq-q').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const isOpen = btn.getAttribute('aria-expanded') === 'true';

      // Close all
      document.querySelectorAll('.faq-q').forEach((b) => {
        b.setAttribute('aria-expanded', 'false');
        b.closest('.faq-item').classList.remove('open');
      });

      // Toggle this one
      if (!isOpen) {
        btn.setAttribute('aria-expanded', 'true');
        item.classList.add('open');
      }
    });
  });
}

// ─────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────
function initNav() {
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');
  const nav = document.getElementById('nav');

  if (!toggle || !links) return;

  toggle.addEventListener('click', () => {
    const isOpen = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-label', isOpen ? '메뉴 닫기' : '메뉴 열기');
  });

  // Close menu on nav link click
  links.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => {
      links.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });

  // Sticky nav shadow on scroll
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });
}
