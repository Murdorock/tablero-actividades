// Configuración de Supabase

const SUPABASE_CONFIG = {
    url: 'https://txeuzsypnwesscganktp.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4ZXV6c3lwbndlc3NjZ2Fua3RwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1NDcxMzksImV4cCI6MjA2NjEyMzEzOX0.thcTKNcHaycUTJRUwROfDJKZTteCM1j3eCIMh7UVh4M'
};

// Forzar uso de sessionStorage para la sesión de Supabase
if (typeof window !== 'undefined') {
  window.localStorage = window.sessionStorage;
}

// Inicializar cliente de Supabase solo si no existe
if (!window._supabase) {
    window._supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
}
// Alias global para compatibilidad
var supabase = window._supabase;

// Función helper para formatear fechas
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Función helper para mostrar mensajes
function showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.classList.add('fade-out');
        setTimeout(() => messageDiv.remove(), 300);
    }, 3000);
}

// Función helper para manejar errores
function handleError(error, context = '') {
    console.error(`Error ${context}:`, error);
    showMessage(`Error: ${error.message || 'Ocurrió un error'}`, 'error');
}
