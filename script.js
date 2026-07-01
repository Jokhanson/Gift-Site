// ==================== CONFIG ====================
// TODO: Замените на данные вашего Supabase проекта
const SUPABASE_URL = 'https://chiwgpcagylictmpdilp.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoaXdncGNhZ3lsaWN0bXBkaWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NzUzNTUsImV4cCI6MjA5ODQ1MTM1NX0.2xKmM4lHr0WnPt3881TP8H_9pHUz75QdPpX_Caxo4Uc'

// ==================== SUPABASE ====================
const { createClient } = supabase
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
const PHOTO_BUCKET = 'gift-photos'

// ==================== STATE ====================
let currentPage = null
let qrInstance = null

// ==================== API ====================
async function getPageBySlug(slug) {
  const { data, error } = await sb
    .from('pages')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()
  if (error) {
    console.error('getPageBySlug error:', error)
    return null
  }
  return data
}

async function getAllPages() {
  const { data, error } = await sb
    .from('pages')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('getAllPages error:', error)
    return []
  }
  return data
}

async function insertPage(pageData) {
  const { data, error } = await sb
    .from('pages')
    .insert(pageData)
    .select()
    .single()
  if (error) throw error
  return data
}

async function updatePage(slug, updates) {
  const { error } = await sb.from('pages').update(updates).eq('slug', slug)
  if (error) throw error
}

async function deletePage(slug) {
  const { data: page, error: fetchError } = await sb
    .from('pages').select('photo_urls').eq('slug', slug).maybeSingle()
  if (fetchError) throw fetchError

  if (page?.photo_urls?.length > 0) {
    const paths = page.photo_urls.map(url => {
      const parts = url.split('/')
      return parts.slice(-2).join('/')
    })
    const { error: storageError } = await sb.storage
      .from(PHOTO_BUCKET).remove(paths)
    if (storageError) console.error('Storage delete error:', storageError)
  }

  const { error } = await sb.from('pages').delete().eq('slug', slug)
  if (error) throw error
}

// ==================== PHOTO UPLOAD ====================
function compressImage(file, maxSize = 1200, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let width = img.width
      let height = img.height
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob((blob) => {
        resolve(blob)
      }, 'image/jpeg', quality)
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = URL.createObjectURL(file)
  })
}

async function uploadPhoto(slug, file) {
  const blob = await compressImage(file)
  const path = `${slug}/${Date.now()}.jpg`
  const { error } = await sb.storage.from(PHOTO_BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: false
  })
  if (error) throw error
  const { data: { publicUrl } } = sb.storage.from(PHOTO_BUCKET).getPublicUrl(path)
  return publicUrl
}

// ==================== ROUTER ====================
function router() {
  const hash = location.hash.slice(1) || '/'
  hideSidebar()
  if (hash.startsWith('/page/')) {
    renderViewPage(hash.slice(6))
  } else if (hash === '/create') {
    renderCreatePage()
  } else if (hash === '/') {
    renderHomePage()
  } else {
    renderNotFound()
  }
}

// ==================== VIEWS ====================
async function renderHomePage() {
  showLoading()
  const pages = await getAllPages()
  if (pages.length > 0) {
    navigate(`/page/${pages[0].slug}`)
  } else {
    navigate('/create')
  }
}

async function renderViewPage(slug) {
  showLoading()
  const page = await getPageBySlug(slug)
  if (!page) {
    renderNotFound()
    return
  }

  currentPage = page
  showSection('viewPage')

  document.getElementById('viewSticker').textContent = page.sticker || '🎉'
  document.getElementById('viewTitle').textContent = page.title
  document.getElementById('viewSubtitle').textContent = page.subtitle || ''
  document.getElementById('viewGreeting').textContent = page.greeting
  const msgEl = document.getElementById('viewMessage')
  msgEl.innerHTML = (page.message || '').replace(/\n/g, '<br>')
  document.getElementById('viewSignature').textContent = page.signature || ''

  document.getElementById('cardInner').classList.remove('open')

  renderVideo(page.video_url)
  renderPhotoGrid(page)

  document.getElementById('qrBtn').onclick = () => showQrModal(slug)
  document.getElementById('deleteBtn').classList.remove('hidden')
  document.getElementById('deleteBtn').onclick = () => showDeleteModal(slug)
}

