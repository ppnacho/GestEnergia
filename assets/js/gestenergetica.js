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

        // Renderizar con los datos de consumo, generación y los nuevos costes económicos
        renderizarAnillosMensuales(
            data.mesesConsumoPunta, data.mesesConsumoValle, data.mesesConsumoLlano,
            data.mesesGeneracionPunta, data.mesesGeneracionValle, data.mesesGeneracionLlano,
            data.mesesCosteConsumo, data.mesesValorGeneracion
        );

    } catch (err) {
        console.error("Error al obtener datos del gráfico:", err);
    }
}

const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function renderizarAnillosMensuales(c_punta, c_valle, c_llano, g_punta, g_valle, g_llano, coste_consumo, valor_generacion) {
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

        // Obtener los valores económicos particulares de este mes
        const cc = coste_consumo ? (coste_consumo[i] || 0) : 0;
        const vg = valor_generacion ? (valor_generacion[i] || 0) : 0;

        // Añadir bloque de texto económico debajo del gráfico
        const infoDiv = document.createElement('div');
        infoDiv.style.marginTop = '8px';
        infoDiv.style.fontSize = '11px';
        infoDiv.style.fontWeight = '600';
        infoDiv.style.lineHeight = '1.3';

        const costeFormatted = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cc);
        const generacionFormatted = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(vg);

        infoDiv.innerHTML = `
            <div style="color: #ef4444;">Consumo: ${costeFormatted}</div>
            <div style="color: #10b981;">Gen.: ${generacionFormatted}</div>
        `;
        card.appendChild(infoDiv);

        gridContainer.appendChild(card);

        // Obtener los valores de energía particulares de este mes
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
                        borderWidth: 1.5,
                        borderColor: '#ffffff',
                        weight: 2 
                    },
                    // ANILLO INTERIOR: GENERACIÓN (Punta, Llano, Valle)
                    {
                        data: [gp, gl, gv],
                        backgroundColor: [
                            'rgba(239, 68, 68, 0.85)',  // Punta (Rojo)
                            'rgba(245, 158, 11, 0.85)', // Llano (Ámbar)
                            'rgba(16, 185, 129, 0.85)'  // Valle (Verde)
                        ],
                        borderWidth: 1.5,
                        borderColor: '#ffffff',
                        weight: 1.5 
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '28%', 
                spacing: 2,    
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleFont: { family: 'Inter', size: 12 },
                        bodyFont: { family: 'Inter', size: 12, weight: '600' },
                        padding: 10,
                        cornerRadius: 6,
                        callbacks: {
                            label: function(context) {
                                const valor = context.parsed;
                                const datasetData = context.dataset.data;
                                
                                // Suma total de los 3 tramos de este anillo específico
                                const totalDataset = datasetData.reduce((acc, val) => acc + (Number(val) || 0), 0);
                                
                                // Formatear valor en kWh
                                const valorStr = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(valor) + ' kWh';
                                
                                // Calcular porcentaje con 2 decimales
                                let porcentajeStr = '0,00%';
                                if (totalDataset > 0) {
                                    const porcentaje = (valor / totalDataset) * 100;
                                    porcentajeStr = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(porcentaje) + '%';
                                }
                                
                                // Devolver array para dos líneas: valor arriba, porcentaje abajo
                                return [valorStr, porcentajeStr];
                            }
                        }
                    }
                }
            }
        });

        miniCharts.push(chartInstance);
    });
}
