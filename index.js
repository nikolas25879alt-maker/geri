    // ════════════════════════════════════════════════════════════════
    // SUPABASE CONFIGURATION
    // ════════════════════════════════════════════════════════════════
    const SUPABASE_URL = 'https://fcegvomhsjknxwazdydc.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjZWd2b21oc2prbnh3YXpkeWRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjk5NTAsImV4cCI6MjA5NDYwNTk1MH0.mMBE9l1aCdSR0lwdph24mJ4e0hncoQdttaNdDXzXxl4';

    // Initialize Supabase
    const { createClient } = supabase;
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

    let photosDatabase = [];

    // Function to convert Supabase photo format to local format
    function convertSupabasePhoto(dbPhoto) {
        return {
            title: dbPhoto.title || 'Untitled',
            location: dbPhoto.location || 'Unknown',
            category: dbPhoto.category || 'other',
            imgUrl: dbPhoto.image_url || dbPhoto.thumb_url || '',
            fullImgUrl: dbPhoto.image_url || '',
            tag: dbPhoto.tag || `📷 ${dbPhoto.category}`,
            id: dbPhoto.id
        };
    }

    // Load photos from Supabase
    async function loadPhotosFromSupabase() {
        try {
            const { data, error } = await sb
                .from('photos')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error loading photos:', error);
                return;
            }

            if (data && data.length > 0) {
                photosDatabase = data.map(convertSupabasePhoto);
            } else {
                // Fallback: Use demo photos if no photos in database
                loadDemoPhotos();
            }
            
            renderGallery();
        } catch (err) {
            console.error('Supabase connection error:', err);
            // Fallback to demo data
            loadDemoPhotos();
        }
    }

    // Demo photos for fallback/testing
    function loadDemoPhotos() {
        const demoPhotos = [
            { title: 'Ferrari F40 Legacy', location: 'Modena, Italy', category: 'cars', tag: '🏎️ Automotive', id: 'demo-1' },
            { title: 'Midnight Porsche 911', location: 'Stuttgart, Germany', category: 'cars', tag: '🏎️ Automotive', id: 'demo-2' },
            { title: 'Ancestral Gaze', location: 'Ethiopia, Omo Valley', category: 'portraits', tag: '📷 Portrait', id: 'demo-3' },
            { title: 'The Dancer', location: 'Paris, France', category: 'portraits', tag: '📷 Portrait', id: 'demo-4' },
            { title: 'Tokyo Lights', location: 'Tokyo, Japan', category: 'urban', tag: '🌆 Street', id: 'demo-5' },
            { title: 'Brooklyn Bridge Pulse', location: 'New York', category: 'urban', tag: '🌆 Street', id: 'demo-6' },
            { title: 'Northern Fjords', location: 'Norway', category: 'nature', tag: '🌿 Nature', id: 'demo-7' },
            { title: 'Iceland Aurora', location: 'Iceland', category: 'nature', tag: '🌿 Nature', id: 'demo-8' }
        ];
        
        photosDatabase = demoPhotos.map(p => ({
            ...p,
            imgUrl: `https://picsum.photos/420/320?random=${p.id}`,
            fullImgUrl: `https://picsum.photos/1400/1000?random=${p.id}`
        }));
    }

    const galleryGrid = document.getElementById('galleryGrid');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    const photoCount = document.getElementById('photoCount');
    const mobileQuery = window.matchMedia('(max-width: 768px)');
    const isMobile = () => mobileQuery.matches;
    let activeFilter = 'all';
    let currentView = 'grid';
    let current3DIndex = 0;
    let extraVisibleCount = 0;
    let lastViewportIsMobile = isMobile();
    const slotClasses = ['slot-0', 'slot-1', 'slot-2', 'slot-3', 'slot-4', 'slot-5', 'slot-6', 'slot-7'];

    function getBaseVisibleCount() {
        return isMobile() ? 5 : 8;
    }

    function getLoadMoreStep() {
        return isMobile() ? 5 : 8;
    }

    function resetGridPagination() {
        extraVisibleCount = 0;
    }

    function updateViewportMode() {
        const nowMobile = isMobile();
        if (nowMobile !== lastViewportIsMobile) {
            lastViewportIsMobile = nowMobile;
            currentView = 'grid';
            resetGridPagination();
        }
        if (viewToggleContainer) {
            viewToggleContainer.style.display = nowMobile ? 'none' : '';
        }
    }

    function renderGallery() {
        updateViewportMode();

        const filtered = activeFilter === 'all' ? photosDatabase : photosDatabase.filter(p => p.category === activeFilter);
        const viewMode = isMobile() ? 'grid' : currentView;
        galleryGrid.innerHTML = '';
        galleryGrid.className = viewMode === 'grid' ? 'gallery-grid' : 'gallery-carousel';

        if (filtered.length === 0) {
            galleryGrid.innerHTML = '<div style="color: gray; text-align:center; grid-column:1/-1; padding: 5rem;">No frames recorded here.</div>';
            if (photoCount) photoCount.textContent = '';
            if (loadMoreBtn) loadMoreBtn.hidden = true;
            return;
        }

        if (current3DIndex >= filtered.length) current3DIndex = 0;
        let slotCounter = 0;

        const visibleLimit = viewMode === 'grid' ? Math.min(filtered.length, getBaseVisibleCount() + extraVisibleCount) : filtered.length;
        const photosToRender = viewMode === 'grid' ? filtered.slice(0, visibleLimit) : filtered;

        photosToRender.forEach((photo, index) => {
            const card = document.createElement('div');
            card.className = 'photo-card ' + (viewMode === 'grid' ? 'fade-up' : '');
            card.innerHTML = `
                <div class="image-wrapper"><img src="${photo.imgUrl}" alt="${photo.title}" decoding="async"></div>
                <div class="photo-info">
                    <h3>${photo.title}</h3>
                    <p class="location-detail"><i class="fas fa-map-pin"></i> ${photo.location}</p>
                    <div class="category-tag"><i class="fas fa-tag"></i> ${photo.tag || photo.category}</div>
                </div>
            `;

            if (viewMode === 'grid') {
                card.addEventListener('click', () => openPhotoModal(photo));
            }

            if (viewMode === 'gallery') {
                if (index === current3DIndex) {
                    card.classList.add(slotClasses[(index % slotClasses.length)], 'active-3d');
                    card.addEventListener('click', (e) => {
                        e.stopPropagation();
                        openPhotoModal(photo);
                    });
                } else {
                    card.classList.add(slotClasses[slotCounter % slotClasses.length]);
                    slotCounter++;
                    card.addEventListener('click', (e) => {
                        e.stopPropagation();
                        current3DIndex = index;
                        renderGallery();
                    });
                }
            }
            galleryGrid.appendChild(card);
        });

        if (viewMode === 'gallery') {
            const navigationArrows = document.createElement('div');
            navigationArrows.className = 'canvas-nav-arrows';
            navigationArrows.innerHTML = `
                <button class="arrow-btn" id="prevBtn">&lt;</button>
                <button class="arrow-btn" id="nextBtn">&gt;</button>
            `;
            galleryGrid.appendChild(navigationArrows);

            document.getElementById('prevBtn').addEventListener('click', (e) => {
                e.stopPropagation();
                current3DIndex = (current3DIndex - 1 + filtered.length) % filtered.length;
                renderGallery();
            });
            document.getElementById('nextBtn').addEventListener('click', (e) => {
                e.stopPropagation();
                current3DIndex = (current3DIndex + 1) % filtered.length;
                renderGallery();
            });
            if (photoCount) photoCount.textContent = '';
            if (loadMoreBtn) loadMoreBtn.hidden = true;
        } else {
            document.querySelectorAll('#galleryGrid .fade-up').forEach(el => observer.observe(el));

            if (photoCount) {
                photoCount.textContent = `Showing ${photosToRender.length} of ${filtered.length} photos`;
            }
            if (loadMoreBtn) {
                const moreRemaining = visibleLimit < filtered.length;
                loadMoreBtn.hidden = !moreRemaining;
                loadMoreBtn.disabled = !moreRemaining;
                loadMoreBtn.textContent = moreRemaining
                    ? `Load more photos`
                    : 'All photos loaded';
            }
        }
        bindPhotoProtection(galleryGrid);
    }

    const viewBtns = document.querySelectorAll('.view-btn');
    const viewToggleContainer = document.querySelector('.view-toggle-container');

    function syncViewButtonState() {
        if (viewBtns && !isMobile()) {
            viewBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-view') === currentView));
        }
    }

    updateViewportMode();
    syncViewButtonState();
    window.addEventListener('resize', () => {
        updateViewportMode();
        syncViewButtonState();
        renderGallery();
    });

    viewBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (isMobile()) {
                currentView = 'grid';
                syncViewButtonState();
                renderGallery();
                return;
            }
            viewBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentView = btn.getAttribute('data-view');
            if (currentView === 'grid') {
                resetGridPagination();
            }
            syncViewButtonState();
            renderGallery();
            window.scrollTo({
              top: document.getElementById('gallery-main').offsetTop - 130,
              behavior: window.matchMedia('(max-width: 768px)').matches ? 'auto' : 'smooth'
            });
        });
    });

    const catBtns = document.querySelectorAll('.cat-btn');
    catBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            catBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = btn.getAttribute('data-filter');
            current3DIndex = 0;
            resetGridPagination();
            renderGallery();
            window.scrollTo({
              top: document.getElementById('gallery-main').offsetTop - 130,
              behavior: window.matchMedia('(max-width: 768px)').matches ? 'auto' : 'smooth'
            });
        });
    });

    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            extraVisibleCount += getLoadMoreStep();
            renderGallery();
        });
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { 
        root: null, 
        threshold: 0.1,
        rootMargin: '200px' 
    });

    document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));
    
    // Load photos from Supabase on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadPhotosFromSupabase);
    } else {
        loadPhotosFromSupabase();
    }

    // Web3Form Logic (Updated for translation)
    document.getElementById('web3form').addEventListener('submit', async (e) => {
      e.preventDefault();
    
      const form = e.target;
      const btn = form.querySelector('.submit-btn');
      const originalBtnText = currentLang === 'sk' ? 'Odoslať správu' : 'Send message';
    
      btn.disabled = true;
      btn.innerText = currentLang === 'sk' ? 'Odosielam...' : 'Transmitting...';
    
      const token = form.querySelector('[name="cf-turnstile-response"]')?.value?.trim();
    
      if (!token) {
        alert(currentLang === 'sk' ? 'Dokončite captcha.' : 'Complete the captcha first.');
        btn.disabled = false;
        btn.innerText = originalBtnText;
        return;
      }
  
      try {
        const r = await fetch('https://fcegvomhsjknxwazdydc.supabase.co/functions/v1/rapid-action', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: form.name.value.trim(),
            email: form.email.value.trim(),
            phone: form.phone?.value?.trim() || '',
            message: form.message.value.trim(),
            turnstileToken: token,
          }),
        });
    
        let data = {};
        try {
          data = await r.json();
        } catch (_) {
          data = {};
        }
    
        if (r.status === 429) {
          alert(
            data.message ||
            (currentLang === 'sk'
              ? 'Príliš veľa požiadaviek. Skúste to neskôr.'
              : 'Too many requests. Try again later.')
          );
          return;
        }
    
        if (!r.ok || !data.success) {
          alert(
            data.error ||
            data.message ||
            (currentLang === 'sk'
              ? 'Správu sa nepodarilo odoslať.'
              : 'Failed to send message.')
          );
          return;
        }
    
        alert(
          data.message ||
          (currentLang === 'sk'
            ? 'Správa bola úspešne odoslaná.'
            : 'Message sent successfully!')
        );
    
        form.reset();
    
        if (window.turnstile) {
          const widget = form.querySelector('.cf-turnstile');
          if (widget) {
            try {
              window.turnstile.reset(widget);
            } catch (_) {}
          }
        }
    
      } catch (err) {
        alert(
          currentLang === 'sk'
            ? 'Vyskytla sa chyba spojenia.'
            : 'Connection error occurred.'
        );
      } finally {
        btn.disabled = false;
        btn.innerText = originalBtnText;
      }
    });

    const filterBar = document.getElementById('filterBar');
    const gallerySection = document.getElementById('gallery-main');

    const galleryObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) {
                filterBar.classList.add('hidden');
            } else {
                filterBar.classList.remove('hidden');
            }
        });
    }, {
        root: null,
        threshold: 0.05 
    });


    // Start tracking the gallery section
    galleryObserver.observe(gallerySection);

    const photoModal = document.getElementById('photoModal');
    const photoModalImg = document.getElementById('photoModalImg');
    const photoModalTitle = document.getElementById('photoModalTitle');
    const photoModalLocation = document.getElementById('photoModalLocation');
    const photoModalTag = document.getElementById('photoModalTag');
    const photoModalClose = document.getElementById('photoModalClose');
    const photoModalBackdrop = document.getElementById('photoModalBackdrop');

    function bindPhotoProtection(root = document) {
      root.querySelectorAll('img').forEach((img) => {
        img.setAttribute('draggable', 'false');
    
        if (!img.dataset.protectedBound) {
          img.dataset.protectedBound = '1';
          img.addEventListener('dragstart', (e) => e.preventDefault());
          img.addEventListener('contextmenu', (e) => e.preventDefault());
        }
      });
    }
    
    document.addEventListener('contextmenu', (e) => {
      const img = e.target.closest && e.target.closest('img');
      if (img) e.preventDefault();
    });

    function openPhotoModal(photo) {
        const fullSrc = photo.fullImgUrl || photo.imgUrl.replace('/420/320', '/1400/1000');

        photoModalImg.src = fullSrc;
        photoModalImg.setAttribute('draggable', 'false');
        photoModalImg.alt = photo.title;
        photoModalTitle.textContent = photo.title;
        photoModalLocation.textContent = photo.location;
        photoModalTag.textContent = photo.tag || photo.category;

        photoModal.classList.add('open');
        photoModal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
    }

    function closePhotoModal() {
        photoModal.classList.remove('open');
        photoModal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
        photoModalImg.src = '';
    }

    photoModalClose.addEventListener('click', closePhotoModal);
    photoModalBackdrop.addEventListener('click', closePhotoModal);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && photoModal.classList.contains('open')) {
            closePhotoModal();
        }
    });

    // ==========================================
    // MULTILINGUAL SYSTEM 
    // ==========================================
    const translations = {
        "nav-portfolio": { en: "Portfolio", sk: "Portfólio" },
        "nav-story": { en: "Story", sk: "Príbeh" },
        "nav-blog": { en: "Blog", sk: "Blog" },
        "nav-contact": { en: "Contact", sk: "Kontakt" },
        "hero-title": { en: "Capturing the Architecture of Motion and Life.", sk: "Zachytávam architektúru pohybu a života." },
        "hero-subtitle": { en: "Automotive elegance, raw editorial portraits, and architectural street frames captured worldwide.", sk: "Automobilová elegance, syrové editoriální portréty a architektonické pouliční záběry zachycené po celém světě." },
        "hero-desc": { en: "Premium visual storytelling specializing in automotive drama, structural precision, and cinematic human portraits.", sk: "Prémiový vizuálny storytelling so špecializáciou na automotive drámu, štrukturálnu presnosť a kinematografické portréty ľudí." },
        "filter-all": { en: "All Projects", sk: "Všetko" },
        "filter-cars": { en: "Automotive", sk: "Automobily" },
        "filter-portraits": { en: "Portraits", sk: "Portréty" },
        "filter-urban": { en: "Urban Architecture", sk: "Mestská architektúra" },
        "toggle-grid": { en: "Standard Grid", sk: "Klasická mriežka" },
        "toggle-interactive": { en: "Interactive 3D", sk: "Interaktívne 3D" },
        "about-title": { en: "The Visionary Behind the Lens", sk: "Vizionár za objektívom" },
        "about-p1": { en: "I don't just snap photographs; I architect them. Based in the heart of Europe, my production workflow balances technical discipline with dramatic visual ambiance.", sk: "Fotografie nielen cvakám, ale ich tvorím. Pôsobím v srdci Európy a môj produkčný workflow vyvažuje technickú disciplínu s dramatickou vizuálnou atmosférou." },
        "about-p2": { en: "Every car line has an engineered intent. Every face tells a structural story. My mission is to translate physical matter into permanent digital legacy.", sk: "Každá línia auta má svoj inžiniersky zámer. Každá tvár rozpráva príbeh. Mojím poslaním je pretaviť fyzickú hmotu do trvalého digitálneho dedičstva." },
        "contact-title": { en: "Commission a Production", sk: "Objednať produkciu" },
        "contact-desc": { en: "Let's align creative frequencies. Drop a note regarding your project parameters.", sk: "Spojme naše kreatívne frekvencie. Napíšte mi parametre vášho projektu." },
        "contact-direct-title": { en: "Direct Channels", sk: "Priame kanály" },
        "placeholder-name": { en: "Your Identity / Company Name", sk: "Vaša identita / Názov spoločnosti" },
        "placeholder-email": { en: "Secure Contact Email", sk: "Zabezpečený kontaktný e-mail" },
        "placeholder-msg": { en: "Project specifications, deadlines, budget parameters...", sk: "Špecifikácie projektu, termíny, rozpočtové parametre..." },
        "btn-submit": { en: "Initiate Briefing", sk: "Odoslať zadanie" },
        "footer-text": { en: "© 2026 GERI PHOTOGRAPHY — Structural Artistry Production.", sk: "© 2026 GERI PHOTOGRAPHY — Produkcia štrukturálneho umenia." },
        "contact-btn": { en: "Send message →", sk: "Odoslať správu →" },
        "contact-brief": {en: "Drop a Brief",sk: "Napíšte správu"},
        "form-name": {en: "Full name *",sk: "Celé meno *"},
        "form-email": {en: "Email address *",sk: "Emailová adresa *"},
        "form-phone": {en: "Phone number (optional)",sk: "Telefónne číslo (voliteľné)"},
        "form-msg": {en: "Describe your creative project alignment...",sk: "Opíšte váš kreatívny projekt..."},
        "contact-btn": {en: "Send message →",sk: "Odoslať správu →"},
        "contact-matrix": {en: "Connect Matrix", sk: "Priame kontakty"},
        "photo-modal-kicker": {en: "GERI-SZ", sk: "GERI-SZ"},
        "about-hw": {en: "Premium Hardware Architecture Implementation", sk: "Neviem preklady zavinac pojeb si papulu"}
    };

    let currentLang = localStorage.getItem('selectedLanguage');

    if (!currentLang) {
        const userLang = navigator.language || navigator.userLanguage;
        currentLang = userLang.toLowerCase().startsWith('sk') ? 'sk' : 'en';
    }

    const btnSk = document.getElementById('lang-sk');
    const btnEn = document.getElementById('lang-en');

    function applyLanguage(lang) {
        // Save selection
        localStorage.setItem('selectedLanguage', lang);

        // Normal text translations
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');

            if (translations[key] && translations[key][lang]) {
                el.innerText = translations[key][lang];
            }
        });

        // Placeholder translations
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');

            if (translations[key] && translations[key][lang]) {
                el.placeholder = translations[key][lang];
            }
        });

        // Active language buttons
        if (lang === 'sk') {
            btnSk.classList.add('active');
            btnEn.classList.remove('active');
        } else {
            btnEn.classList.add('active');
            btnSk.classList.remove('active');
        }
    }

    // Event listeners for manual override clicks
    btnSk.addEventListener('click', () => applyLanguage('sk'));
    btnEn.addEventListener('click', () => applyLanguage('en'));

    // Run on page load
    applyLanguage(currentLang);
        (function () {
        const targetId = sessionStorage.getItem('geriScrollTarget');
        if (targetId) {
            sessionStorage.removeItem('geriScrollTarget');
            window.addEventListener('load', () => {
                const target = document.getElementById(targetId);
                if (target) {
                    requestAnimationFrame(() => {
                        target.scrollIntoView({
                          behavior: window.matchMedia('(max-width: 768px)').matches ? 'auto' : 'smooth',
                          block: 'start'
                        });
                    });
                }
            });
        }

        document.querySelectorAll('[data-scroll]').forEach(link => {
            link.addEventListener('click', (e) => {
                const targetId = link.getAttribute('data-scroll');
                const href = link.getAttribute('href') || '';
                const targetPage = href.split('#')[0];
                const currentPage = window.location.pathname.split('/').pop() || 'index.html';
                const samePage = targetPage === currentPage || (targetPage === 'index.html' && currentPage === 'index(17).html');

                if (samePage) {
                    e.preventDefault();
                    const target = document.getElementById(targetId);
                    if (target) target.scrollIntoView({
                        behavior: window.matchMedia('(max-width: 768px)').matches ? 'auto' : 'smooth',
                        block: 'start'
                    });
                    return;
                }

                sessionStorage.setItem('geriScrollTarget', targetId);
            });
        });
    })();