function renderCreatePage() {
  showSection('createPage')
}

function renderNotFound() {
  showSection('viewPage')
  document.getElementById('viewSticker').textContent = '😢'
  document.getElementById('viewTitle').textContent = 'Страница не найдена'
  document.getElementById('viewSubtitle').textContent = 'Такой открытки не существует'
  document.getElementById('viewGreeting').textContent = ''
  document.getElementById('viewMessage').textContent = ''
  document.getElementById('viewSignature').textContent = ''
  document.getElementById('cardInner').classList.remove('open')
  document.getElementById('videoContainer').classList.add('hidden')
  document.getElementById('qrBtn').onclick = null
  document.getElementById('deleteBtn').classList.add('hidden')
  document.getElementById('photoActions').classList.add('hidden')
  document.getElementById('photoGrid').innerHTML = ''
}

// ==================== VIDEO ====================
function renderVideo(url) {
  const container = document.getElementById('videoContainer')
  if (!url) {
    container.classList.add('hidden')
    return
  }

  const embedUrl = getVideoEmbedUrl(url)
  if (embedUrl) {
    container.innerHTML = `<iframe src="${embedUrl}" allowfullscreen loading="lazy" title="YouTube video"></iframe>`
    container.classList.remove('hidden')
  } else {
    container.classList.add('hidden')
  }
}

function getVideoEmbedUrl(url) {
  if (!url) return null

  const urlTrimmed = url.trim()
  const params = new URLSearchParams(urlTrimmed.split('?')[1] || '')
  const timeParam = params.get('t') || ''

  const ytMatch = urlTrimmed.match(
    /(?:youtube\.com|youtu\.be)\/watch\?v=([\w-]{11})/
  ) || urlTrimmed.match(/youtu\.be\/([\w-]{11})/)
    || urlTrimmed.match(/youtube\.com\/embed\/([\w-]{11})/)
    || urlTrimmed.match(/youtube\.com\/shorts\/([\w-]{11})/)
    || urlTrimmed.match(/youtube\.com\/live\/([\w-]{11})/)
    || urlTrimmed.match(/^([\w-]{11})$/)
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`

  const vkMatch = urlTrimmed.match(/vk(?:video)?\.ru\/video(-?\d+)_(\d+)/)
    || urlTrimmed.match(/vk\.com\/video(-?\d+)_(\d+)/)
  if (vkMatch) {
    const oid = vkMatch[1]
    const vid = vkMatch[2]
    let embed = `https://vk.com/video_ext.php?oid=${oid}&id=${vid}`
    if (timeParam) embed += `&t=${timeParam}`
    return embed
  }

  return null
}

// ==================== PHOTOS ====================
function renderPhotoGrid(page) {
  const grid = document.getElementById('photoGrid')
  const actions = document.getElementById('photoActions')
  const count = document.getElementById('photoCount')

  const photos = page.photo_urls || []

  if (photos.length > 0) {
    grid.innerHTML = photos.map(url =>
      `<div class="photo-item"><img src="${url}" alt="Фото" loading="lazy"></div>`
    ).join('')
  } else {
    grid.innerHTML = '<p class="photo-empty">Пока нет фотографий</p>'
  }

  count.textContent = `${photos.length} / 5`
  actions.classList.toggle('hidden', photos.length >= 5)
}

// ==================== QR ====================
function showQrModal(slug) {
  const modal = document.getElementById('qrModal')
  const container = document.getElementById('qrContainer')
  const linkEl = document.getElementById('qrLink')

  const url = `${location.origin}${location.pathname}#/page/${slug}`
  linkEl.textContent = url

  container.innerHTML = ''
  qrInstance = new QRCode(container, {
    text: url,
    width: 200,
    height: 200,
    colorDark: '#333333',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  })

  modal.classList.remove('hidden')
}

