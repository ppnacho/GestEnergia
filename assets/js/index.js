// index.js - Lógica principal de la página de inicio

document.addEventListener('DOMContentLoaded', () => {
    const secureButton = document.getElementById('btn-secure-access');

    if (secureButton) {
        secureButton.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Aquí gestionaremos la autenticación (prompt, modal o redirección con token)
            // antes de permitir el acceso a gestenergatica.html
            
            const password = prompt("Introduce la contraseña de acceso a datos sensibles:");
            
            if (password) {
                // Validación provisional o llamada a Supabase para verificar credenciales
                // De momento simulamos una validación simple o pasamos a la vista
                console.log("Intentando autenticación...");
                
                // Ejemplo de redirección si coincide (esto lo securizaremos bien con Supabase Auth)
                window.location.href = "gestenergatica.html";
            }
        });
    }
});
