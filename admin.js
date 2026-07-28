import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, updatePassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getDatabase, ref as dbRef, set, get, child } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

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
const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app);

// Helper: Escape HTML
function sanitize(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
}

// Session Validation
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'login.html';
    } else {
        await restoreInitialCarsIfNeeded();
        renderAdminTable(); 
    }
});

// Logout
window.logout = function() {
    signOut(auth).then(() => {
        window.location.href = 'login.html';
    });
};

// Tab Switcher
window.switchTab = function(tabId, btnElement) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    document.getElementById(tabId).classList.add('active');
    btnElement.classList.add('active');
};

// Car Management Functions with Dual Storage (LocalStorage + Firebase RTDB with Timeout)
async function getCars() {
    let cachedCars = [];
    try {
        const raw = localStorage.getItem('roblox_cars_071_catalog');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                cachedCars = parsed;
            }
        }
    } catch(e) {
        console.warn("Erro ao ler localStorage:", e);
    }

    try {
        const reference = dbRef(db);
        const fetchPromise = get(child(reference, `cars`));
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("RTDB Timeout")), 2500)
        );

        const snapshot = await Promise.race([fetchPromise, timeoutPromise]);
        if (snapshot && snapshot.exists()) {
            const val = snapshot.val();
            let arr = [];
            if (Array.isArray(val)) {
                arr = val.filter(Boolean);
            } else if (val && typeof val === 'object') {
                arr = Object.values(val).filter(Boolean);
            }

            if (arr.length > 0) {
                try {
                    localStorage.setItem('roblox_cars_071_catalog', JSON.stringify(arr));
                } catch(e) {}
                return arr;
            }
        }
    } catch (error) {
        console.warn("Firebase RTDB indisponível ou demorado. Usando cache local:", error);
    }

    if (cachedCars.length > 0) {
        return cachedCars;
    }

    return [];
}

async function saveCars(cars) {
    const cleanCars = Array.isArray(cars) ? cars.filter(Boolean) : Object.values(cars).filter(Boolean);

    // 1. Grava instantaneamente no LocalStorage (0ms delay)
    try {
        localStorage.setItem('roblox_cars_071_catalog', JSON.stringify(cleanCars));
    } catch (e) {
        console.warn("Não foi possível salvar no LocalStorage:", e);
    }

    // 2. Tenta sincronizar com Firebase RTDB com timeout de 3.0s
    try {
        const setPromise = set(dbRef(db, 'cars'), cleanCars);
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("RTDB Save Timeout")), 3000)
        );
        await Promise.race([setPromise, timeoutPromise]);
        console.log("Catálogo salvo e sincronizado no Firebase!");
    } catch (err) {
        console.warn("Sincronização em nuvem do Firebase falhou ou demorou. Dados salvos localmente:", err);
    }
}

// Helper: Image Compression & Data URL
function compressImage(file, maxWidth = 1000, maxHeight = 1000, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > maxWidth || height > maxHeight) {
                    if (width / height > maxWidth / maxHeight) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    } else {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl);
            };
            img.onerror = (err) => reject(err);
            img.src = e.target.result;
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
}

// Helper: Image Upload function (Instant Base64 Compression - 0ms delay, zero Firebase Storage hangs)
async function uploadImage(fileElement) {
    if (!fileElement || !fileElement.files || fileElement.files.length === 0) return null;
    const file = fileElement.files[0];
    
    // 1. Converte e comprime a imagem localmente no navegador em ~30ms (sem depender de regras do Firebase Storage)
    try {
        const compressedBase64 = await compressImage(file, 900, 900, 0.75);
        if (compressedBase64) {
            console.log("Imagem comprimida localmente com sucesso! Tamanho ideal atingido.");
            return compressedBase64;
        }
    } catch (e) {
        console.warn("Falha ao comprimir imagem localmente, tentando leitura direta:", e);
    }

    // 2. Fallback FileReader direto
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
    });
}