// ==================== SIDEBAR ====================
async function populateSidebar() {
  const list = document.getElementById('sidebarList')
  const pages = await getAllPages()

  if (pages.length === 0) {
    list.innerHTML = '<p class="sidebar-empty">Пока нет открыток</p>'
    return
  }

  list.innerHTML = pages.map(p => {
    const photoCount = (p.photo_urls || []).length
    return `
      <a class="sidebar-item" href="#/page/${p.slug}">
        <span class="sidebar-sticker">${p.sticker || '🎉'}</span>
        <div class="sidebar-info">
          <span class="sidebar-occasion">${escapeHtml(p.occasion)}</span>
          <span class="sidebar-date">${formatDate(p.created_at)}</span>
        </div>
        ${photoCount > 0 ? `<span class="sidebar-photo-badge">📷 ${photoCount}</span>` : ''}
      </a>
    `
  }).join('')
}

// ==================== HELPERS ====================
function showLoading() {
  document.querySelectorAll('.page-section').forEach(el => el.classList.add('hidden'))
  document.getElementById('loading').classList.remove('hidden')
}

function showSection(id) {
  document.querySelectorAll('.page-section').forEach(el => el.classList.add('hidden'))
  document.getElementById('loading').classList.add('hidden')
  document.getElementById(id).classList.remove('hidden')
}

function navigate(hash) {
  location.hash = hash
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function generateSlug() {
  return Math.random().toString(36).slice(2, 10)
}

function hideSidebar() {
  document.getElementById('sidebar').classList.remove('open')
  document.getElementById('sidebarOverlay').classList.remove('open')
}

// ==================== CONFETTI ====================
let confettiActive = false
let confettiPieces = []
let animationId = null

function createConfettiPiece() {
  const colors = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd', '#01a3a4', '#ff6348']
  return {
    x: Math.random() * window.innerWidth,
    y: -20,
    w: Math.random() * 10 + 5,
    h: Math.random() * 6 + 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    vy: Math.random() * 3 + 2,
    vx: (Math.random() - 0.5) * 4,
    rotation: Math.random() * 360,
    rotSpeed: (Math.random() - 0.5) * 10,
    opacity: 1
  }
}

function drawConfetti(ctx) {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
  for (let i = confettiPieces.length - 1; i >= 0; i--) {
    const p = confettiPieces[i]
    p.x += p.vx
    p.y += p.vy
    p.vy += 0.05
    p.rotation += p.rotSpeed
    if (p.y > window.innerHeight + 20) {
      confettiPieces.splice(i, 1)
      continue
    }
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate((p.rotation * Math.PI) / 180)
    ctx.globalAlpha = p.opacity
    ctx.fillStyle = p.color
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
    ctx.restore()
  }
}

function startConfetti() {
  if (confettiActive) return
  confettiActive = true
  const canvas = document.getElementById('confetti-canvas')
  const ctx = canvas.getContext('2d')
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  let count = 0
  function burst() {
    if (!confettiActive) return
    for (let i = 0; i < 5; i++) {
      confettiPieces.push(createConfettiPiece())
    }
    count++
    if (count < 60) requestAnimationFrame(burst)
  }
  burst()

  function animate() {
    if (!confettiActive) return
    drawConfetti(ctx)
    animationId = requestAnimationFrame(animate)
  }
  animate()

  setTimeout(() => {
    confettiActive = false
    if (animationId) cancelAnimationFrame(animationId)
    setTimeout(() => {
      confettiPieces = []
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }, 3000)
  }, 5000)
}

// ==================== EVENTS ====================

// Card
document.getElementById('openBtn').addEventListener('click', (e) => {
  e.stopPropagation()
  document.getElementById('cardInner').classList.add('open')
  startConfetti()
})

document.getElementById('card').addEventListener('click', () => {
  const inner = document.getElementById('cardInner')
  if (!inner.classList.contains('open')) {
    inner.classList.add('open')
    startConfetti()
  }
})

// Create form
document.getElementById('createForm').addEventListener('submit', async (e) => {
  e.preventDefault()

  const slug = generateSlug()
  const pageData = {
    slug,
    occasion: document.getElementById('formOccasion').value,
    title: document.getElementById('formTitle').value,
    subtitle: document.getElementById('formSubtitle').value,
    greeting: document.getElementById('formGreeting').value,
    message: document.getElementById('formMessage').value,
    signature: document.getElementById('formSignature').value,
    sticker: document.getElementById('formSticker').value || '🎉',
    video_url: document.getElementById('formVideoUrl').value,
    photo_urls: []
  }

  try {
    await insertPage(pageData)
    navigate(`/page/${slug}`)
  } catch (err) {
    console.error(err)
    alert('Ошибка при создании открытки. Проверьте подключение к Supabase.')
  }
})

// Photo upload
document.getElementById('photoInput').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files)
  if (!currentPage || files.length === 0) return

  const photos = [...(currentPage.photo_urls || [])]
  const remaining = 5 - photos.length
  const toUpload = files.slice(0, remaining)

  for (const file of toUpload) {
    try {
      const url = await uploadPhoto(currentPage.slug, file)
      photos.push(url)
    } catch (err) {
      console.error(err)
      alert('Ошибка при загрузке фото')
      break
    }
  }

  if (photos.length > (currentPage.photo_urls || []).length) {
    currentPage.photo_urls = photos
    await updatePage(currentPage.slug, { photo_urls: photos })
    renderPhotoGrid(currentPage)
    populateSidebar()
  }

  e.target.value = ''
})

