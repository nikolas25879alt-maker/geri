
const SUPABASE_URL  = 'https://fcegvomhsjknxwazdydc.supabase.co';   // e.g. https://xyzxyz.supabase.co
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZWd2b21oc2prbnh3YXpkeWRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjk5NTAsImV4cCI6MjA5NDYwNTk1MH0.mMBE9l1aCdSR0lwdph24mJ4e0hncoQdttaNdDXzXxl4';
const STORAGE_BUCKET = 'photos';
// ══════════════════════════════════════════════════════════════

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ── IP RATE LIMITING ──────────────────────────────────────────
// We hash a fingerprint (not a real IP on static sites) but combined
// with Supabase RLS and auth lockout it's very effective.
async function getIpHash() {
    const fp = [navigator.userAgent, navigator.language, screen.width, screen.height, new Date().getTimezoneOffset()].join('|');
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fp));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0,32);
}

const COOLDOWN_MS = 60_000; // 1 minute
let cooldownActive = false;

async function checkCooldown(ipHash) {
    const since = new Date(Date.now() - COOLDOWN_MS).toISOString();
    const { data } = await sb.from('login_attempts')
        .select('id')
        .eq('ip_hash', ipHash)
        .gte('attempted_at', since);
    return data && data.length > 0;
}

async function recordAttempt(ipHash) {
    await sb.from('login_attempts').insert({ ip_hash: ipHash });
}

function startCooldown() {
    cooldownActive = true;
    const btn = document.getElementById('loginBtn');
    const bar = document.getElementById('cooldownBar');
    const fill = document.getElementById('cooldownFill');
    bar.style.display = 'block';
    fill.style.width = '100%';
    btn.disabled = true;

    let remaining = COOLDOWN_MS / 1000;
    btn.textContent = `Wait ${remaining}s`;

    const interval = setInterval(() => {
        remaining--;
        fill.style.width = (remaining / (COOLDOWN_MS / 1000) * 100) + '%';
        btn.textContent = `Wait ${remaining}s`;
        if (remaining <= 0) {
            clearInterval(interval);
            btn.disabled = false;
            btn.textContent = 'Sign In';
            bar.style.display = 'none';
            cooldownActive = false;
        }
    }, 1000);
}

// ── AUTH ──────────────────────────────────────────────────────
function showError(msg) {
    const el = document.getElementById('loginError');
    el.textContent = msg;
    el.style.display = 'block';
}

async function doLogin() {
    if (cooldownActive) return;
    const email = document.getElementById('loginEmail').value.trim();
    const pwd   = document.getElementById('loginPassword').value;
    const btn   = document.getElementById('loginBtn');

    if (!email || !pwd) { showError('Please enter email and password.'); return; }

    const ipHash = await getIpHash();

    // Check if this fingerprint is in cooldown
    const blocked = await checkCooldown(ipHash);
    if (blocked) {
        showError('Too many failed attempts. Please wait 1 minute.');
        startCooldown();
        return;
    }

    btn.innerHTML = '<span class="spinner"></span>';
    btn.disabled = true;

    const { error } = await sb.auth.signInWithPassword({ email, password: pwd });

    if (error) {
        await recordAttempt(ipHash);
        showError('Invalid credentials. ' + error.message);
        startCooldown();
        return;
    }

    // Success
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminShell').style.display = 'block';
    loadPhotos();
    loadBlogPosts();
}

// Enter key support
document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && document.getElementById('loginScreen').style.display !== 'none') doLogin();
});

async function doLogout() {
    await sb.auth.signOut();
    location.reload();
}

// Check existing session on load
window.addEventListener('load', async () => {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('adminShell').style.display = 'block';
        loadPhotos();
        loadBlogPosts();
    }
});

// ── UI HELPERS ─────────────────────────────────────────────────
function switchTab(name, btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + name).classList.add('active');
}

function toast(msg, type='success') {
    const el = document.getElementById('toast');
    el.className = 'show ' + type;
    el.innerHTML = `<i class="fas fa-${type==='success'?'check-circle':'exclamation-circle'}" style="color:${type==='success'?'#22c55e':'#ef4444'}"></i> ${msg}`;
    setTimeout(() => el.classList.remove('show'), 3500);
}

