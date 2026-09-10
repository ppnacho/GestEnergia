import { supabase } from './supabaseClient.js';

let myChart = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Obtener la sesión activa (el cliente ya sabe quién está logueado)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
        // 2. Llamar a la Edge Function usando la instancia importada
        const { data, error } = await supabase.functions.invoke('panel-datos', {
            body: { action: 'init' }
        });

        if (error) throw error;

        // Rellenar Suministros
        const selectSuministro = document.getElementById('select-suministro');
        data.suministros.forEach(sum => {
            const opt = document.createElement('option');
            opt.value = sum;
            opt.textContent = sum;
            selectSuministro.appendChild(opt);
        });

        // Rellenar Años
        const selectAnio = document.getElementById('select-anio');
        data.anos.forEach(ano => {
            const opt = document.createElement('option');
            opt.value = ano;
            opt.textContent = ano;
            selectAnio.appendChild(opt);
        });

    } catch (err) {
        console.error("Error al inicializar panel:", err);
    }

    // Listeners de cambio en los filtros
    document.getElementById('select-suministro').addEventListener('change', cargarDatosGrafico);
    document.getElementById('select-anio').addEventListener('change', cargarDatosGrafico);
});

async function cargarDatosGrafico() {
    const suministro = document.getElementById('select-suministro').value;
    const anio = document.getElementById('select-anio').value;

    if (!suministro || !anio) return;

    try {
        const { data, error } = await supabase.functions.invoke('panel-datos', {
            body: { action: 'grafico', suministro, anio }
        });

        if (error) throw error;

        renderizarGrafico(data.mesesConsumo, data.mesesGeneracion);

    } catch (err) {
        console.error("Error al obtener datos del gráfico:", err);
    }
}

function renderizarGrafico(mesesConsumo, mesesGeneracion) {
    const ctx = document.getElementById('chartConsumos').getContext('2d');

    if (myChart) {
        myChart.destroy();
    }

    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
            datasets: [
                {
                    label: 'Consumo (kWh)',
                    data: mesesConsumo,
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    borderRadius: 6
                },
                {
                    label: 'Generación (kWh)',
                    data: mesesGeneracion,
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}
