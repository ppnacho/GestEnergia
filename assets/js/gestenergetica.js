// gestion/gestenergatica.js - Lógica del Panel Privado
import { supabase } from '../assets/js/supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    const userEmailSpan = document.getElementById('user-email');
    const userDniDiv = document.getElementById('user-dni');
    const btnLogout = document.getElementById('btn-logout');

    try {
        // 1. Verificar si hay una sesión activa en Supabase
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session) {
            // Si no hay sesión válida, expulsar al usuario al login principal
            console.warn("No hay sesión activa. Redirigiendo al login...");
            window.location.href = "../login.html";
            return;
        }

        // 2. Extraer datos del usuario autenticado
        const user = session.user;
        const email = user.email || "";
        
        // Mostrar el email o extraer el DNI del correo (ej: 09248666k@gestenergetica.local -> 09248666k)
        userEmailSpan.textContent = email;
        const dniExtraido = email.split('@')[0].toUpperCase();
        userDniDiv.textContent = dniExtraido;

        console.log("Sesión activa para:", email);

    } catch (err) {
        console.error("Error al comprobar la sesión:", err);
        window.location.href = "../login.html";
    }

    // 3. Manejo del cierre de sesión
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            try {
                const { error } = await supabase.auth.signOut();
                if (error) throw error;
                
                // Redirigir a la página de login en la raíz
                window.location.href = "../login.html";
            } catch (err) {
                console.error("Error al cerrar sesión:", err);
                alert("Hubo un problema al cerrar la sesión.");
            }
        });
    }
});