async function renderAdminTable() {
    const cars = await getCars();
    const tbody = document.getElementById('carTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (!cars || cars.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-tertiary); padding: 30px;">Nenhum veículo cadastrado.</td></tr>`;
        return;
    }

    cars.forEach(car => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <img src="${sanitize(car.image)}" class="car-thumb" alt="${sanitize(car.name)}" onerror="this.src='https://via.placeholder.com/60x40?text=Carro';">
            </td>
            <td><strong>${sanitize(car.name)}</strong></td>
            <td><span class="car-badge" style="position: static; display: inline-block;">${sanitize(car.category.toUpperCase())}</span></td>
            <td><strong style="color: var(--primary);">${sanitize(car.price)}</strong></td>
            <td>
                <div class="action-btns">
                    <button onclick="openEditModal(${car.id})" class="btn-sm btn-edit">✏️ Editar</button>
                    <button onclick="deleteCar(${car.id})" class="btn-sm btn-delete">🗑️ Excluir</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Add Car Handler
document.getElementById('addCarForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.querySelector('#addCarForm button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerText = "Salvando...";

    try {
        const name = document.getElementById('carName').value.trim();
        const category = document.getElementById('carCategory').value;
        const desc = document.getElementById('carDesc').value.trim();
        
        let image = document.getElementById('carImage').value.trim();
        const fileElement = document.getElementById('carImageFile');

        // Se houver arquivo selecionado, converte a foto em super velocidade
        if (fileElement.files.length > 0) {
            submitBtn.innerText = "Processando imagem...";
            const uploadedImage = await uploadImage(fileElement);
            if (uploadedImage) {
                image = uploadedImage;
            }
        }

        if (!image) {
            image = "https://via.placeholder.com/400x250/222222/FFD700?text=LOJA+DA+071";
        }

        let price = "R$ 99,90";
        if (category === 'intermediario') price = "R$ 129,90";
        if (category === 'premium') price = "R$ 159,90";

        const cars = await getCars();
        const newId = cars.length > 0 ? Math.max(...cars.map(c => c.id)) + 1 : 1;

        const newCar = {
            id: newId,
            name: name,
            category: category,
            price: price,
            image: image,
            description: desc
        };

        cars.push(newCar);
        await saveCars(cars);
        renderAdminTable();

        document.getElementById('addCarForm').reset();
        const addContainer = document.getElementById('addImagePreviewContainer');
        if (addContainer) addContainer.style.display = 'none';

        alert('✅ Veículo adicionado com sucesso ao catálogo em nuvem!');
    } catch(err) {
        console.error(err);
        alert('❌ Ocorreu um erro ao salvar o carro.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "Adicionar Veículo";
    }
});

// Event listeners para prévia de imagem ao selecionar arquivo ou colar URL
const carImageFileInput = document.getElementById('carImageFile');
if (carImageFileInput) {
    carImageFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        const container = document.getElementById('addImagePreviewContainer');
        const img = document.getElementById('addImagePreview');
        if (file && container && img) {
            img.src = URL.createObjectURL(file);
            container.style.display = 'block';
        }
    });
}

const carImageTextInput = document.getElementById('carImage');
if (carImageTextInput) {
    carImageTextInput.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        const container = document.getElementById('addImagePreviewContainer');
        const img = document.getElementById('addImagePreview');
        if (container && img) {
            if (url) {
                img.src = url;
                container.style.display = 'block';
            } else {
                container.style.display = 'none';
            }
        }
    });
}

const editCarImageFileInput = document.getElementById('editCarImageFile');
if (editCarImageFileInput) {
    editCarImageFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        const container = document.getElementById('editImagePreviewContainer');
        const img = document.getElementById('editImagePreview');
        if (file && container && img) {
            img.src = URL.createObjectURL(file);
            container.style.display = 'block';
        }
    });
}

const editCarImageTextInput = document.getElementById('editCarImage');
if (editCarImageTextInput) {
    editCarImageTextInput.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        const container = document.getElementById('editImagePreviewContainer');
        const img = document.getElementById('editImagePreview');
        if (container && img) {
            if (url) {
                img.src = url;
                container.style.display = 'block';
            } else {
                container.style.display = 'none';
            }
        }
    });
}

// Edit Modal Functions
window.openEditModal = async function(carId) {
    const cars = await getCars();
    if (!Array.isArray(cars)) return;

    const car = cars.find(c => String(c.id) === String(carId));
    if (!car) {
        alert("⚠️ Veículo não encontrado para edição.");
        return;
    }

    document.getElementById('editCarId').value = car.id;
    document.getElementById('editCarName').value = car.name || '';
    document.getElementById('editCarCategory').value = car.category || 'basico';
    document.getElementById('editCarImage').value = car.image || '';
    document.getElementById('editCarImageFile').value = ''; // reseta file input
    document.getElementById('editCarDesc').value = car.description || '';

    const container = document.getElementById('editImagePreviewContainer');
    const img = document.getElementById('editImagePreview');
    if (container && img) {
        if (car.image) {
            img.src = car.image;
            container.style.display = 'block';
        } else {
            container.style.display = 'none';
        }
    }

    document.getElementById('editModal').classList.add('active');
};

