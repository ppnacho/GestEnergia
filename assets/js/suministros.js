import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Validación de sesión estricta
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            window.location.href = '../index.html';
            return;
        }
    }

    // 2. Eventos de redirección para los botones
    document.getElementById('btn-electricidad').addEventListener('click', () => {
        // Redirige al panel eléctrico existente
        window.location.href = '../gestion/gestenergetica.html'; // Ajusta la ruta si es necesario según tu estructura
    });

    document.getElementById('btn-agua').addEventListener('click', () => {
        // Redirige al futuro panel de agua
        window.location.href = '../gestion/gestagua.html';
    });

    // 3. Botón de Cerrar Sesión
    document.getElementById('btn-logout').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '../index.html';
    });
});
