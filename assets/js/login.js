// assets/js/login.js - Lógica de autenticación con Supabase

// Si vas a usar Supabase directamente aquí, importarás tu cliente configurado:
// import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Limpiar errores previos
            loginError.textContent = '';

            const userInput = document.getElementById('dni').value.trim();
            const passwordInput = document.getElementById('password').value;

            try {
                // Indicador visual de carga opcional
                const submitButton = loginForm.querySelector('button[type="submit"]');
                const originalText = submitButton.textContent;
                submitButton.textContent = 'Verificando...';
                submitButton.disabled = true;

                // TODO: Aquí realizaremos la llamada real a Supabase Auth
                // Ejemplo con Supabase:
                /*
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: userInput, // o el campo que uses como identificador
                    password: passwordInput,
                });

                if (error) throw error;
                */

                // Simulación provisional de éxito para pruebas de diseño:
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Redirección al panel protegido una vez autenticado con éxito
                window.location.href = "gestion/gestenergatica.html";

            } catch (error) {
                console.error("Error en el login:", error);
                loginError.textContent = error.message || "Credenciales incorrectas. Por favor, inténtalo de nuevo.";
                
                // Restaurar botón
                const submitButton = loginForm.querySelector('button[type="submit"]');
                submitButton.textContent = 'Entrar al Sistema';
                submitButton.disabled = false;
            }
        });
    }
});
