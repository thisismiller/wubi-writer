// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  stories: [],       // loaded from index.json
  current: null,     // { meta, lines: string[] }
  lineIndex: 0,
  isComposing: false,
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

  // Build target spans — one per character
  targetLine.innerHTML = ''
  for (const ch of line) {
    const span = document.createElement('span')
    span.className = 'char-pending'
    span.textContent = ch
    targetLine.appendChild(span)
  }

  // Reset input and feedback
  practiceInput.value = ''
  practiceInput.placeholder = '在这里输入…'
  feedbackMsg.textContent = ''
  feedbackMsg.className = ''
  practiceArea.classList.remove('flash-correct', 'shake')

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

function checkInput() {
  if (!state.current) return
  const typed = practiceInput.value
  const target = state.current.lines[state.lineIndex]
  const spans = targetLine.querySelectorAll('span')

  let allCorrect = true

  for (let i = 0; i < target.length; i++) {
    const span = spans[i]
    if (i >= typed.length) {
      span.className = 'char-pending'
      allCorrect = false
    } else if (typed[i] === target[i]) {
      span.className = 'char-correct'
    } else {
      span.className = 'char-wrong'
      allCorrect = false
    }
  }

  // If user has typed at least as many chars as target and all match → advance
  if (typed.length >= target.length && allCorrect) {
    onCorrect()
  } else if (typed.length >= target.length && !allCorrect) {
    onWrong(target)
  }
}

function resetCharColors() {
  const spans = targetLine.querySelectorAll('span')
  spans.forEach(s => (s.className = 'char-pending'))
}

function onCorrect() {
  practiceInput.disabled = true

  // Flash
  void practiceArea.offsetWidth // force reflow to restart animation
  practiceArea.classList.add('flash-correct')

  feedbackMsg.textContent = '正确！'
  feedbackMsg.className = 'correct'

  setTimeout(() => {
    practiceInput.disabled = false
    state.lineIndex++
    if (state.lineIndex >= state.current.lines.length) {
      showComplete()
    } else {
      renderLine(state.lineIndex)
    }
  }, 600)
}

function onWrong(target) {
  practiceInput.disabled = true

  void practiceArea.offsetWidth
  practiceArea.classList.add('shake')

  feedbackMsg.innerHTML = `不对。正确答案：<strong>${escapeHtml(target)}</strong><br><small>按 Enter 重试</small>`
  feedbackMsg.className = 'wrong'

  setTimeout(() => {
    practiceInput.disabled = false
  }, 400)
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
