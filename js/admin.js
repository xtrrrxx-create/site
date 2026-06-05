// Admin dashboard logic. Fetches /api/stats with the saved token and renders.
(function () {
    const KEY = 'jf_admin_token';
    const $ = id => document.getElementById(id);

    let timer = null;

    function fmt(n) {
        n = Number(n) || 0;
        return n.toLocaleString('en-US');
    }

    async function load(token) {
        const res = await fetch('/api/stats?token=' + encodeURIComponent(token), { cache: 'no-store' });
        if (res.status === 401) throw new Error('Invalid token');
        if (!res.ok) throw new Error('Server error (' + res.status + ')');
        return res.json();
    }

    function render(data) {
        $('m-total').textContent = fmt(data.total_visits);
        $('m-unique').textContent = fmt(data.unique_visitors);
        $('m-today').textContent = fmt(data.today_visits);
        $('m-online').textContent = fmt(data.online_now);

        const body = $('top-body');
        body.innerHTML = '';
        const items = Array.isArray(data.top_items) ? data.top_items : [];
        if (!items.length) {
            $('top-empty').textContent = 'No clicks recorded yet.';
        } else {
            $('top-empty').textContent = '';
            items.forEach((it, i) => {
                const tr = document.createElement('tr');
                const rank = document.createElement('td'); rank.className = 'rank'; rank.textContent = (i + 1);
                const title = document.createElement('td'); title.textContent = (it.title || '').slice(0, 80);
                const clicks = document.createElement('td'); clicks.className = 'num'; clicks.textContent = fmt(it.clicks);
                tr.appendChild(rank); tr.appendChild(title); tr.appendChild(clicks);
                body.appendChild(tr);
            });
        }
        const now = new Date();
        $('updated').textContent = 'Updated ' + now.toLocaleTimeString();
    }

    async function refresh() {
        const token = localStorage.getItem(KEY);
        if (!token) return showGate();
        try {
            const data = await load(token);
            render(data);
        } catch (e) {
            if (/Invalid token/.test(e.message)) { localStorage.removeItem(KEY); showGate('Token rejected.'); }
            else $('updated').textContent = 'Error: ' + e.message;
        }
    }

    function showDash() {
        $('gate').classList.add('hidden');
        $('dash').classList.remove('hidden');
        refresh();
        if (timer) clearInterval(timer);
        timer = setInterval(refresh, 30000);
    }

    function showGate(err) {
        if (timer) { clearInterval(timer); timer = null; }
        $('dash').classList.add('hidden');
        $('gate').classList.remove('hidden');
        $('gate-err').textContent = err || '';
    }

    $('login').addEventListener('click', async () => {
        const token = $('token').value.trim();
        if (!token) return;
        $('gate-err').textContent = 'Checking…';
        try {
            await load(token);
            localStorage.setItem(KEY, token);
            $('token').value = '';
            showDash();
        } catch (e) {
            $('gate-err').textContent = e.message;
        }
    });
    $('token').addEventListener('keydown', e => { if (e.key === 'Enter') $('login').click(); });
    $('refresh').addEventListener('click', refresh);
    $('logout').addEventListener('click', () => { localStorage.removeItem(KEY); showGate(); });

    // Auto-open if a token is already saved.
    if (localStorage.getItem(KEY)) showDash(); else showGate();
})();
