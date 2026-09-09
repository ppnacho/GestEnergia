// gestion/gestenergetica.js - Lógica del Panel Privado
import { supabase } from '../assets/js/supabaseClient.js';

// Al ser un script type="module", se ejecuta con el DOM ya listo. No envuelvas en DOMContentLoaded.
const userEmailSpan = document.getElementById('user-email');
const userDniDiv = document.getElementById('user-dni');
const btnLogout = document.getElementById('btn-logout');

async function iniciarPanel() {
    try {
        // 1. Verificar si hay una sesión activa en Supabase
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session) {
            console.warn("No hay sesión activa. Redirigiendo al login...");
            window.location.href = "../login.html";
            return;
        }

        // 2. Extraer datos del usuario autenticado
        const user = session.user;
        const email = user.email || "";
        
        if (userEmailSpan) userEmailSpan.textContent = email;
        const dniExtraido = email.split('@')[0].toUpperCase();
        if (userDniDiv) userDniDiv.textContent = dniExtraido;

        console.log("Sesión activa para:", email);

    } catch (err) {
        console.error("Error al comprobar la sesión:", err);
        window.location.href = "../login.html";
    }
}

// 3. Manejo del cierre de sesión
if (btnLogout) {
    btnLogout.addEventListener('click', async (e) => {
        e.preventDefault();
        console.log("Botón de cerrar sesión pulsado.");

        try {
            const { error } = await supabase.auth.signOut();
            if (error) {
                console.error("Error de Supabase al cerrar sesión:", error);
            }
        } catch (err) {
            console.error("Excepción al cerrar sesión:", err);
        } finally {
            console.log("Redirigiendo a login.html...");
            window.location.href = "../login.html";
        }
    });
} else {
    console.warn("No se encontró el botón con ID 'btn-logout' en el DOM.");
}

// Ejecutar la verificación inicial
iniciarPanel();
