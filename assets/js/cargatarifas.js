// assets/js/cargatarifas.js - Lógica para la carga de tarifas
import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verificación inicial de sesión activa
    try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            window.location.href = "../login.html";
            return;
        }
    } catch (err) {
        console.error("Error al comprobar sesión:", err);
        window.location.href = "../login.html";
        return;
    }

    const tarifaForm = document.getElementById('tarifaForm');
    const formMessage = document.getElementById('formMessage');
    const submitButton = tarifaForm.querySelector('button[type="submit"]');

    if (tarifaForm) {
        tarifaForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            formMessage.classList.remove('hidden', 'bg-emerald-50', 'text-emerald-700', 'bg-rose-50', 'text-rose-700');
            formMessage.textContent = '';

            const originalText = submitButton.textContent;

            try {
                submitButton.textContent = 'Guardando...';
                submitButton.disabled = true;

                // Recogemos y parseamos los valores numéricos correctamente
                const payload = {
                    suministro: document.getElementById('suministro').value.trim(),
                    nombre: document.getElementById('nombre').value.trim(),
                    punta: parseFloat(document.getElementById('punta').value),
                    llano: parseFloat(document.getElementById('llano').value),
                    valle: parseFloat(document.getElementById('valle').value),
                    excedente: parseFloat(document.getElementById('excedente').value),
                    fijo_punta: parseFloat(document.getElementById('fijo_punta').value),
                    fijo_valle: parseFloat(document.getElementById('fijo_valle').value)
                };

                // Llamada a la Edge Function 'carga-tarifas'
                const { data, error } = await supabase.functions.invoke('carga-tarifas', {
                    body: payload
                });

                if (error) {
                    throw new Error(error.message || 'Error en la invocación de la función.');
                }

                if (data && data.error) {
                    throw new Error(data.error);
                }

                // Mensaje de éxito
                formMessage.textContent = '¡Tarifa guardada y registrada correctamente!';
                formMessage.classList.add('bg-emerald-50', 'text-emerald-700');
                formMessage.classList.remove('hidden');

                // Limpiar el formulario
                tarifaForm.reset();

            } catch (err) {
                console.error("Error al guardar tarifa:", err);
                formMessage.textContent = `Error: ${err.message || 'No se pudo guardar la tarifa.'}`;
                formMessage.classList.add('bg-rose-50', 'text-rose-700');
                formMessage.classList.remove('hidden');
            } finally {
                submitButton.textContent = originalText;
                submitButton.disabled = false;
            }
        });
    }
});
