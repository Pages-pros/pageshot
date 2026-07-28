import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, get, child } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDhmxq-NlbBbiUHD-gho55LJJTEGhyT2hw",
    authDomain: "loja-071.firebaseapp.com",
    projectId: "loja-071",
    storageBucket: "loja-071.firebasestorage.app",
    messagingSenderId: "1045820766264",
    appId: "1:1045820766264:web:41545e9409dae41e9e8ecd",
    measurementId: "G-XM9W4EGQ6P",
    databaseURL: "https://loja-071-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

function sanitize(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
}

async function getCars() {
    const dbRef = ref(db);
    try {
        const snapshot = await get(child(dbRef, `cars`));
        if (snapshot.exists()) {
            return snapshot.val();
        } else {
            return getDefaultCars();
        }
    } catch (error) {
        console.error(error);
        return getDefaultCars(); // fallback se a database estiver vazia ou offline
    }
}

function getDefaultCars() {
    return [
        { id: 1, name: 'Corolla', category: 'basico', price: 'R$ 99,90', image: 'assets/corolla_basico_1785255293243.png', description: 'O sedã lendário, rebaixado com rodas premium e sistema de som pesado no porta-malas.' },
        { id: 2, name: 'Jetta 2024', category: 'basico', price: 'R$ 99,90', image: 'assets/jetta_basico_1785255304769.png', description: 'Design agressivo, molas esportivas e kit aerodinâmico.' },
        { id: 3, name: 'Hyundai Elantra 2024', category: 'basico', price: 'R$ 99,90', image: 'assets/elantra_basico_1785255315146.png', description: 'Visual futurista com LED âmbar, suspensão a ar e muito grave.' },
        { id: 4, name: 'Tiguan', category: 'basico', price: 'R$ 99,90', image: 'assets/tiguan_basico_1785255326978.png', description: 'SUV de luxo modificada para raspar no chão, com muito conforto.' },
        { id: 5, name: 'Saveiro Cross', category: 'basico', price: 'R$ 99,90', image: 'assets/saveiro_basico_1785255337024.png', description: 'A clássica picape da 071, paredão na caçamba e estilo inconfundível.' },
        { id: 6, name: 'S10 Chevrolet', category: 'basico', price: 'R$ 99,90', image: 'assets/s10_basico_1785255356747.png', description: 'Bruta e rebaixada, pronta para os encontros automotivos.' },
        { id: 7, name: 'Tetra', category: 'basico', price: 'R$ 99,90', image: 'assets/tetra_basico_1785255366812.png', description: 'Esportivo compacto com aceleração insana e visual de pista.' },
        
        { id: 8, name: 'Ranger', category: 'intermediario', price: 'R$ 129,90', image: 'assets/ranger_intermediario_1785255377669.png', description: 'Picape americana com projeto de som absurdo e rodas cromadas.' },
        { id: 9, name: 'Tera', category: 'intermediario', price: 'R$ 129,90', image: 'assets/tera_intermediario_1785255387435.png', description: 'O equilíbrio perfeito entre SUV de luxo e carro de som.' },
        { id: 10, name: 'Hilux SRX', category: 'intermediario', price: 'R$ 129,90', image: 'assets/hilux_intermediario_1785255397296.png', description: 'A queridinha do Brasil, paredão na traseira e presença garantida.' },
        { id: 11, name: 'Toro', category: 'intermediario', price: 'R$ 129,90', image: 'assets/toro_intermediario_1785255416165.png', description: 'Visual urbano com caçamba ocupada 100% por alto-falantes.' },
        { id: 12, name: 'RAM', category: 'intermediario', price: 'R$ 129,90', image: 'assets/ram_intermediario_1785255425855.png', description: 'O monstro das ruas. Suspensão a ar e paredão de respeito.' },
        
        { id: 13, name: 'SW4 2024', category: 'premium', price: 'R$ 159,90', image: 'assets/sw4_2024_premium_1785255435977.png', description: 'O auge do luxo e exclusividade, modificada com peças fibra de carbono.' },
        { id: 14, name: 'SW4 2015', category: 'premium', price: 'R$ 159,90', image: 'assets/saveiro_basico_1785255337024.png', description: 'A lenda das SUVs, com um projeto de som voltado para qualidade extrema.' },
        { id: 15, name: 'L200 Triton', category: 'premium', price: 'R$ 159,90', image: 'assets/saveiro_basico_1785255337024.png', description: 'Design arrojado, muito torque e um paredão que treme o chão.' }
    ];
}

async function renderShowcase() {
    const cars = await getCars();
    const catalogGrid = document.getElementById('catalogGrid');

    if (!catalogGrid) return;
    catalogGrid.innerHTML = '';

    cars.forEach(car => {
        const fallbackImg = "https://via.placeholder.com/400x250/222222/FFD700?text=LOJA+DA+071";
        
        const card = document.createElement('div');
        card.className = 'car-card fade-in';
        card.setAttribute('data-category', car.category); // Importante para o filtro
        card.innerHTML = `
            <div class="car-badge">${sanitize(car.category.toUpperCase())}</div>
            <div class="car-img-wrapper">
                <img src="${sanitize(car.image)}" alt="${sanitize(car.name)}" class="car-img" onerror="this.src='${fallbackImg}'">
                <div class="car-glow"></div>
            </div>
            <div class="car-info">
                <h3 class="car-name">${sanitize(car.name)}</h3>
                <p class="car-desc">${sanitize(car.description)}</p>
                <div class="car-footer">
                    <span class="car-price">${sanitize(car.price)}</span>
                    <a href="https://discord.gg/x5BKZu4VRG" target="_blank" class="btn-primary" style="text-decoration: none;">Comprar</a>
                </div>
            </div>
        `;

        catalogGrid.appendChild(card);
    });

    // Lógica dos Filtros
    const filterBtns = document.querySelectorAll('.filter-btn');
    const carCards = document.querySelectorAll('.car-card');

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remover classe active de todos os botões
            filterBtns.forEach(b => b.classList.remove('active'));
            // Adicionar active no botão clicado
            btn.classList.add('active');

            const filterValue = btn.getAttribute('data-filter');

            carCards.forEach(card => {
                if (filterValue === 'all' || card.getAttribute('data-category') === filterValue) {
                    card.style.display = 'block';
                    setTimeout(() => {
                        card.style.opacity = '1';
                        card.style.transform = 'translateY(0)';
                    }, 50);
                } else {
                    card.style.display = 'none';
                    card.style.opacity = '0';
                    card.style.transform = 'translateY(20px)';
                }
            });
        });
    });

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    });
    
    document.querySelectorAll('.car-card').forEach(el => observer.observe(el));

    // Iniciar Carrossel Automático da Foto Central no Hero
    startHeroCarousel(cars);
}

function startHeroCarousel(cars) {
    const heroImg = document.getElementById('heroImage');
    if (!heroImg || !cars || cars.length === 0) return;

    const validImages = cars.map(c => c.image).filter(img => img && img.trim() !== '');
    if (validImages.length <= 1) return;

    let currentIndex = 0;

    setInterval(() => {
        currentIndex = (currentIndex + 1) % validImages.length;
        
        // Efeito de transição suave
        heroImg.style.opacity = '0';
        heroImg.style.transform = 'scale(0.98)';
        
        setTimeout(() => {
            heroImg.src = validImages[currentIndex];
            heroImg.style.opacity = '1';
            heroImg.style.transform = 'scale(1)';
        }, 400);
    }, 3500); // Troca a cada 3.5 segundos
}

document.addEventListener('DOMContentLoaded', () => {
    renderShowcase();
});

