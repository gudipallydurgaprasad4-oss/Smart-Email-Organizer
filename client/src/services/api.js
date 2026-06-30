const API_BASE = '';

export async function getCurrentUser() {
    const response = await fetch(`${API_BASE}/auth/user`, { credentials: 'include' });
    return response.json();
}

export async function getEmails() {
    const response = await fetch(`${API_BASE}/api/emails`, { credentials: 'include' });
    return response.json();
}

export async function getEmailsByCategory(category) {
    const response = await fetch(`${API_BASE}/api/emails/${category}`, { credentials: 'include' });
    return response.json();
}

export async function logout() {
    const response = await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
    });
    return response.json();
}
