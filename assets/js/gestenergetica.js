import { supabase } from './supabaseClient.js';

// Almacenaremos las instancias de los mini-gráficos para poder destruirlos al recargar
let miniCharts = [];

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

        // Renderizar la cuadrícula de anillos concéntricos con los 6 arrays de datos
        renderizarAnillosMensuales(
            data.mesesConsumoPunta, data.mesesConsumoValle, data.mesesConsumoLlano,
            data.mesesGeneracionPunta, data.mesesGeneracionValle, data.mesesGeneracionLlano
        );

    } catch (err) {
        console.error("Error al obtener datos del gráfico:", err);
    }
}

const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function renderizarAnillosMensuales(c_punta, c_valle, c_llano, g_punta, g_valle, g_llano) {
    const gridContainer = document.getElementById('meses-grid');
    if (!gridContainer) return;

    // Destruir gráficos anteriores si ya existían para evitar fugas de memoria o solapamientos
    miniCharts.forEach(chart => chart.destroy());
    miniCharts = [];

    // Limpiar contenedor HTML previo
    gridContainer.innerHTML = '';

    // Generar de Enero a Diciembre de izquierda a derecha
    mesesNombres.forEach((nombreMes, i) => {
        const card = document.createElement('div');
        card.className = 'mes-card';

        const title = document.createElement('div');
        title.className = 'mes-titulo';
        title.textContent = nombreMes;
        card.appendChild(title);

        const canvasWrapper = document.createElement('div');
        canvasWrapper.className = 'chart-container-mini';

        const canvas = document.createElement('canvas');
        canvas.id = `chart-mes-${i}`;
        canvasWrapper.appendChild(canvas);
        card.appendChild(canvasWrapper);
        gridContainer.appendChild(card);

        // Obtener los valores particulares de este mes
        const cp = c_punta[i] || 0;
        const cv = c_valle[i] || 0;
        const cl = c_llano[i] || 0;
        const gp = g_punta[i] || 0;
        const gv = g_valle[i] || 0;
        const gl = g_llano[i] || 0;

        const ctx = canvas.getContext('2d');
        const chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                datasets: [
                    // ANILLO EXTERIOR: CONSUMO (Punta, Llano, Valle)
                    {
                        data: [cp, cl, cv],
                        backgroundColor: [
                            'rgba(239, 68, 68, 0.85)',  // Punta (Rojo)
                            'rgba(245, 158, 11, 0.85)', // Llano (Ámbar)
                            'rgba(16, 185, 129, 0.85)'  // Valle (Verde)
                        ],
                        borderWidth: 0,
                        weight: 2
                    },
                    // ANILLO INTERIOR: GENERACIÓN (Punta, Llano, Valle)
                    {
                        data: [gp, gl, gv],
                        backgroundColor: [
                            'rgba(59, 130, 246, 0.85)', // Punta (Azul fuerte)
                            'rgba(14, 165, 233, 0.85)', // Llano (Azul cielo)
                            'rgba(99, 102, 241, 0.85)'  // Valle (Índigo)
                        ],
                        borderWidth: 0,
                        weight: 1.2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '45%', // Espacio interior para lograr el diseño concéntrico
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleFont: { family: 'Inter', size: 12 },
                        bodyFont: { family: 'Inter', size: 11 },
                        padding: 8,
                        cornerRadius: 6,
                        callbacks: {
                            label: function(context) {
                                const datasetIndex = context.datasetIndex;
                                const dataIndex = context.dataIndex;
                                let tipoTarifa = '';
                                
                                if (dataIndex === 0) tipoTarifa = 'Punta';
                                else if (dataIndex === 1) tipoTarifa = 'Llano';
                                else if (dataIndex === 2) tipoTarifa = 'Valle';

                                const grupo = datasetIndex === 0 ? 'Consumo' : 'Generación';
                                const valor = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(context.parsed);
                                
                                return `${grupo} (${tipoTarifa}): ${valor} kWh`;
                            }
                        }
                    }
                }
            }
        });

        miniCharts.push(chartInstance);
    });
}
