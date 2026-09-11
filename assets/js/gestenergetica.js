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
        selectSuministro.innerHTML = ''; // Limpiar opciones previas si las hubiera

       // Se adapta para mostrar únicamente el alias (y el CUPS como respaldo por si faltase)
        data.suministros.forEach(sum => {
            const opt = document.createElement('option');
            
            if (typeof sum === 'object' && sum !== null) {
                opt.value = sum.cups;
                opt.textContent = sum.alias || sum.cups;
            } else {
                // Compatibilidad por si algún suministro viniera directamente como string (CUPS)
                opt.value = sum;
                opt.textContent = sum;
            }

            selectSuministro.appendChild(opt);
        });

        const selectAnio = document.getElementById('select-anio');
        data.anos.forEach(ano => {
            const opt = document.createElement('option');
            opt.value = ano;
            opt.textContent = ano;
            selectAnio.appendChild(opt);
        });

        // Si se cargaron suministros y años por defecto, lanzamos la primera carga del gráfico automáticamente
        if (selectSuministro.value && selectAnio.value) {
            cargarDatosGrafico();
        }

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

    // Destruir gráficos anteriores
    miniCharts.forEach(chart => chart.destroy());
    miniCharts = [];
    gridContainer.innerHTML = '';

    // Obtener año actual y mes actual (0 = Enero, 8 = Septiembre)
    const fechaActual = new Date();
    const anioActual = fechaActual.getFullYear();
    const mesActualIndex = fechaActual.getMonth(); 
    
    // Obtener el año que el usuario tiene seleccionado en el desplegable
    const selectAnio = document.getElementById('select-anio');
    const anioSeleccionado = selectAnio ? parseInt(selectAnio.value, 10) : anioActual;

    mesesNombres.forEach((nombreMes, i) => {
        const card = document.createElement('div');
        
        // Marcar como incompleto SOLO si es el mes actual y estamos viendo el año actual
        const esMesEnCurso = (anioSeleccionado === anioActual && i === mesActualIndex);
        card.className = esMesEnCurso ? 'mes-card incompleto' : 'mes-card';

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

        // Añadir bloque de texto económico debajo del gráfico (alineado a la izquierda y en negro)
        const infoDiv = document.createElement('div');
        infoDiv.style.marginTop = '8px';
        infoDiv.style.fontSize = '11px';
        infoDiv.style.fontWeight = '600';
        infoDiv.style.lineHeight = '1.4';
        infoDiv.style.textAlign = 'left';
        infoDiv.style.paddingLeft = '6px';

        const costeFormatted = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cc);
        const generacionFormatted = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(vg);

        infoDiv.innerHTML = `
            <div style="color: #000000;">Consumo: ${costeFormatted}</div>
            <div style="color: #000000;">Generacion: ${generacionFormatted}</div>
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
                    // ANILLO EXTERIOR: CONSUMO
                    {
                        data: [cp, cl, cv],
                        backgroundColor: [
                            'rgba(239, 68, 68, 0.85)',  
                            'rgba(245, 158, 11, 0.85)', 
                            'rgba(16, 185, 129, 0.85)'  
                        ],
                        borderWidth: 1.5,
                        borderColor: '#ffffff',
                        weight: 2 
                    },
                    // ANILLO INTERIOR: GENERACIÓN
                    {
                        data: [gp, gl, gv],
                        backgroundColor: [
                            'rgba(239, 68, 68, 0.85)',  
                            'rgba(245, 158, 11, 0.85)', 
                            'rgba(16, 185, 129, 0.85)'  
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
                                const totalDataset = datasetData.reduce((acc, val) => acc + (Number(val) || 0), 0);
                                const valorStr = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(valor) + ' kWh';
                                
                                let porcentajeStr = '0,00%';
                                if (totalDataset > 0) {
                                    const porcentaje = (valor / totalDataset) * 100;
                                    porcentajeStr = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(porcentaje) + '%';
                                }
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
