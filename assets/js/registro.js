// assets/js/registro.js

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const registerError = document.getElementById('registerError');
    const registerSuccess = document.getElementById('registerSuccess');
    const dniInput = document.getElementById('dni');

    // Función auxiliar para validar DNI/NIE (admite letras en minúscula o mayúscula)
    function validarDNI(texto) {
        const dniClean = texto.trim().toUpperCase();
        
        // Expresión regular para DNI (8 números + 1 letra) o NIE (X/Y/Z + 7 números + 1 letra)
        const dniRegex = /^[0-9]{8}[TRWAGMYFPDXBNJZSQVHLCKE]$/;
        const nieRegex = /^[XYZ][0-9]{7}[TRWAGMYFPDXBNJZSQVHLCKE]$/;

        if (!dniRegex.test(dniClean) && !nieRegex.test(dniClean)) {
            return false;
        }

        // Validación de letra de control para DNI estándar
        if (dniRegex.test(dniClean)) {
            const letras = "TRWAGMYFPDXBNJZSQVHLCKE";
            const numero = parseInt(dniClean.substr(0, 8), 10);
            const letraCalculada = letras[numero % 23];
            const letraProporcionada = dniClean.substr(8, 1);
            return letraCalculada === letraProporcionada;
        }

        // Para NIE, realizamos la equivalencia estándar del primer carácter
        if (nieRegex.test(dniClean)) {
            const letras = "TRWAGMYFPDXBNJZSQVHLCKE";
            let prefix = dniClean.charAt(0);
            let numPrefix = prefix === 'X' ? '0' : prefix === 'Y' ? '1' : '2';
            const numero = parseInt(numPrefix + dniClean.substr(1, 7), 10);
            const letraCalculada = letras[numero % 23];
            const letraProporcionada = dniClean.substr(8, 1);
            return letraCalculada === letraProporcionada;
        }

        return false;
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            registerError.textContent = '';
            registerSuccess.textContent = '';

            const dniVal = dniInput.value.trim();
            const passwordVal = document.getElementById('password').value;

            // Validar DNI en cliente
            if (!validarDNI(dniVal)) {
                registerError.textContent = "El DNI/NIE introducido no es válido o la letra es incorrecta.";
                return;
            }

            const submitButton = registerForm.querySelector('button[type="submit"]');
            const originalText = submitButton.textContent;

            try {
                submitButton.textContent = 'Procesando alta...';
                submitButton.disabled = true;

                // Llamada a la Edge Function de Supabase (Cero acceso directo a tablas desde el cliente)
                const response = await fetch('https://TU-PROYECTO.supabase.co/functions/v1/registrar-usuario', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        // 'Authorization': `Bearer ${supabaseAnonKey}` // Si procede
                    },
                    body: JSON.stringify({
                        dni: dniVal.toUpperCase(),
                        password: passwordVal,
                        suministro: [] // Array JSONB inicial vacío o con valores por defecto asignados
                    })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'No se pudo completar el registro.');
                }

                registerSuccess.textContent = "¡Alta registrada con éxito! Redirigindo al login...";
                setTimeout(() => {
                    window.location.href = "login.html";
                }, 2000);

            } catch (error) {
                console.error("Error en el registro:", error);
                registerError.textContent = error.message || "Ocurrió un error al procesar la solicitud.";
                submitButton.textContent = originalText;
                submitButton.disabled = false;
            }
        });
    }
});
