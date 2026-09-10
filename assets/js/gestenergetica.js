import { supabase } from './supabaseClient.js';

let myChart = null;

document.addEventListener('DOMContentLoaded', async () => {
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            const { error } = await supabase.auth.signOut();
            if (!error) {
                window.location.href = '../index.html'; 
            } else {
                console.error('Error al cerrar sesión:', error.message);
            }
        });
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
        const { data, error } = await supabase.functions.invoke('panel-energia', {
            body: { action: 'init' }
        });

        if (error) throw error;

        const selectSuministro = document.getElementById('select-suministro');
        data.suministros.forEach(sum => {
            const opt = document.createElement('option');
            opt.value = sum;
            opt.textContent = sum;
            selectSuministro.appendChild(opt);
        });

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

        // Renderizar con los 6 arrays de datos (Consumo y Generación desglosados)
        renderizarGrafico(
            data.mesesConsumoPunta, data.mesesConsumoValle, data.mesesConsumoLlano,
            data.mesesGeneracionPunta, data.mesesGeneracionValle, data.mesesGeneracionLlano
        );

    } catch (err) {
        console.error("Error al obtener datos del gráfico:", err);
    }
}

function renderizarGrafico(c_punta, c_valle, c_llano, g_punta, g_valle, g_llano) {
    const ctx = document.getElementById('chartConsumos').getContext('2d');

    if (myChart) {
        myChart.destroy();
    }

    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
            datasets: [
                // GRUPO 1: CONSUMO (Apilados en la barra de la izquierda de cada mes)
                {
                    label: 'Consumo Punta',
                    data: c_punta,
                    backgroundColor: 'rgba(239, 68, 68, 0.85)', // Rojo
                    borderRadius: 2,
                    stack: 'consumo',
                },
                {
                    label: 'Consumo Llano',
                    data: c_llano,
                    backgroundColor: 'rgba(245, 158, 11, 0.85)', // Ámbar
                    borderRadius: 2,
                    stack: 'consumo',
                },
                {
                    label: 'Consumo Valle',
                    data: c_valle,
                    backgroundColor: 'rgba(16, 185, 129, 0.85)', // Verde
                    borderRadius: 2,
                    stack: 'consumo',
                },
                // GRUPO 2: GENERACIÓN (Apilados en la barra de la derecha de cada mes)
                {
                    label: 'Generación Punta',
                    data: g_punta,
                    backgroundColor: 'rgba(59, 130, 246, 0.85)', // Azul fuerte
                    borderRadius: 2,
                    stack: 'generacion',
                },
                {
                    label: 'Generación Llano',
                    data: g_llano,
                    backgroundColor: 'rgba(14, 165, 233, 0.85)', // Azul cielo
                    borderRadius: 2,
                    stack: 'generacion',
                },
                {
                    label: 'Generación Valle',
                    data: g_valle,
                    backgroundColor: 'rgba(99, 102, 241, 0.85)', // Índigo
                    borderRadius: 2,
                    stack: 'generacion',
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
                    stacked: true, // Agrupa y apila correctamente por propiedades "stack"
                    grid: { display: false },
                    ticks: { font: { family: 'Inter' } }
                },
                y: {
                    stacked: true, // Apila verticalmente dentro de cada grupo
                    beginAtZero: true,
                    grid: { color: 'rgba(241, 245, 249, 1)' },
                    ticks: { 
                        font: { family: 'Inter' },
                        callback: function(value) { return value + ' kWh'; }
                    }
                }
            }
        }
    });
}
