import wubiData from 'wubi-code-data'
import HanziWriter from 'hanzi-writer'
const getWubi = ch => wubiData['取码'](ch, '86') || null

const HANZI_CDN = 'https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0'

function charDataLoader(char, onComplete, onError) {
  fetch(`${HANZI_CDN}/${encodeURIComponent(char)}.json`)
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json() })
    .then(onComplete)
    .catch(onError)
}

function makeStrokeChar(ch) {
  const el = document.createElement('div')
  el.className = 'dict-stroke-char'
  const writer = HanziWriter.create(el, ch, {
    width: 60, height: 60, padding: 4,
    showOutline: true,
    strokeColor: '#1a1a1a',
    outlineColor: '#ddd',
    radicalColor: '#c0392b',
    charDataLoader,
  })
  writer.animateCharacter()
  return el
}

// ── Dictionary (lazy-loaded on first use) ────────────────────────────────────
let dictData = null
let dictLoading = false
let dictCallbacks = []

async function loadDict() {
  if (dictData) return dictData
  if (dictLoading) return new Promise(r => dictCallbacks.push(r))
  dictLoading = true
  try {
    const base = import.meta.env.BASE_URL
    const res = await fetch(`${base}dict/cedict.json`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    dictData = await res.json()
    dictCallbacks.forEach(r => r(dictData))
    dictCallbacks = []
    return dictData
  } catch (e) {
    dictLoading = false          // allow retry on next click
    dictCallbacks.forEach(r => r(null))
    dictCallbacks = []
    throw e
  }
}

// Given a sentence and a clicked character index, find the longest dictionary
// match that contains that character (tries start positions from i back to i-3).
async function lookupAt(sentence, clickedIndex) {
  const dict = await loadDict()
  const chars = [...sentence]
  const maxLen = 4

  for (let start = Math.max(0, clickedIndex - (maxLen - 1)); start <= clickedIndex; start++) {
    for (let len = Math.min(maxLen, chars.length - start); len >= 1; len--) {
      if (start + len - 1 < clickedIndex) continue  // doesn't cover clicked char
      const word = chars.slice(start, start + len).join('')
      if (dict[word]) return { word, entries: dict[word] }
    }
  }
  return null
}

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  stories: [],       // loaded from index.json
  current: null,     // { meta, lines: string[] }
  lineIndex: 0,
  isComposing: false,
  isTransitioning: false,
}

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id)

const backBtn       = $('back-btn')
const storyListView = $('story-list-view')
const storyCards    = $('story-cards')
const practiceView  = $('practice-view')
const practiceArea  = $('practice-area')
const targetLine    = $('target-line')
const practiceInput = $('practice-input')
const feedbackMsg   = $('feedback-msg')
const progressBar   = $('progress-bar')
const lineCounter   = $('line-counter')
const completeView  = $('complete-view')
const restartBtn    = $('restart-btn')
const homeBtn       = $('home-btn')
const dictPanel     = $('dict-panel')

// ── Navigation ────────────────────────────────────────────────────────────────
function showView(name) {
  storyListView.classList.remove('active')
  practiceView.classList.remove('active')
  completeView.classList.remove('active')

  if (name === 'list') {
    storyListView.classList.add('active')
    backBtn.classList.remove('visible')
  } else if (name === 'practice') {
    practiceView.classList.add('active')
    backBtn.classList.add('visible')
  } else if (name === 'complete') {
    completeView.classList.add('active')
    backBtn.classList.add('visible')
  }
}

// ── Story list ────────────────────────────────────────────────────────────────
async function init() {
  const base = import.meta.env.BASE_URL
  try {
    const res = await fetch(`${base}stories/index.json`)
    state.stories = await res.json()
  } catch (e) {
    storyCards.innerHTML = '<p style="color:var(--wrong)">无法加载故事列表。请检查网络连接。</p>'
    return
  }

  renderStoryList()
  showView('list')
}

function renderStoryList() {
  storyCards.innerHTML = ''
  for (const meta of state.stories) {
    const card = document.createElement('div')
    card.className = 'story-card'
    card.tabIndex = 0
    card.setAttribute('role', 'button')
    card.setAttribute('aria-label', `${meta.title} — ${meta.titleEn}`)
    card.innerHTML = `
      <div class="story-card-icon">📖</div>
      <div class="story-card-body">
        <h2>${meta.title} · ${meta.titleEn}</h2>
        <p class="meta">
          <span class="level-badge">${meta.level}</span>
          ${escapeHtml(meta.description)}
        </p>
      </div>
    `
    card.addEventListener('click', () => startStory(meta))
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') startStory(meta)
    })
    storyCards.appendChild(card)
  }
}

