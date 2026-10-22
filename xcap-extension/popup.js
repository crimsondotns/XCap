// Lucide icons (ISC), inlined - MV3 forbids remote code, so there is no
// stylesheet or sprite to pull in.
const ICONS = {
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>'
        + '<polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>'
        + '<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    link: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/>'
        + '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    reload: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>'
        + '<path d="M12 9v4"/><path d="M12 17h.01"/>'
};

const SVG_NS = 'http://www.w3.org/2000/svg';

function icon(name, size, width) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', width || 2);
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.innerHTML = ICONS[name];
    return svg;
}

// The app's mark - the same blade the web header draws, bare rather than on
// the icon's rounded ground: the popup is already dark, so a ground behind
// it would only be a square nobody can see the edges of.
function mark() {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 128 128');
    svg.setAttribute('width', '26');
    svg.setAttribute('height', '26');
    svg.innerHTML =
        '<path fill="#f5f5f7" stroke="#f5f5f7" stroke-width="1.5" '
        + 'stroke-linejoin="round" d="M103.6 24.4 L82 64 L103.6 103.6 L64 82 '
        + 'L24.4 103.6 L46 64 L24.4 24.4 L64 46 Z"/>';
    return svg;
}

document.getElementById('mark').appendChild(mark());
document.getElementById('i-save').appendChild(icon('save', 13));
document.getElementById('i-show').appendChild(icon('reload', 15));
document.querySelectorAll('[data-check]').forEach(box => {
    box.appendChild(icon('check', 12, 3));
});

// popup.js also runs under tools/render.js, which has no chrome.* at all
if (typeof chrome === 'undefined' || !chrome.storage) {
    document.getElementById('deriveAvatar').checked = true;
    document.getElementById('nativeAsUcid').checked = true;
} else {
    start();
}