// ── PHOTOS ─────────────────────────────────────────────────────
let pendingFiles = [];
let selectedPreviewIndex = 0;
let manualWatermark = {
  enabled: false,
  x: 24,
  y: 24,
  width: 160
};

function getWatermarkEditorEls() {
  return {
    editor: document.getElementById('watermarkEditor'),
    stage: document.getElementById('watermarkStage'),
    previewImage: document.getElementById('watermarkPreviewImage'),
    overlay: document.getElementById('watermarkOverlay'),
    overlayBox: document.getElementById('watermarkOverlayBox'),
    resizeHandle: document.getElementById('watermarkResizeHandle')
  };
}

function updateOverlayVisualFromControls() {
  const { overlay, overlayBox, stage } = getWatermarkEditorEls();
  if (!overlay || !overlayBox || !stage) return;

  const enabled = document.getElementById('wmEnabled')?.checked ?? true;
  const opacity = parseFloat(document.getElementById('wmOpacity')?.value || '0.5');
  const scale = parseFloat(document.getElementById('wmScale')?.value || '0.24');

  overlayBox.style.display = enabled ? 'block' : 'none';
  overlay.style.opacity = opacity;

  if (!enabled) return;

  const stageWidth = stage.clientWidth || 0;
  const fallbackWidth = Math.max(70, Math.min(stageWidth * scale, stageWidth * 0.65));

  if (!manualWatermark.width || Number.isNaN(manualWatermark.width)) {
    manualWatermark.width = fallbackWidth;
  }

  overlayBox.style.width = `${manualWatermark.width}px`;

  requestAnimationFrame(() => {
    clampManualWatermarkPosition();
  });
}

function clampManualWatermarkPosition() {
  const { stage, overlayBox } = getWatermarkEditorEls();
  if (!stage || !overlayBox) return;

  const stageRect = stage.getBoundingClientRect();
  const boxRect = overlayBox.getBoundingClientRect();

  const maxX = Math.max(0, stageRect.width - boxRect.width);
  const maxY = Math.max(0, stageRect.height - boxRect.height);

  manualWatermark.x = Math.min(Math.max(0, manualWatermark.x), maxX);
  manualWatermark.y = Math.min(Math.max(0, manualWatermark.y), maxY);

  overlayBox.style.left = `${manualWatermark.x}px`;
  overlayBox.style.top = `${manualWatermark.y}px`;
}

function resetWatermarkManualPosition() {
  manualWatermark.enabled = false;

  const { stage } = getWatermarkEditorEls();
  if (!stage) return;

  const scale = parseFloat(document.getElementById('wmScale')?.value || '0.24');
  const stageWidth = stage.clientWidth || 0;
  manualWatermark.width = Math.max(70, Math.min(stageWidth * scale, stageWidth * 0.65));

  requestAnimationFrame(() => {
    const { stage, overlayBox } = getWatermarkEditorEls();
    if (!stage || !overlayBox) return;

    const stageRect = stage.getBoundingClientRect();
    const boxRect = overlayBox.getBoundingClientRect();

    manualWatermark.x = Math.max(0, stageRect.width - boxRect.width - 24);
    manualWatermark.y = Math.max(0, stageRect.height - boxRect.height - 24);

    clampManualWatermarkPosition();
  });
}

function renderWatermarkPreview(index = 0) {
  const { editor, previewImage, overlayBox, overlay } = getWatermarkEditorEls();
  if (!editor || !previewImage || !overlayBox || !overlay || !pendingFiles.length) return;

  const file = pendingFiles[index];
  if (!file) return;

  selectedPreviewIndex = index;
  editor.classList.add('visible');

  overlay.src = './watermark.png';
  overlayBox.style.display = 'block';

  const url = URL.createObjectURL(file);
  previewImage.onload = () => {
    updateOverlayVisualFromControls();
    if (!manualWatermark.enabled) resetWatermarkManualPosition();
    setTimeout(() => URL.revokeObjectURL(url), 300);
  };
  previewImage.src = url;

  document.querySelectorAll('.preview-thumb').forEach((thumb, i) => {
    thumb.classList.toggle('active', i === index);
  });
}