// ── Story practice ────────────────────────────────────────────────────────────
async function startStory(meta) {
  const base = import.meta.env.BASE_URL
  let text
  try {
    const res = await fetch(`${base}stories/${meta.file}`)
    text = await res.text()
  } catch (e) {
    alert('无法加载故事。请检查网络连接。')
    return
  }

  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)

  state.current = { meta, lines }
  state.lineIndex = 0
  showView('practice')
  renderLine(0)
}

function renderLine(index) {
  const { lines } = state.current
  const line = lines[index]

  // Build target — one .char-wrapper per character, with a wubi label above
  targetLine.innerHTML = ''
  for (const ch of line) {
    const wrapper = document.createElement('span')
    wrapper.className = 'char-wrapper'

    const label = document.createElement('span')
    label.className = 'wubi-label'

    const charSpan = document.createElement('span')
    charSpan.className = 'char char-pending'
    charSpan.textContent = ch

    wrapper.appendChild(label)
    wrapper.appendChild(charSpan)
    wrapper.addEventListener('click', () => {
      // Toggle wubi code
      label.textContent = label.textContent ? '' : (getWubi(ch) ?? '')
      // Show dictionary entry for the clicked position
      const charIndex = [...state.current.lines[state.lineIndex]].indexOf(ch, 0)
      const clickedIndex = [...targetLine.querySelectorAll('.char-wrapper')].indexOf(wrapper)
      showDictEntry(state.current.lines[state.lineIndex], clickedIndex)
    })
    targetLine.appendChild(wrapper)
  }

  // Reset input, feedback, and dict panel
  practiceInput.value = ''
  practiceInput.placeholder = '在这里输入…'
  feedbackMsg.textContent = ''
  feedbackMsg.className = ''
  practiceArea.classList.remove('flash-correct', 'shake')
  dictPanel.hidden = true
  dictPanel.innerHTML = ''

  // Update progress
  const total = lines.length
  const pct = (index / total) * 100
  progressBar.style.width = `${pct}%`
  lineCounter.textContent = `${index + 1} / ${total}`

  // Sync input width to target width after paint
  requestAnimationFrame(() => {
    const w = targetLine.getBoundingClientRect().width
    if (w > 0) {
      practiceInput.style.width = `${w}px`
    }
    practiceInput.focus()
  })
}

// ── Input handling ────────────────────────────────────────────────────────────
practiceInput.addEventListener('compositionstart', () => {
  state.isComposing = true
})

practiceInput.addEventListener('compositionend', () => {
  state.isComposing = false
  checkInput()
})

practiceInput.addEventListener('input', () => {
  if (state.isComposing) return
  checkInput()
})

practiceInput.addEventListener('keydown', e => {
  // Allow Enter to retry after wrong answer shown
  if (e.key === 'Enter' && !state.isComposing) {
    e.preventDefault()
    if (feedbackMsg.classList.contains('wrong')) {
      // Clear and let them try again
      practiceInput.value = ''
      feedbackMsg.textContent = ''
      feedbackMsg.className = ''
      practiceArea.classList.remove('shake')
      resetCharColors()
    }
  }
})

// Chinese and ASCII punctuation that is optional when typing
const PUNCT = new Set('！？。，、；：\u201C\u201D\u2018\u2019（）【】…—·《》〈〉!?.,;:\'"()[]- ')

function isPunct(ch) {
  return PUNCT.has(ch)
}

// Map each character in target to a state ('correct'|'wrong'|'pending')
// by consuming typed characters, skipping punctuation in target.
// Punctuation is marked correct whether the user typed it or skipped it.
function buildCharMap(target, typed) {
  let typedIdx = 0
  const states = []
  let hasWrong = false

  for (const ch of target) {
    if (isPunct(ch)) {
      if (typedIdx < typed.length && typed[typedIdx] === ch) {
        typedIdx++ // user typed the punctuation — consume it
      }
      // always correct regardless
      states.push('correct')
    } else {
      if (typedIdx >= typed.length) {
        states.push('pending')
      } else if (typed[typedIdx] === ch) {
        states.push('correct')
        typedIdx++
      } else {
        states.push('wrong')
        hasWrong = true
        typedIdx++
      }
    }
  }

  // allDone: no pending positions left AND no extra unconsumed typed chars
  const allDone = !states.includes('pending') && typedIdx === typed.length
  return { states, hasWrong, allDone }
}

