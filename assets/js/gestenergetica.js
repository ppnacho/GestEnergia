import { supabase } from './supabaseClient.js';

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

    // --- NUEVO: Botón Recargar Tarifas (ejecuta load-tarifas-web) ---
    const btnRecargarTarifas = document.getElementById('btn-recargar-tarifas');
    if (btnRecargarTarifas) {
        btnRecargarTarifas.addEventListener('click', async () => {
            try {
                btnRecargarTarifas.disabled = true;
                btnRecargarTarifas.textContent = 'Actualizando...';
                
                const { data, error } = await supabase.functions.invoke('load-tarifas-web', {
                    body: {}
                });

                if (error) throw error;
                alert("¡Tarifas recargadas correctamente desde la web!");
                
                // Recargar los datos del panel para reflejar cambios si procede
                cargarDatosGrafico();
            } catch (err) {
                console.error("Error al recargar tarifas:", err);
                alert("Error al recargar tarifas: " + err.message);
            } finally {
                btnRecargarTarifas.disabled = false;
                btnRecargarTarifas.innerHTML = `
                    <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Recargar Tarifas
                `;
            }
        });
    }

    // --- COMPROBAR SOPORTE BIOMÉTRICO ---
    const btnRegisterPasskey = document.getElementById('btn-register-passkey');
    if (btnRegisterPasskey) {
        try {
            if (window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
                const disponible = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
                if (!disponible) btnRegisterPasskey.style.display = 'none';
            } else {
                btnRegisterPasskey.style.display = 'none';
            }
        } catch (error) {
            btnRegisterPasskey.style.display = 'none';
        }

        btnRegisterPasskey.addEventListener('click', async () => {
            try {
                const { data, error } = await supabase.auth.registerPasskey();
                if (error) throw error;
                alert("¡Tu huella se ha vinculado correctamente a tu cuenta!");
            } catch (error) {
                alert("No se pudo registrar la huella: " + error.message);
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
        selectSuministro.innerHTML = ''; 

        data.suministros.forEach(sum => {
            const opt = document.createElement('option');
            if (typeof sum === 'object' && sum !== null) {
                opt.value = sum.cups;
                opt.textContent = sum.alias || sum.cups;
            } else {
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

        // Rellenar selector de tarifa comparativa si la Edge Function las devuelve
        const selectTarifaComp = document.getElementById('select-tarifa-comparacion');
        if (data.tarifasDisponibles && selectTarifaComp) {
            data.tarifasDisponibles.forEach(tarifaNombre => {
                const opt = document.createElement('option');
                opt.value = tarifaNombre;
                opt.textContent = tarifaNombre;
                selectTarifaComp.appendChild(opt);
            });
        }

        if (selectSuministro.value && selectAnio.value) {
            cargarDatosGrafico();
        }

    } catch (err) {
        console.error("Error al inicializar panel:", err);
    }

    document.getElementById('select-suministro').addEventListener('change', cargarDatosGrafico);
    document.getElementById('select-anio').addEventListener('change', cargarDatosGrafico);
    document.getElementById('select-tarifa-comparacion').addEventListener('change', cargarDatosGrafico);
});

async function cargarDatosGrafico() {
    const suministro = document.getElementById('select-suministro').value;
    const anio = document.getElementById('select-anio').value;
    const tarifaComparacion = document.getElementById('select-tarifa-comparacion')?.value || null;

    if (!suministro || !anio) return;

    try {
        const { data, error } = await supabase.functions.invoke('panel-energia', {
            body: { action: 'grafico', suministro, anio, tarifaComparacion }
        });

        if (error) throw error;

        renderizarAnillosMensuales(
            data.mesesConsumoPunta, data.mesesConsumoValle, data.mesesConsumoLlano,
            data.mesesGeneracionPunta, data.mesesGeneracionValle, data.mesesGeneracionLlano,
            data.mesesCosteConsumo, data.mesesValorGeneracion, data.mesesCosteFijo,
            data.mesesCosteConsumoComp, data.mesesValorGeneracionComp, data.mesesCosteFijoComp, tarifaComparacion
        );

    } catch (err) {
        console.error("Error al obtener datos del gráfico:", err);
    }
}

const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function renderizarAnillosMensuales(c_punta, c_valle, c_llano, g_punta, g_valle, g_llano, coste_consumo, valor_generacion, coste_fijo, coste_consumo_comp, valor_generacion_comp, coste_fijo_comp, tarifaComparacion) {
    const gridContainer = document.getElementById('meses-grid');
    if (!gridContainer) return;

    miniCharts.forEach(chart => chart.destroy());
    miniCharts = [];
    gridContainer.innerHTML = '';

    const fechaActual = new Date();
    const anioActual = fechaActual.getFullYear();
    const mesActualIndex = fechaActual.getMonth(); 
    
    const selectAnio = document.getElementById('select-anio');
    const anioSeleccionado = selectAnio ? parseInt(selectAnio.value, 10) : anioActual;

    mesesNombres.forEach((nombreMes, i) => {
        const card = document.createElement('div');
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

        // Comprobar si hay datos de consumo o generación para este mes
        const cp = c_punta[i] || 0;
        const cv = c_valle[i] || 0;
        const cl = c_llano[i] || 0;
        const gp = g_punta[i] || 0;
        const gv = g_valle[i] || 0;
        const gl = g_llano[i] || 0;

        const totalConsumoMes = cp + cl + cv;
        const totalGeneracionMes = gp + gl + gv;
        const tieneDatos = (totalConsumoMes > 0 || totalGeneracionMes > 0);

        const infoDiv = document.createElement('div');
        infoDiv.style.marginTop = '8px';
        infoDiv.style.fontSize = '11px';
        infoDiv.style.fontWeight = '600';
        infoDiv.style.lineHeight = '1.4';
        infoDiv.style.textAlign = 'left';
        infoDiv.style.paddingLeft = '6px';
        infoDiv.style.width = '100%';

        if (tieneDatos) {
            // Datos tarifa actual
            const cc = coste_consumo ? (coste_consumo[i] || 0) : 0;
            const vg = valor_generacion ? (valor_generacion[i] || 0) : 0;
            const cf = coste_fijo ? (coste_fijo[i] || 0) : 0;

            const costeFormatted = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cc);
            const generacionFormatted = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(vg);
            const fijoFormatted = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cf);

            let htmlContent = `
                <div style="color: #000000; border-bottom: ${tarifaComparacion ? '1px solid #e2e8f0' : 'none'}; padding-bottom: 3px; margin-bottom: 3px;">
                    <div style="font-size: 10px; color: #64748b; text-transform: uppercase;">Tarifa Actual</div>
                    <div>Consumo: ${costeFormatted}</div>
                    <div>Generación: ${generacionFormatted}</div>
                    <div>Potencia: ${fijoFormatted}</div>
                </div>
            `;

            // Si hay una tarifa comparativa seleccionada, añadimos su bloque justo debajo
            if (tarifaComparacion) {
                const ccComp = coste_consumo_comp ? (coste_consumo_comp[i] || 0) : 0;
                const vgComp = valor_generacion_comp ? (valor_generacion_comp[i] || 0) : 0;
                const cfComp = coste_fijo_comp ? (coste_fijo_comp[i] || 0) : 0;

                const costeCompF = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(ccComp);
                const genCompF = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(vgComp);
                const fijoCompF = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cfComp);

                htmlContent += `
                    <div style="color: #0369a1; padding-top: 2px;">
                        <div style="font-size: 10px; color: #0284c7; text-transform: uppercase; font-weight: 700;">${tarifaComparacion}</div>
                        <div>Consumo: ${costeCompF}</div>
                        <div>Generación: ${genCompF}</div>
                        <div>Potencia: ${fijoCompF}</div>
                    </div>
                `;
            }
            infoDiv.innerHTML = htmlContent;
        } else {
            // Si no hay datos, mostramos texto indicativo limpio
            infoDiv.innerHTML = `<div style="color: #94a3b8; text-align: center; font-style: italic; padding: 4px 0;">Sin datos</div>`;
        }

        card.appendChild(infoDiv);
        gridContainer.appendChild(card);

        // Si no hay datos, pasamos de renderizar el gráfico donut vacío con ceros
        if (!tieneDatos) return;

        const ctx = canvas.getContext('2d');
        const chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                datasets: [
                    {
                        data: [cp, cl, cv],
                        backgroundColor: ['rgba(239, 68, 68, 0.85)', 'rgba(245, 158, 11, 0.85)', 'rgba(16, 185, 129, 0.85)'],
                        borderWidth: 1.5,
                        borderColor: '#ffffff',
                        weight: 2 
                    },
                    {
                        data: [gp, gl, gv],
                        backgroundColor: ['rgba(239, 68, 68, 0.85)', 'rgba(245, 158, 11, 0.85)', 'rgba(16, 185, 129, 0.85)'],
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