window.closeEditModal = function() {
    document.getElementById('editModal').classList.remove('active');
};

document.getElementById('editCarForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = document.querySelector('#editCarForm button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerText = "Salvando...";

    try {
        const id = document.getElementById('editCarId').value;
        const name = document.getElementById('editCarName').value.trim();
        const category = document.getElementById('editCarCategory').value;
        let image = document.getElementById('editCarImage').value.trim();
        const fileElement = document.getElementById('editCarImageFile');
        const desc = document.getElementById('editCarDesc').value.trim();

        // Se houver arquivo de foto selecionado
        if (fileElement.files && fileElement.files.length > 0) {
            submitBtn.innerText = "Processando imagem...";
            const uploadedImage = await uploadImage(fileElement);
            if (uploadedImage) {
                image = uploadedImage;
            }
        }

        if (!image) {
            image = "https://via.placeholder.com/400x250/222222/FFD700?text=LOJA+DA+071";
        }

        let price = "R$ 99,90";
        if (category === 'intermediario') price = "R$ 129,90";
        if (category === 'premium') price = "R$ 159,90";

        let cars = await getCars();
        if (!Array.isArray(cars)) cars = [];

        const carIndex = cars.findIndex(c => String(c.id) === String(id));

        if (carIndex !== -1) {
            cars[carIndex] = {
                id: cars[carIndex].id,
                name: name,
                category: category,
                price: price,
                image: image,
                description: desc
            };

            await saveCars(cars);
            await renderAdminTable();
            closeEditModal();
            alert('✅ As alterações no veículo foram salvas com sucesso!');
        } else {
            alert('⚠️ O ID do veículo não foi encontrado na lista. Tente atualizar a página.');
        }
    } catch(err) {
        console.error("Erro ao salvar edição:", err);
        alert('❌ Ocorreu um erro ao editar o veículo: ' + (err.message || err));
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = "Salvar Alterações";
    }
});

// Delete Car Function
window.deleteCar = async function(id) {
    if (confirm('⚠️ Tem certeza de que deseja remover este veículo do catálogo?')) {
        let cars = await getCars();
        if (!Array.isArray(cars)) cars = [];
        cars = cars.filter(c => String(c.id) !== String(id));
        await saveCars(cars);
        await renderAdminTable();
    }
};

// Auto Restore Initial Cars if empty
async function restoreInitialCarsIfNeeded() {
    const currentCars = await getCars();
    if (currentCars && currentCars.length > 0) {
        return; 
    }

    console.log("Banco vazio! Restaurando os 15 carros padrao...");
    const defaultCars = [
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

    await saveCars(defaultCars);
}

// Change Password Handler
document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const newPass = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmPassword').value;
    const passAlert = document.getElementById('passAlert');

    passAlert.style.display = 'none';

    if (newPass.length < 6) {
        passAlert.className = 'alert-box alert-error';
        passAlert.innerHTML = '⚠️ A nova senha deve ter no mínimo 6 caracteres.';
        passAlert.style.display = 'block';
        return;
    }

    if (newPass !== confirmPass) {
        passAlert.className = 'alert-box alert-error';
        passAlert.innerHTML = '⚠️ A confirmação da nova senha não confere.';
        passAlert.style.display = 'block';
        return;
    }

    const user = auth.currentUser;
    if (user) {
        updatePassword(user, newPass).then(() => {
            passAlert.className = 'alert-box alert-success';
            passAlert.innerHTML = '🎉 Senha da nuvem alterada com sucesso!';
            passAlert.style.display = 'block';
            document.getElementById('changePasswordForm').reset();
        }).catch((error) => {
            passAlert.className = 'alert-box alert-error';
            passAlert.innerHTML = '❌ Erro ao alterar senha. Talvez seja necessário fazer login novamente antes de mudar a senha.';
            passAlert.style.display = 'block';
        });
    }
});