function checkInput() {
  if (!state.current) return
  if (state.isTransitioning) return
  const typed = practiceInput.value
  const target = state.current.lines[state.lineIndex]
  const spans = targetLine.querySelectorAll('.char')

  const { states, hasWrong, allDone } = buildCharMap(target, typed)

  states.forEach((state, i) => {
    const span = spans[i]
    span.classList.remove('char-pending', 'char-correct', 'char-wrong')
    span.classList.add(`char-${state}`)
  })

  if (allDone && !hasWrong) {
    onCorrect()
  } else if (allDone && hasWrong) {
    onWrong(target)
  }
}

function resetCharColors() {
  targetLine.querySelectorAll('.char').forEach(s => {
    s.classList.remove('char-correct', 'char-wrong')
    s.classList.add('char-pending')
  })
}

function onCorrect() {
  state.isTransitioning = true

  // Flash
  void practiceArea.offsetWidth // force reflow to restart animation
  practiceArea.classList.add('flash-correct')

  feedbackMsg.textContent = '正确！'
  feedbackMsg.className = 'correct'

  setTimeout(() => {
    state.isTransitioning = false
    state.lineIndex++
    if (state.lineIndex >= state.current.lines.length) {
      showComplete()
    } else {
      renderLine(state.lineIndex)
    }
  }, 600)
}

function onWrong(target) {
  state.isTransitioning = true

  void practiceArea.offsetWidth
  practiceArea.classList.add('shake')

  feedbackMsg.innerHTML = `不对。正确答案：<strong>${escapeHtml(target)}</strong><br><small>按 Enter 重试</small>`
  feedbackMsg.className = 'wrong'

  setTimeout(() => {
    state.isTransitioning = false
  }, 400)
}

// ── Dictionary panel ──────────────────────────────────────────────────────────
async function showDictEntry(sentence, clickedIndex) {
  dictPanel.hidden = false
  dictPanel.innerHTML = '<span class="dict-loading">…</span>'

  try {
    const result = await lookupAt(sentence, clickedIndex)
    if (!result) {
      dictPanel.innerHTML = '<span class="dict-none">No entry found</span>'
      return
    }

    const { word, entries } = result
    dictPanel.innerHTML = ''

    // Stroke order diagrams (one per character, animated)
    const strokesEl = document.createElement('div')
    strokesEl.className = 'dict-strokes'
    for (const ch of [...word]) strokesEl.appendChild(makeStrokeChar(ch))
    dictPanel.appendChild(strokesEl)

    // Definition text
    const infoEl = document.createElement('div')
    infoEl.className = 'dict-info'

    const wordEl = document.createElement('span')
    wordEl.className = 'dict-word'
    wordEl.textContent = word
    infoEl.appendChild(wordEl)

    for (const { p, e } of entries) {
      const entryEl = document.createElement('span')
      entryEl.className = 'dict-entry'
      const pEl = document.createElement('span')
      pEl.className = 'dict-pinyin'
      pEl.textContent = p
      const eEl = document.createElement('span')
      eEl.className = 'dict-defs'
      eEl.textContent = e.join('; ')
      entryEl.append(pEl, eEl)
      infoEl.appendChild(entryEl)
    }
    dictPanel.appendChild(infoEl)

  } catch (e) {
    dictPanel.innerHTML = '<span class="dict-none">Could not load dictionary</span>'
  }
}

// ── Completion ────────────────────────────────────────────────────────────────
function showComplete() {
  progressBar.style.width = '100%'
  showView('complete')
}

restartBtn.addEventListener('click', () => {
  if (state.current) {
    state.lineIndex = 0
    showView('practice')
    renderLine(0)
  }
})

homeBtn.addEventListener('click', () => {
  state.current = null
  state.lineIndex = 0
  showView('list')
})

backBtn.addEventListener('click', () => {
  state.current = null
  state.lineIndex = 0
  showView('list')
})

// ── Utility ───────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
init()
