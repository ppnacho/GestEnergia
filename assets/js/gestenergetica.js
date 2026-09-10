import { supabase } from './supabaseClient.js';

let myChart = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Configurar el botón de Cerrar Sesión
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            const { error } = await supabase.auth.signOut();
            if (!error) {
                // Redirige a la página de login (ajusta la ruta si tu index/login está en otra carpeta)
                window.location.href = '../index.html'; 
            } else {
                console.error('Error al cerrar sesión:', error.message);
            }
        });
    }

    // 2. Obtener la sesión activa
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
        // 3. Llamar a la Edge Function para inicializar los desplegables
        const { data, error } = await supabase.functions.invoke('panel-energia', {
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
        const { data, error } = await supabase.functions.invoke('panel-energia', {
            body: { action: 'grafico', suministro, anio }
        });

        if (error) throw error;

        // Renderizar con las 4 series de datos
        renderizarGrafico(data.mesesPunta, data.mesesValle, data.mesesLlano, data.mesesGeneracion);

    } catch (err) {
        console.error("Error al obtener datos del gráfico:", err);
    }
}

function renderizarGrafico(punta, valle, llano, generacion) {
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
                    label: 'Punta',
                    data: punta,
                    backgroundColor: 'rgba(239, 68, 68, 0.85)', // Rojo / Naranja fuerte
                    borderRadius: 4,
                    barPercentage: 0.8,
                    categoryPercentage: 0.85
                },
                {
                    label: 'Valle',
                    data: valle,
                    backgroundColor: 'rgba(16, 185, 129, 0.85)', // Verde esmeralda
                    borderRadius: 4,
                    barPercentage: 0.8,
                    categoryPercentage: 0.85
                },
                {
                    label: 'Llano',
                    data: llano,
                    backgroundColor: 'rgba(245, 158, 11, 0.85)', // Ámbar / Naranja suave
                    borderRadius: 4,
                    barPercentage: 0.8,
                    categoryPercentage: 0.85
                },
                {
                    label: 'Generación',
                    data: generacion,
                    backgroundColor: 'rgba(14, 165, 233, 0.85)', // Azul cielo
                    borderRadius: 4,
                    barPercentage: 0.8,
                    categoryPercentage: 0.85
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: { family: 'Inter', weight: '500' },
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { family: 'Inter', size: 13 },
                    bodyFont: { family: 'Inter', size: 12 },
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(context.parsed.y) + ' kWh';
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { family: 'Inter' } }
                },
                y: {
                    type: 'logarithmic', // Escala logarítmica activada
                    min: 0.1,            // Valor mínimo seguro para evitar errores con ceros
                    grid: { color: 'rgba(241, 245, 249, 1)' },
                    ticks: { 
                        font: { family: 'Inter' },
                        callback: function(value) { 
                            // Opcional: mostrar etiquetas formateadas en valores clave
                            return Number(value).toLocaleString('es-ES') + ' kWh'; 
                        }
                    }
                }
            }
        }
    });
}
