// Auth Helper Functions
function checkAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
        const userData = JSON.parse(user);
        const authButtons = document.getElementById('authButtons');
        const userInfo = document.getElementById('userInfo');
        const userName = document.getElementById('userName');
        
        if (authButtons) authButtons.style.display = 'none';
        if (userInfo) userInfo.style.display = 'flex';
        if (userName) userName.textContent = userData.email;
        return true;
    }
    
    return false;
}

function showLogin() {
    document.getElementById('loginModal').style.display = 'block';
}

function showRegister() {
    document.getElementById('registerModal').style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

async function login(event) {
    event.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const data = await api.login(email, password);
        
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        closeModal('loginModal');
        checkAuth();
        
        alert('Login erfolgreich!');
    } catch (error) {
        alert('Login fehlgeschlagen: ' + error.message);
    }
}

async function register(event) {
    event.preventDefault();
    
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    
    try {
        const data = await api.register(email, password, name);
        
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        closeModal('registerModal');
        checkAuth();
        
        alert('Registrierung erfolgreich!');
    } catch (error) {
        alert('Registrierung fehlgeschlagen: ' + error.message);
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    const authButtons = document.getElementById('authButtons');
    const userInfo = document.getElementById('userInfo');
    
    if (authButtons) authButtons.style.display = 'flex';
    if (userInfo) userInfo.style.display = 'none';
    
    alert('Logout erfolgreich!');
    window.location.href = 'index.html';
}

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}