// Sidebar
document.getElementById('menuBtn').addEventListener('click', () => {
  document.getElementById('sidebar').classList.add('open')
  document.getElementById('sidebarOverlay').classList.add('open')
  populateSidebar()
})

document.getElementById('closeSidebar').addEventListener('click', hideSidebar)
document.getElementById('sidebarOverlay').addEventListener('click', hideSidebar)

document.getElementById('createNewBtn').addEventListener('click', () => {
  hideSidebar()
  navigate('/create')
})

// Sidebar link clicks via delegation
document.getElementById('sidebarList').addEventListener('click', (e) => {
  const link = e.target.closest('a.sidebar-item')
  if (link) hideSidebar()
})

// QR modal
document.getElementById('closeQrBtn').addEventListener('click', () => {
  document.getElementById('qrModal').classList.add('hidden')
})

document.getElementById('qrModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    document.getElementById('qrModal').classList.add('hidden')
  }
})

// Delete
function showDeleteModal(slug) {
  document.getElementById('deleteModal').classList.remove('hidden')
  document.getElementById('confirmDeleteBtn').onclick = async () => {
    try {
      await deletePage(slug)
      document.getElementById('deleteModal').classList.add('hidden')
      navigate('/')
    } catch (err) {
      console.error(err)
      alert('Ошибка при удалении открытки')
    }
  }
}

document.getElementById('closeDeleteBtn').addEventListener('click', () => {
  document.getElementById('deleteModal').classList.add('hidden')
})

document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
  document.getElementById('deleteModal').classList.add('hidden')
})

document.getElementById('deleteModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    document.getElementById('deleteModal').classList.add('hidden')
  }
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    hideSidebar()
    document.getElementById('qrModal').classList.add('hidden')
    document.getElementById('deleteModal').classList.add('hidden')
  }
})

// Window resize
window.addEventListener('resize', () => {
  const canvas = document.getElementById('confetti-canvas')
  if (canvas) {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
  }
})

// ==================== INIT ====================
window.addEventListener('hashchange', router)
window.addEventListener('load', router)