function initWatermarkDrag() {
  const { overlay, overlayBox, stage, resizeHandle } = getWatermarkEditorEls();
  if (!overlay || !overlayBox || !stage || !resizeHandle || overlay.dataset.dragReady === '1') return;

  overlay.dataset.dragReady = '1';

  let dragging = false;
  let resizing = false;
  let offsetX = 0;
  let offsetY = 0;
  let startX = 0;
  let startWidth = 0;

  const moveDrag = (clientX, clientY) => {
    const stageRect = stage.getBoundingClientRect();
    const boxRect = overlayBox.getBoundingClientRect();

    manualWatermark.enabled = true;
    manualWatermark.x = clientX - stageRect.left - offsetX;
    manualWatermark.y = clientY - stageRect.top - offsetY;

    const maxX = Math.max(0, stageRect.width - boxRect.width);
    const maxY = Math.max(0, stageRect.height - boxRect.height);

    manualWatermark.x = Math.min(Math.max(0, manualWatermark.x), maxX);
    manualWatermark.y = Math.min(Math.max(0, manualWatermark.y), maxY);

    overlayBox.style.left = `${manualWatermark.x}px`;
    overlayBox.style.top = `${manualWatermark.y}px`;
  };

  const moveResize = (clientX) => {
    const stageRect = stage.getBoundingClientRect();
    const nextWidth = startWidth + (clientX - startX);
    const minWidth = 70;
    const maxWidth = stageRect.width * 0.75;

    manualWatermark.width = Math.min(Math.max(minWidth, nextWidth), maxWidth);
    overlayBox.style.width = `${manualWatermark.width}px`;
    clampManualWatermarkPosition();
  };

  overlay.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const rect = overlayBox.getBoundingClientRect();
    dragging = true;
    overlay.classList.add('dragging');
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    overlay.setPointerCapture(e.pointerId);
  });

  overlay.addEventListener('pointermove', (e) => {
    if (dragging) moveDrag(e.clientX, e.clientY);
  });

  overlay.addEventListener('pointerup', (e) => {
    dragging = false;
    overlay.classList.remove('dragging');
    if (overlay.hasPointerCapture(e.pointerId)) {
      overlay.releasePointerCapture(e.pointerId);
    }
  });

  overlay.addEventListener('pointercancel', () => {
    dragging = false;
    overlay.classList.remove('dragging');
  });

  resizeHandle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    resizing = true;
    startX = e.clientX;
    startWidth = overlayBox.getBoundingClientRect().width;
    resizeHandle.setPointerCapture(e.pointerId);
  });

  resizeHandle.addEventListener('pointermove', (e) => {
    if (resizing) moveResize(e.clientX);
  });

  resizeHandle.addEventListener('pointerup', (e) => {
    resizing = false;
    if (resizeHandle.hasPointerCapture(e.pointerId)) {
      resizeHandle.releasePointerCapture(e.pointerId);
    }
  });

  resizeHandle.addEventListener('pointercancel', () => {
    resizing = false;
  });

  window.addEventListener('resize', () => {
    updateOverlayVisualFromControls();
  });
}

function onDragOver(e) { e.preventDefault(); document.getElementById('dropZone').classList.add('drag-over'); }
function onDragLeave(e) { document.getElementById('dropZone').classList.remove('drag-over'); }
function onDrop(e) {
    e.preventDefault();
    document.getElementById('dropZone').classList.remove('drag-over');
    onFilesSelected(e.dataTransfer.files);
}

