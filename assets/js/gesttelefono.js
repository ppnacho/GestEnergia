// assets/js/gesttelefono.js - Lógica del panel de telefonía
import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    const selectLinea = document.getElementById('select-linea');
    const selectAnio = document.getElementById('select-anio');
    const resumenContenido = document.getElementById('resumen-contenido');

    // 1. Verificar sesión de usuario y cargar líneas disponibles
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            window.location.href = '../login.html';
            return;
        }

        // Pendiente: invocar Edge Function para poblar selectLinea
        // const { data, error } = await supabase.functions.invoke('get-consumos-telefono', {
        //     body: { accion: 'obtener-lineas', userId: user.id }
        // });

    } catch (err) {
        console.error("Error al inicializar el panel de telefonía:", err);
    }

    // 2. Cargar años disponibles al seleccionar línea
    selectLinea.addEventListener('change', async (e) => {
        const linea = e.target.value;
        selectAnio.innerHTML = '<option value="">Selecciona año...</option>';
        if (!linea) return;

        // Pendiente: invocar Edge Function para obtener años disponibles de esa línea
    });

    // 3. Cargar resumen de datos al seleccionar año
    selectAnio.addEventListener('change', async () => {
        const linea = selectLinea.value;
        const anio = selectAnio.value;
        if (!linea || !anio) return;

        // Pendiente: invocar Edge Function y renderizar resumenContenido
    });
});
