// assets/js/login.js - Lógica de autenticación usando DNI y Passkey
import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const btnLoginPasskey = document.getElementById('btn-login-passkey');

    // --- COMPROBAR SOPORTE BIOMÉTRICO PARA OCULTAR BOTÓN SI NO ES COMPATIBLE ---
    if (btnLoginPasskey) {
        try {
            if (window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
                const disponible = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
                if (!disponible) {
                    btnLoginPasskey.style.display = 'none';
                }
            } else {
                btnLoginPasskey.style.display = 'none';
            }
        } catch (error) {
            console.error("Error al comprobar soporte biométrico:", error);
            btnLoginPasskey.style.display = 'none';
        }
    }
    // -------------------------------------------------------------------------

    // 1. Login tradicional por DNI y Contraseña
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
                
                const mensajeError = error.message.includes('pendiente de activación') 
                    ? error.message 
                    : "Acceso denegado: DNI o contraseña incorrectos.";
                
                loginError.textContent = mensajeError;
                
                submitButton.textContent = originalText;
                submitButton.disabled = false;
            }
        });
    }

    // 2. Login rápido con Huella Dactilar (Passkey)
    if (btnLoginPasskey) {
        btnLoginPasskey.addEventListener('click', async () => {
            loginError.textContent = '';

            try {
                // Inicia la ceremonia biométrica nativa del navegador/sistema
                const { data, error } = await supabase.auth.signInWithPasskey();

                if (error) throw error;

                // Al igual que en el login normal, comprobamos que el usuario esté activo tras loguearse con la huella
                const { data: checkData, error: checkError } = await supabase.functions.invoke('check-user');

                if (checkError || !checkData || checkData.activo !== true) {
                    await supabase.auth.signOut();
                    throw new Error("Tu cuenta está pendiente de activación por un administrador.");
                }

                // Si todo es correcto, redirigimos al panel
                window.location.href = "gestion/gestenergetica.html";

            } catch (error) {
                console.error("Error al iniciar sesión con huella:", error);
                
                const mensajeError = error.message.includes('pendiente de activación')
                    ? error.message
                    : "No se pudo autenticar con la huella dactilar.";
                
                loginError.textContent = mensajeError;
            }
        });
    }
});