function start() {
    const DEFAULTS = {
        deriveAvatar: true,
        nativeAsUcid: true
    };
    const TOGGLES = ['deriveAvatar', 'nativeAsUcid'];
    const statusBar = document.getElementById('status');

    // XC-1xx page/tab, XC-2xx capture, XC-3xx settings. ERRORS.md at the
    // repo root explains each one; keep the two in step.
    const STRINGS = {
        en: {
            'avatar.name': 'Build avatar URLs from the CMC id',
            'avatar.why': 'Only when the page carries none of its own',
            'ucid.name': 'Native coins get UCID=<id>',
            'ucid.why': 'BTC and the like have no contract for that column',
            save: 'Save',
            scan: 'Scan',
            saved: 'Saved — applies to open tabs',
            started: 'Scan started',
            footer: 'The page stays clean. Open a <b>DexScreener</b> pool or a '
                + '<b>CoinMarketCap</b> coin, then press <b>Scan</b> — nothing is captured on load.',
            'XC-101': 'Not a supported page',
            'XC-102': 'Reload the tab, then Scan',
            'XC-103': 'No active tab',
            'XC-301': 'Save failed',
            pools: 'Pools captured',
            waiting: 'Nothing captured yet. Switch the chart timeframe (1m / 5m / 1D) if its request already fired.',
            loading: 'loading…',
            copyTsv: 'Copy TSV',
            copyAll: 'Copy all',
            copied: 'Copied',
            contract: 'Contract',
            pool: 'Pool',
            quote: 'Quote',
            supply: 'Circulating',
            total: 'Total supply'
        },
        th: {
            'avatar.name': 'สร้าง URL รูป​เหรียญ​จาก CMC id',
            'avatar.why': 'ใช้​เฉพาะ​ตอน​ที่​หน้า​เว็บ​ไม่​มี​รูป​มา​ให้',
            'ucid.name': 'เหรียญ native ใช้ UCID=<id>',
            'ucid.why': 'BTC และ​เหรียญ​แบบ​เดียวกัน​ไม่​มี contract สำหรับ​คอลัมน์​นั้น',
            save: 'บันทึก',
            scan: 'สแกน',
            saved: 'บันทึก​แล้ว — ใช้​กับ​แท็บ​ที่​เปิด​อยู่​ทันที',
            started: 'เริ่มสแกนแล้ว',
            footer: 'หน้า​เว็บ​จะ​ไม่​ถูก​แตะต้อง เปิด​หน้า pool ของ <b>DexScreener</b> หรือ​หน้า​เหรียญ​ของ '
                + '<b>CoinMarketCap</b> แล้ว​กด <b>สแกน</b> — จะ​ไม่​ดัก​อะไร​ตอน​โหลด​หน้า',
            'XC-101': 'ไม่​ใช่​หน้า​เว็บ​ที่​รองรับ',
            'XC-102': 'รีเฟรช​แท็บ​ก่อน แล้ว​กด​สแกน',
            'XC-103': 'ไม่​พบ​แท็บ​ที่​ใช้งาน​อยู่',
            'XC-301': 'บันทึก​ไม่​สำเร็จ',
            pools: 'พูล​ที่​ดัก​ได้',
            waiting: 'ยัง​ไม่​มี​ข้อมูล ลอง​สลับ timeframe ของ​กราฟ (1m / 5m / 1D) ถ้า​กราฟ​โหลด​ไป​ก่อน​แล้ว',
            loading: 'กำลัง​โหลด…',
            copyTsv: 'คัดลอก TSV',
            copyAll: 'คัดลอก​ทั้งหมด',
            copied: 'คัดลอก​แล้ว',
            contract: 'Contract',
            pool: 'Pool',
            quote: 'Quote',
            supply: 'หมุนเวียน',
            total: 'ทั้งหมด'
        }
    };
    let lang = 'en';
    const t = key => STRINGS[lang][key] || STRINGS.en[key] || key;
    // The error on screen is redrawn in the new language, not cleared.
    let shownError = '';

    function applyLang() {
        document.documentElement.lang = lang;
        syncLangMenu();
        document.querySelectorAll('[data-i18n]').forEach(el => {
            el.textContent = t(el.getAttribute('data-i18n'));
        });
        // Only ever our own strings above, never page or user text.
        document.querySelectorAll('[data-i18n-html]').forEach(el => {
            el.innerHTML = t(el.getAttribute('data-i18n-html'));
        });
        if (shownError) fail(shownError);
        if (typeof drawResults === 'function' && snapshot) drawResults();
    }

    chrome.storage.local.get({ lang: 'en' }, stored => {
        lang = STRINGS[stored.lang] ? stored.lang : 'en';
        applyLang();
    });
    // A listbox built by hand, so it follows the design system instead of
    // Chrome's native list: click or arrow keys to move, Enter to pick,
    // Escape or a click elsewhere to close.
    const langButton = document.getElementById('lang');
    const langList = document.getElementById('langList');
    const langItems = [...langList.querySelectorAll('li')];
    langButton.querySelector('#i-lang').appendChild(icon('chevron', 16));
    langItems.forEach(li => {
        li.id = 'lang-' + li.dataset.value;
        li.appendChild(icon('check', 16));
    });
    let activeIndex = 0;

    function syncLangMenu() {
        const current = langItems.find(li => li.dataset.value === lang) || langItems[0];
        document.getElementById('langLabel').textContent = current.textContent;
        langItems.forEach(li => li.setAttribute('aria-selected', String(li === current)));
    }

    function setActive(i) {
        activeIndex = (i + langItems.length) % langItems.length;
        langItems.forEach((li, j) => li.classList.toggle('active', j === activeIndex));
        langList.setAttribute('aria-activedescendant', langItems[activeIndex].id);
    }

    function openMenu() {
        langList.hidden = false;
        langButton.setAttribute('aria-expanded', 'true');
        setActive(Math.max(0, langItems.findIndex(li => li.dataset.value === lang)));
        langList.focus();
    }

    function closeMenu(refocus) {
        langList.hidden = true;
        langButton.setAttribute('aria-expanded', 'false');
        if (refocus) langButton.focus();
    }

    function pick(value) {
        closeMenu(true);
        if (value === lang) return;
        lang = value;
        chrome.storage.local.set({ lang });
        applyLang();
    }

    langButton.addEventListener('click', () => {
        if (langList.hidden) openMenu(); else closeMenu(true);
    });
    langButton.addEventListener('keydown', event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            openMenu();
        }
    });
    langList.addEventListener('keydown', event => {
        if (event.key === 'ArrowDown') { event.preventDefault(); setActive(activeIndex + 1); }
        else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(activeIndex - 1); }
        else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            pick(langItems[activeIndex].dataset.value);
        } else if (event.key === 'Escape' || event.key === 'Tab') closeMenu(event.key === 'Escape');
    });
    langItems.forEach((li, i) => {
        li.addEventListener('mouseenter', () => setActive(i));
        li.addEventListener('click', () => pick(li.dataset.value));
    });
    document.addEventListener('click', event => {
        if (!langList.hidden && !event.target.closest('.menu')) closeMenu(false);
    });
    let sayTimer = 0;

    function say(text, iconName) {
        clearTimeout(sayTimer);
        shownError = '';
        statusBar.className = '';
        statusBar.textContent = '';
        statusBar.appendChild(icon(iconName, 11));
        statusBar.appendChild(document.createTextNode(text));
        sayTimer = setTimeout(() => { statusBar.textContent = ''; }, 2400);
    }

    // Errors stay until something replaces them: a code that vanishes in
    // two seconds cannot be looked up.
    function fail(code) {
        clearTimeout(sayTimer);
        shownError = code;
        statusBar.className = 'error';
        statusBar.textContent = '';
        statusBar.appendChild(icon('alert', 11));
        const tag = document.createElement('code');
        tag.textContent = code;
        statusBar.appendChild(tag);
        statusBar.appendChild(document.createTextNode(t(code)));
    }

    // tab.url is only readable on hosts the manifest grants, so any other
    // page comes back without one - which is exactly the unsupported case.
    const SUPPORTED = /^https:\/\/([a-z0-9-]+\.)*(dexscreener|coinmarketcap)\.com\//i;
    const scanButton = document.getElementById('show');
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (!tab) { scanButton.disabled = true; fail('XC-103'); return; }
        if (!SUPPORTED.test(tab.url || '')) { scanButton.disabled = true; fail('XC-101'); return; }
        if (/dexscreener\.com\//i.test(tab.url)) watchResults(tab.id);
    });

    // ---- results --------------------------------------------------------
    // DexScreener no longer gets a panel over the page: the popup asks the
    // tab for what it has captured, once a second while it is open.
    const results = document.getElementById('results');
    const resultList = document.getElementById('resultList');
    let snapshot = null;

    function watchResults(tabId) {
        const poll = () => chrome.tabs.sendMessage(tabId, { type: 'xcap:get' }, { frameId: 0 }, reply => {
            if (chrome.runtime.lastError || !reply) return;
            const key = JSON.stringify(reply);
            if (snapshot && key === JSON.stringify(snapshot)) return;   // nothing new: keep scroll
            snapshot = reply;
            drawResults();
        });
        poll();
        setInterval(poll, 1000);
    }

    function el(tag, cls, text) {
        const node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        return node;
    }

    async function copy(text, button) {
        try {
            await navigator.clipboard.writeText(text);
            if (button) flash(button);
            say(t('copied'), 'check');
            return true;
        } catch (e) {
            say('Copy failed', 'alert');
            return false;
        }
    }

    // A placeholder ('—', loading) is not a value: muted, and in sans so
    // Thai never falls into the mono stack.
    function kv(label, value, mono, figure, empty) {
        const row = el('div', 'kv');
        row.appendChild(el('span', 'k', label));
        row.appendChild(el('span', empty ? 'v empty' : mono ? 'v mono' : figure ? 'v num' : 'v', value));
        return row;
    }

    // Whole tokens with grouping, as the web app shows them; the raw figure
    // goes on the clipboard through TSV/JSON untouched.
    function qty(raw, pending) {
        if (!raw) return pending ? t('loading') : '—';
        const n = Number(raw);
        return Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : raw;
    }

    function drawResults() {
        if (!snapshot || (!snapshot.listening && !snapshot.rows.length)) { results.hidden = true; return; }
        results.hidden = false;
        const rows = snapshot.rows;
        document.getElementById('resultCount').textContent = String(rows.length);
        resultList.textContent = '';
        if (!rows.length) {
            resultList.appendChild(el('li', 'empty', t('waiting')));
        }
        rows.forEach(row => {
            const card = el('li', 'pool');
            const head = el('div', 'pool-head');
            const names = el('div', 'names');
            const sym = el('div', 'sym', row.symbol || row.dexId);
            sym.title = sym.textContent;
            names.appendChild(sym);
            names.appendChild(el('div', 'sub', row.dexId + ' · ' + row.chain));
            head.appendChild(names);
            const tsv = el('button', 'chip');
            tsv.type = 'button';
            tsv.appendChild(icon('copy', 14));
            // Icon only, so the name goes on the button for hover and readers.
            tsv.title = t('copyTsv');
            tsv.setAttribute('aria-label', t('copyTsv'));
            tsv.addEventListener('click', () => copy(row.tsv, tsv));
            head.appendChild(tsv);
            card.appendChild(head);
            card.appendChild(kv(t('contract'), row.contract || (row.pending ? t('loading') : '—'), true, false, !row.contract));
            card.appendChild(kv(t('pool'), row.pool || '—', true, false, !row.pool));
            card.appendChild(kv(t('quote'), row.quote || '—', true, false, !row.quote));
            card.appendChild(kv(t('supply'), qty(row.supply, row.pending), false, true, !row.supply));
            card.appendChild(kv(t('total'), qty(row.totalSupply, row.pending), false, true, !row.totalSupply));
            resultList.appendChild(card);
        });
        document.getElementById('copyAll').disabled = !rows.length;
    }

    const allTsv = () => (snapshot ? snapshot.rows.map(row => row.tsv).join('\n') : '');
    document.getElementById('copyAll').addEventListener('click', event => copy(allTsv(), event.currentTarget));

    function flash(button) {
        button.classList.add('ok');
        setTimeout(() => button.classList.remove('ok'), 1200);
    }

    chrome.storage.local.get(DEFAULTS, config => {
        TOGGLES.forEach(key => { document.getElementById(key).checked = !!config[key]; });
    });

    document.getElementById('save').addEventListener('click', event => {
        const config = {};
        TOGGLES.forEach(key => { config[key] = document.getElementById(key).checked; });

        chrome.storage.local.set(config, () => {
            if (chrome.runtime.lastError) { fail('XC-301'); return; }
            // an open tab picks this up through storage.onChanged, so a page
            // already loaded does not need reloading
            flash(event.currentTarget);
            say(t('saved'), 'check');
        });
    });

    document.getElementById('show').addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) { fail('XC-103'); return; }
        // On a supported site this only fails when the tab was open before
        // the extension was installed or reloaded, so the script is missing.
        chrome.tabs.sendMessage(tab.id, { type: 'xcap:show' }, () => {
            if (chrome.runtime.lastError) fail('XC-102');
            else say(t('started'), 'check');
        });
    });
}
