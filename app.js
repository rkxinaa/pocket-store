const API_URL = 'https://jsonplaceholder.typicode.com/users';

let users = [];

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((reg) => console.log('Service Worker registrado:', reg.scope))
            .catch((error) => console.error('Error al registrar el Service Worker:', error));
    });
} else {
    console.warn('Este navegador no soporta Service Workers.');
}

async function getCachedUsers() {
    if (!('caches' in window)) return null;

    const cached = await caches.match(API_URL, { ignoreSearch: true, ignoreVary: true });
    return cached ? await cached.json() : null;
}

async function fetchUsers() {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(API_URL, { signal: controller.signal });
        clearTimeout(timer);

        if (!response.ok) {
            throw new Error(`Error en la petición: ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error('La respuesta no tiene el formato esperado.');
        }

        return data;
    } catch (error) {
        console.warn('Sin respuesta de la red, buscando en caché:', error.message);

        const cachedUsers = await getCachedUsers();
        if (Array.isArray(cachedUsers)) return cachedUsers;

        throw error;
    }
}

function getInitials(name) {
    return name
        .split(' ')
        .slice(0, 2)
        .map((word) => word[0])
        .join('')
        .toUpperCase();
}

function renderUsers(list) {
    const container = document.getElementById('catalog');
    if (!container) return;

    container.innerHTML = '';

    if (list.length === 0) {
        container.innerHTML = '<p class="message">No se encontraron resultados.</p>';
        return;
    }

    list.forEach((user) => {
        const card = document.createElement('article');
        card.className = 'card';
        card.innerHTML = `
            <div class="avatar">${getInitials(user.name)}</div>
            <h3>${user.name}</h3>
            <p class="company">${user.company?.name ?? 'Sin empresa'}</p>
            <ul>
                <li><strong>Email:</strong> ${user.email}</li>
                <li><strong>Teléfono:</strong> ${user.phone}</li>
                <li><strong>Ciudad:</strong> ${user.address?.city ?? 'N/D'}</li>
            </ul>
        `;
        container.appendChild(card);
    });
}

function renderError(message) {
    const container = document.getElementById('catalog');
    if (container) {
        container.innerHTML = `<p class="error">${message}</p>`;
    }
}

function renderInfo(text, isWarning = false) {
    const info = document.getElementById('info');
    info.textContent = text;
    info.className = isWarning ? 'info warning' : 'info';
}

function updateStatus() {
    const status = document.getElementById('status');
    if (navigator.onLine) {
        status.textContent = 'En línea';
        status.className = 'status online';
    } else {
        status.textContent = 'Sin conexión';
        status.className = 'status offline';
    }
}

function filterUsers(text) {
    const value = text.toLowerCase().trim();
    const result = users.filter((user) =>
        user.name.toLowerCase().includes(value) ||
        (user.address?.city ?? '').toLowerCase().includes(value)
    );
    renderUsers(result);
}

async function loadCatalog() {
    const button = document.getElementById('btn-reload');
    button.disabled = true;
    renderInfo('Cargando...');

    try {
        users = await fetchUsers();
        renderUsers(users);

        if (navigator.onLine) {
            renderInfo(`${users.length} registros cargados.`);
        } else {
            renderInfo(`Sin conexión: mostrando ${users.length} registros guardados.`, true);
        }
    } catch (error) {
        console.error('Error al cargar el catálogo:', error);

        if (!navigator.onLine) {
            renderError('Sin conexión y sin datos guardados. Conéctate a internet y vuelve a intentar.');
        } else {
            renderError('No se pudo cargar el catálogo. Intenta de nuevo más tarde.');
        }
        renderInfo('');
    } finally {
        button.disabled = false;
    }
}

function initApp() {
    updateStatus();
    loadCatalog();

    document.getElementById('search').addEventListener('input', (e) => filterUsers(e.target.value));
    document.getElementById('btn-reload').addEventListener('click', loadCatalog);

    window.addEventListener('online', () => {
        updateStatus();
        loadCatalog();
    });
    window.addEventListener('offline', updateStatus);
}

document.addEventListener('DOMContentLoaded', initApp);