// assets/js/login.js - Lógica de autenticación usando DNI
import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Limpiar errores previos
            loginError.textContent = '';

            // Recogemos el DNI introducido por el usuario
            const dniInput = document.getElementById('dni').value.trim().toLowerCase();
            const passwordInput = document.getElementById('password').value;

            const submitButton = loginForm.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;

            try {
                submitButton.textContent = 'Verificando...';
                submitButton.disabled = true;

                // REGLA DE TRADUCCIÓN: Convertimos el DNI al formato de email interno 
                const emailInterno = `${dniInput}@gestenergetica.local`;

                // 1. Autenticación estándar con Supabase Auth
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: emailInterno,
                    password: passwordInput,
                });

                if (error) throw error;

                // 2. Comprobar si el usuario está activo mediante la Edge Function 'check-user'
                submitButton.textContent = 'Comprobando estado...';
                const { data: checkData, error: checkError } = await supabase.functions.invoke('check-user');

                if (checkError || !checkData || checkData.activo !== true) {
                    // Si no está activo o falla la comprobación, cerramos sesión de inmediato
                    await supabase.auth.signOut();
                    throw new Error("Tu cuenta está pendiente de activación por un administrador.");
                }

                // 3. Si todo es correcto y está activo, entramos al panel protegido
                window.location.href = "gestion/gestenergetica.html";

            } catch (error) {
                console.error("Error en el login:", error);
                
                // Mostramos el mensaje exacto si viene de la cuenta inactiva o uno genérico si fallan credenciales
                const mensajeError = error.message.includes('pendiente de activación') 
                    ? error.message 
                    : "Acceso denegado: DNI o contraseña incorrectos.";
                
                loginError.textContent = mensajeError;
                
                submitButton.textContent = originalText;
                submitButton.disabled = false;
            }
        });
    }
});