function onFilesSelected(fileList) {
  pendingFiles = Array.from(fileList).slice(0, 10);
  if (!pendingFiles.length) return;

  const strip = document.getElementById('previewStrip');
  strip.innerHTML = '';

  pendingFiles.forEach((f, i) => {
    const url = URL.createObjectURL(f);
    const div = document.createElement('div');
    div.className = 'preview-thumb';
    div.innerHTML = `<img src="${url}" alt="${f.name}"><button type="button" onclick="removeFile(${i})">×</button>`;
    div.addEventListener('click', (e) => {
      if (e.target.tagName.toLowerCase() === 'button') return;
      renderWatermarkPreview(i);
    });
    strip.appendChild(div);
  });

  document.getElementById('uploadMeta').classList.add('visible');
  initWatermarkDrag();
  renderWatermarkPreview(0);
}

function removeFile(idx) {
  pendingFiles.splice(idx, 1);

  if (!pendingFiles.length) {
    cancelUpload();
    return;
  }

  if (selectedPreviewIndex >= pendingFiles.length) {
    selectedPreviewIndex = pendingFiles.length - 1;
  }

  onFilesSelected(pendingFiles);
  renderWatermarkPreview(selectedPreviewIndex);
}

function cancelUpload() {
  pendingFiles = [];
  selectedPreviewIndex = 0;
  manualWatermark = { enabled: false, x: 24, y: 24, width: 160 };

  document.getElementById('previewStrip').innerHTML = '';
  document.getElementById('uploadMeta').classList.remove('visible');
  document.getElementById('fileInput').value = '';

  const { editor, previewImage, overlayBox } = getWatermarkEditorEls();
  if (editor) editor.classList.remove('visible');
  if (previewImage) previewImage.src = '';
  if (overlayBox) overlayBox.style.display = 'none';
}

async function loadWatermarkImage() {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load watermark.png from root folder'));
    img.src = './watermark.png';
  });
}

function getWatermarkSettings() {
  return {
    enabled: document.getElementById('wmEnabled')?.checked ?? true,
    scale: parseFloat(document.getElementById('wmScale')?.value || '0.24'),
    opacity: parseFloat(document.getElementById('wmOpacity')?.value || '0.5')
  };
}

['wmScale', 'wmOpacity', 'wmEnabled'].forEach((id) => {
  document.addEventListener('input', (e) => {
    if (e.target && e.target.id === id) {
      if (id === 'wmScale' && !manualWatermark.enabled) {
        manualWatermark.width = 0;
      }
      updateOverlayVisualFromControls();
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target && e.target.id === id) {
      if (id === 'wmScale' && !manualWatermark.enabled) {
        manualWatermark.width = 0;
      }
      updateOverlayVisualFromControls();
    }
  });
});

