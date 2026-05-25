let shortcuts = [];
let accessStats = JSON.parse(localStorage.getItem('accessStats')) || {};
let selectedIndex = -1;

const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const shortcutsGrid = document.getElementById('shortcutsGrid');
const recentList = document.getElementById('recentList');
const mostAccessedList = document.getElementById('mostAccessedList');
const topElement = document.getElementById('typingTextTop');
const bottomElement = document.getElementById('typingTextBottom');

const topText = 'Digite aqui o que você está procurando.';
const bottomText = 'E selecione o item na lista abaixo.';

let topIndex = 0;
let bottomIndex = 0;
let typingStarted = false;

function createShortcutId(shortcut) {
    const source = `${shortcut.name || ''}|${shortcut.url || ''}`;
    let hash = 0;

    for (let i = 0; i < source.length; i++) {
        hash = ((hash << 5) - hash) + source.charCodeAt(i);
        hash |= 0;
    }

    return `link-${Math.abs(hash)}`;
}

function normalizeText(text = '') {
    return String(text)
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function normalizeLinks(links) {
    if (!Array.isArray(links)) return [];

    return links
        .filter(item => item && item.name && item.url)
        .map(item => ({
            id: item.id || createShortcutId(item),
            name: String(item.name).trim(),
            url: String(item.url).trim(),
            keywords: Array.isArray(item.keywords)
                ? item.keywords.map(keyword => String(keyword).trim())
                : []
        }));
}

function isSafeUrl(url) {
    try {
        const parsed = new URL(url, window.location.href);
        return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol);
    } catch {
        return false;
    }
}

async function loadLinks() {
    try {
        showLoadingState();

        const response = await fetch('links.json', {
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error('Não foi possível carregar o links.json');
        }

        const links = await response.json();
        shortcuts = normalizeLinks(links);

        renderShortcuts();
        updateStats();
        focusSearchInput();
    } catch (error) {
        shortcutsGrid.innerHTML = '';

        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'Não foi possível carregar os links. Verifique o arquivo links.json.';
        shortcutsGrid.appendChild(empty);

        recentList.innerHTML = '<div class="stat-empty">Nenhum acesso</div>';
        mostAccessedList.innerHTML = '<div class="stat-empty">Nenhum acesso</div>';

        console.error(error);
    }
}

function showLoadingState() {
    shortcutsGrid.innerHTML = '';

    const loading = document.createElement('div');
    loading.className = 'empty-state';
    loading.textContent = 'Carregando links...';
    shortcutsGrid.appendChild(loading);
}

function getFilteredShortcuts(filter = '') {
    const search = normalizeText(filter);

    if (!search) return shortcuts;

    return shortcuts.filter(shortcut => {
        const searchableText = [
            shortcut.name,
            ...(shortcut.keywords || [])
        ].join(' ');

        return normalizeText(searchableText).includes(search);
    });
}

function renderShortcuts(filter = '') {
    const filtered = getFilteredShortcuts(filter);

    shortcutsGrid.innerHTML = '';

    if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = filter ? 'Nenhum material encontrado' : 'Nenhum material disponível';
        shortcutsGrid.appendChild(empty);
        selectedIndex = -1;
        return;
    }

    filtered.forEach(shortcut => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'shortcut-card';
        card.title = shortcut.name;
        card.setAttribute('aria-label', `Abrir ${shortcut.name}`);

        const name = document.createElement('span');
        name.className = 'shortcut-name';
        name.textContent = shortcut.name;

        card.appendChild(name);
        card.addEventListener('click', () => openShortcut(shortcut));

        shortcutsGrid.appendChild(card);
    });

    selectedIndex = filter && filtered.length > 0 ? 0 : -1;
    updateSelection();
}

function updateSelection() {
    document.querySelectorAll('.shortcut-card').forEach((card, index) => {
        card.classList.toggle('selected', index === selectedIndex);
    });
}

function openShortcut(shortcut) {
    if (!isSafeUrl(shortcut.url)) {
        alert('Link inválido ou não permitido.');
        return;
    }

    trackAccess(shortcut.id);
    window.location.href = shortcut.url;
}

function trackAccess(id) {
    if (!accessStats[id]) {
        accessStats[id] = {
            count: 0,
            lastAccess: Date.now()
        };
    }

    accessStats[id].count++;
    accessStats[id].lastAccess = Date.now();

    localStorage.setItem('accessStats', JSON.stringify(accessStats));
    updateStats();
}

