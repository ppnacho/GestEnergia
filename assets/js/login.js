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
                // que usa Supabase Auth (ajústalo si tu dominio interno es diferente, ej: "@gestenergia.local")
                const emailInterno = `${dniInput}@gestenergia.local`;

                // Llamada real a Supabase Auth usando el email interno derivado del DNI
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: emailInterno,
                    password: passwordInput,
                });

                if (error) throw error;

                // Si las credenciales son correctas, entramos al panel protegido
                window.location.href = "gestion/gestenergetica.html";

            } catch (error) {
                console.error("Error en el login:", error);
                loginError.textContent = "Acceso denegado: DNI o contraseña incorrectos.";
                
                submitButton.textContent = originalText;
                submitButton.disabled = false;
            }
        });
    }
});