async function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to read image: ${file.name}`));
    };
    img.src = url;
  });
}

async function renderWatermarkedFile(file, settings) {
  if (!settings.enabled) return file;

  const [photo, watermark] = await Promise.all([
    fileToImage(file),
    loadWatermarkImage()
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = photo.naturalWidth;
  canvas.height = photo.naturalHeight;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(photo, 0, 0, canvas.width, canvas.height);

  const ratio = watermark.naturalHeight / watermark.naturalWidth;
  const defaultWidth = canvas.width * settings.scale;
  const defaultHeight = defaultWidth * ratio;

  let drawX = Math.max(0, canvas.width - defaultWidth - 24);
  let drawY = Math.max(0, canvas.height - defaultHeight - 24);
  let drawWidth = defaultWidth;
  let drawHeight = defaultHeight;

  if (manualWatermark.enabled) {
    const { stage, overlayBox } = getWatermarkEditorEls();

    if (stage && overlayBox) {
      const stageRect = stage.getBoundingClientRect();
      const boxRect = overlayBox.getBoundingClientRect();

      const scaleX = canvas.width / stageRect.width;
      const scaleY = canvas.height / stageRect.height;

      drawX = manualWatermark.x * scaleX;
      drawY = manualWatermark.y * scaleY;
      drawWidth = boxRect.width * scaleX;
      drawHeight = drawWidth * ratio;
    }
  }

  ctx.save();
  ctx.globalAlpha = settings.opacity;
  ctx.drawImage(watermark, drawX, drawY, drawWidth, drawHeight);
  ctx.restore();

  const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const quality = mimeType === 'image/png' ? undefined : 0.92;

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, mimeType, quality);
  });

  if (!blob) throw new Error(`Failed to watermark ${file.name}`);

  const ext = mimeType === 'image/png' ? 'png' : 'jpg';
  const baseName = file.name.replace(/\.[^.]+$/, '');
  return new File([blob], `${baseName}-wm.${ext}`, { type: mimeType });
}

async function doUpload() {
  if (!pendingFiles.length) return;

  const title = document.getElementById('metaTitle').value.trim();
  const location = document.getElementById('metaLocation').value.trim();
  const category = document.getElementById('metaCategory').value;
  const tag = document.getElementById('metaTag').value.trim();

  const prog = document.getElementById('uploadProgress');
  const progText = document.getElementById('uploadProgressText');
  const fill = document.getElementById('progressFill');

  const wmSettings = getWatermarkSettings();

  prog.style.display = 'block';

  let done = 0;

  for (const originalFile of pendingFiles) {
    try {
      progText.textContent = `Preparing ${originalFile.name}...`;

      const uploadFile = await renderWatermarkedFile(originalFile, wmSettings);

      const ext = uploadFile.name.split('.').pop();
      const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      progText.textContent = `Uploading ${originalFile.name}...`;

      const { error: storageErr } = await sb.storage
        .from(STORAGE_BUCKET)
        .upload(`portfolio/${name}`, uploadFile, {
          contentType: uploadFile.type,
          upsert: false
        });

      if (storageErr) {
        toast('Upload failed: ' + storageErr.message, 'error');
        continue;
      }

      const { data: urlData } = sb.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(`portfolio/${name}`);

      const publicUrl = urlData.publicUrl;

      const fileTitle = pendingFiles.length === 1
        ? (title || originalFile.name.replace(/\.[^.]+$/, ''))
        : (title ? `${title} (${done + 1})` : originalFile.name.replace(/\.[^.]+$/, ''));

      await sb.from('photos').insert({
        title: fileTitle,
        location,
        category,
        tag,
        image_url: publicUrl,
        thumb_url: publicUrl,
        sort_order: Date.now()
      });

      done++;
      fill.style.width = (done / pendingFiles.length * 100) + '%';
    } catch (err) {
      toast(`Upload failed: ${err.message || err}`, 'error');
    }
  }

  prog.style.display = 'none';
  fill.style.width = '0%';
  toast(`${done} photo${done !== 1 ? 's' : ''} uploaded!`);
  cancelUpload();
  loadPhotos();
}

async function loadPhotos() {
    const grid = document.getElementById('photosGrid');
    grid.innerHTML = '<div class="photos-empty"><i class="fas fa-spinner fa-spin" style="font-size:1.5rem;color:var(--blue);margin-bottom:0.75rem;display:block;"></i>Loading...</div>';

    const { data, error } = await sb.from('photos').select('*').order('sort_order', { ascending: false }).limit(100);

    if (error || !data || !data.length) {
        grid.innerHTML = '<div class="photos-empty"><i class="fas fa-images" style="font-size:2rem;margin-bottom:0.75rem;display:block;color:var(--muted);"></i>No photos yet. Upload some above!</div>';
        return;
    }

    grid.innerHTML = data.map(p => `
        <div class="admin-photo-card">
            <img src="${p.thumb_url || p.image_url}" alt="${p.title}" loading="lazy">
            <div class="admin-photo-info">
                <strong title="${p.title}">${p.title}</strong>
                <span>${p.location || '—'}</span>
                <span class="cat-badge">${p.category}</span>
            </div>
            <div class="card-actions">
                <button class="btn-danger" onclick="deletePhoto('${p.id}', '${p.image_url}')"><i class="fas fa-trash"></i> Delete</button>
            </div>
        </div>
    `).join('');
}

async function deletePhoto(id, imageUrl) {
    if (!confirm('Delete this photo permanently?')) return;

    // Remove from DB
    await sb.from('photos').delete().eq('id', id);

    // Remove from storage
    try {
        const path = imageUrl.split('/portfolio/')[1];
        if (path) await sb.storage.from(STORAGE_BUCKET).remove([`portfolio/${path}`]);
    } catch(e) {}

    toast('Photo deleted.');
    loadPhotos();
}

function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function toDateInputValue(dateValue) {
    const d = dateValue ? new Date(dateValue) : new Date();
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().split('T')[0];
}

function openBlogEditor(post) {
    const editor = document.getElementById('blogEditor');
    editor.classList.add('visible');

    document.getElementById('editorTitle').textContent = post ? 'Edit Post' : 'New Post';
    document.getElementById('editingPostId').value = post ? post.id : '';
    document.getElementById('titleEn').value = post?.title_en || '';
    document.getElementById('bodyEn').value = post?.body_en || '';
    document.getElementById('postDate').value = post?.created_at ? toDateInputValue(post.created_at) : '';

    editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeBlogEditor() {
    document.getElementById('blogEditor').classList.remove('visible');
}

function makeExcerpt(text, maxLen = 180) {
    const clean = (text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return '';
    return clean.length <= maxLen ? clean : clean.slice(0, maxLen).trimEnd() + '…';
}

async function saveBlogPost() {
    const id = document.getElementById('editingPostId').value;
    const title = document.getElementById('titleEn').value.trim();
    const body = document.getElementById('bodyEn').value.trim();
    const selectedDate = document.getElementById('postDate').value || toDateInputValue();
    const publishAt = new Date(selectedDate + 'T12:00:00').toISOString();
    const excerpt = makeExcerpt(body);

    if (!title) {
        toast('Please enter a title.', 'error');
        return;
    }

    if (!body) {
        toast('Please enter the text.', 'error');
        return;
    }

    const payload = {
        title_en: title,
        title_sk: title,
        excerpt_en: excerpt,
        excerpt_sk: excerpt,
        body_en: body,
        body_sk: body,
        created_at: publishAt
    };

    let error;
    if (id) {
        ({ error } = await sb.from('blog_posts').update(payload).eq('id', id));
    } else {
        ({ error } = await sb.from('blog_posts').insert(payload));
    }

    if (error) {
        toast('Error saving post: ' + error.message, 'error');
        return;
    }

    toast(id ? 'Post updated!' : 'Post published!');
    closeBlogEditor();
    loadBlogPosts();
}

async function loadBlogPosts() {
    const list = document.getElementById('blogList');
    list.innerHTML = '<div class="photos-empty"><i class="fas fa-spinner fa-spin" style="font-size:1.5rem;color:var(--blue);display:block;margin-bottom:0.75rem;"></i>Loading...</div>';

    const { data, error } = await sb
        .from('blog_posts')
        .select('*')
        .order('created_at', { ascending: false });

    if (error || !data || !data.length) {
        list.innerHTML = '<div class="photos-empty"><i class="fas fa-pen-nib" style="font-size:2rem;margin-bottom:0.75rem;display:block;color:var(--muted);"></i>No blog posts yet. Create one above!</div>';
        return;
    }

    window.__blogPosts = data;

    list.innerHTML = data.map(p => `
        <div class="blog-post-card">
            <div class="post-info">
                <strong>${escapeHtml(p.title_en || '')}</strong>
                <span>${escapeHtml(p.title_sk || '') || '<em style="opacity:0.5">No SK translation</em>'}</span><br>
                <span style="font-size:0.75rem;color:var(--muted);margin-top:0.2rem;display:block;">
                    ${new Date(p.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                    })}
                </span>
            </div>
            <div class="post-actions">
                <button class="btn-edit" onclick="editPost('${p.id}')"><i class="fas fa-pen"></i> Edit</button>
                <button class="btn-danger" onclick="deletePost('${p.id}')"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

function editPost(id) {
    const post = (window.__blogPosts || []).find(p => String(p.id) === String(id));
    if (post) openBlogEditor(post);
}

async function deletePost(id) {
    if (!confirm('Delete this blog post permanently?')) return;
    await sb.from('blog_posts').delete().eq('id', id);
    toast('Post deleted.');
    loadBlogPosts();
}