function createStatCard(shortcut, showCount = false) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'stat-card';
    card.title = shortcut.name;
    card.setAttribute('aria-label', `Abrir ${shortcut.name}`);

    const name = document.createElement('span');
    name.className = 'stat-card-name';
    name.textContent = shortcut.name;
    card.appendChild(name);

    if (showCount) {
        const count = document.createElement('span');
        count.className = 'stat-card-count';
        count.textContent = `${shortcut.stats.count}x`;
        card.appendChild(count);
    }

    card.addEventListener('click', () => openShortcut(shortcut));

    return card;
}

function updateStats() {
    const withStats = shortcuts.map(shortcut => ({
        ...shortcut,
        stats: accessStats[shortcut.id] || {
            count: 0,
            lastAccess: 0
        }
    }));

    const recent = [...withStats]
        .filter(shortcut => shortcut.stats.lastAccess > 0)
        .sort((a, b) => b.stats.lastAccess - a.stats.lastAccess)
        .slice(0, 5);

    const mostAccessed = [...withStats]
        .filter(shortcut => shortcut.stats.count > 0)
        .sort((a, b) => b.stats.count - a.stats.count)
        .slice(0, 5);

    recentList.innerHTML = '';
    mostAccessedList.innerHTML = '';

    if (recent.length === 0) {
        recentList.innerHTML = '<div class="stat-empty">Nenhum acesso</div>';
    } else {
        recent.forEach(shortcut => recentList.appendChild(createStatCard(shortcut)));
    }

    if (mostAccessed.length === 0) {
        mostAccessedList.innerHTML = '<div class="stat-empty">Nenhum acesso</div>';
    } else {
        mostAccessed.forEach(shortcut => mostAccessedList.appendChild(createStatCard(shortcut, true)));
    }
}

function moveTabSelection(direction = 1) {
    const filtered = getFilteredShortcuts(searchInput.value);

    if (!filtered.length) return;

    if (selectedIndex === -1) {
        selectedIndex = 0;
    } else {
        selectedIndex += direction;
    }

    if (selectedIndex >= filtered.length) selectedIndex = 0;
    if (selectedIndex < 0) selectedIndex = filtered.length - 1;

    updateSelection();
    scrollSelectedCardIntoView();
}

function submitSearch() {
    const filtered = getFilteredShortcuts(searchInput.value);

    if (!filtered.length) return;

    const shortcut =
        selectedIndex >= 0 && filtered[selectedIndex]
            ? filtered[selectedIndex]
            : filtered[0];

    openShortcut(shortcut);
}

function scrollSelectedCardIntoView() {
    const selectedCard = shortcutsGrid.querySelector('.shortcut-card.selected');

    if (!selectedCard) return;

    selectedCard.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
    });
}

function focusSearchInput() {
    if (!searchInput) return;

    searchInput.focus({
        preventScroll: true
    });
}

function typeTop() {
    if (!topElement) return;

    if (topIndex < topText.length) {
        topElement.textContent += topText[topIndex];
        topIndex++;

        setTimeout(typeTop, 45);
        return;
    }

    setTimeout(typeBottom, 350);
}

function typeBottom() {
    if (!bottomElement) return;

    if (bottomIndex < bottomText.length) {
        bottomElement.textContent += bottomText[bottomIndex];
        bottomIndex++;

        setTimeout(typeBottom, 35);
    }
}

function startTypingAnimation() {
    if (typingStarted) return;

    typingStarted = true;
    setTimeout(typeTop, 500);
}

function focusSearchInput() {
    if (!searchInput) return;

    searchInput.focus({
        preventScroll: true
    });
}

searchInput.addEventListener('input', event => {
    renderShortcuts(event.target.value);
});

searchInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
        event.preventDefault();
        submitSearch();
        return;
    }

    if (event.key === 'Tab') {
        event.preventDefault();
        moveTabSelection(event.shiftKey ? -1 : 1);
    }
});

if (searchButton) {
    searchButton.addEventListener('click', submitSearch);
}

window.addEventListener('load', () => {
    focusSearchInput();
    startTypingAnimation();
});

window.addEventListener('pageshow', () => {
    focusSearchInput();
});

loadLinks();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('./service-worker.js')
            .then(registration => {
                console.log('Service Worker registrado:', registration.scope);
            })
            .catch(error => {
                console.error('Erro ao registrar Service Worker:', error);
            });
    });
}