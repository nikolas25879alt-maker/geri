const SUPABASE_URL = 'https://fcegvomhsjknxwazdydc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZWd2b21oc2prbnh3YXpkeWRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjk5NTAsImV4cCI6MjA5NDYwNTk1MH0.mMBE9l1aCdSR0lwdph24mJ4e0hncoQdttaNdDXzXxl4';


const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const modal = document.getElementById('storyModal');
const modalClose = document.getElementById('storyModalClose');
const langSk = document.getElementById('lang-sk');
const langEn = document.getElementById('lang-en');

function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function makeParagraphs(text) {
    return escapeHtml(text || '')
        .split('\n')
        .filter(p => p.trim() !== '')
        .map(p => `<p>${p}</p>`)
        .join('');
}

function getLang() {
    return localStorage.getItem('selectedLanguage') || 'en';
}

function setLang(lang) {
    localStorage.setItem('selectedLanguage', lang);
    langSk.classList.toggle('active', lang === 'sk');
    langEn.classList.toggle('active', lang !== 'sk');
    loadBlogPosts();
}

async function loadBlogPosts() {
    const { data, error } = await sb
        .from('blog_posts')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    const blogGrid = document.querySelector('.blog-grid');

    if (!data || !data.length) {
        blogGrid.innerHTML = `
            <div class="blog-card">
                <h2>No posts yet</h2>
                <p>Create first blog post in admin panel.</p>
            </div>
        `;
        return;
    }

    window.blogPosts = data;

    const lang = getLang();

    blogGrid.innerHTML = data.map(post => {
        const title = lang === 'sk' ? (post.title_sk || post.title_en) : (post.title_en || post.title_sk);
        const excerpt = lang === 'sk' ? (post.excerpt_sk || post.excerpt_en) : (post.excerpt_en || post.excerpt_sk);
        const date = new Date(post.created_at).toLocaleDateString(lang === 'sk' ? 'sk-SK' : 'en-GB', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        return `
            <article class="blog-card">
                <span class="blog-date">${date}</span>
                <h2>${escapeHtml(title || '')}</h2>
                <p>${escapeHtml(excerpt || '')}</p>
                <a href="#" class="read-more" onclick="openPost('${post.id}'); return false;">Read Full Story →</a>
            </article>
        `;
    }).join('');
}

function openPost(id) {
    const post = (window.blogPosts || []).find(p => String(p.id) === String(id));
    if (!post) return;

    const lang = getLang();
    const title = lang === 'sk' ? (post.title_sk || post.title_en) : (post.title_en || post.title_sk);
    const body = lang === 'sk' ? (post.body_sk || post.body_en) : (post.body_en || post.body_sk);

    document.getElementById('storyModalTitle').textContent = title || 'Untitled';
    document.getElementById('storyModalMeta').textContent =
        new Date(post.created_at).toLocaleDateString(lang === 'sk' ? 'sk-SK' : 'en-GB', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    document.getElementById('storyModalBody').innerHTML = makeParagraphs(body || '');
    document.getElementById('storyModalKicker').textContent = lang === 'sk' ? 'Celý príbeh' : 'Full Story';

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeStory() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

langSk.addEventListener('click', () => setLang('sk'));
langEn.addEventListener('click', () => setLang('en'));
modalClose.addEventListener('click', closeStory);

modal.addEventListener('click', (e) => {
    if (e.target === modal) closeStory();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeStory();
});

setLang(getLang());
loadBlogPosts();