// assets/js/gestagua.js - Lógica del panel de agua con gráficos de barras mensuales
import { supabase } from './supabaseClient.js';

let chartsInstances = {};

document.addEventListener('DOMContentLoaded', async () => {
    const selectSuministro = document.getElementById('select-suministro');
    const selectAnio = document.getElementById('select-anio');
    const mesesGrid = document.getElementById('meses-grid');

    // Inicializar cuadrícula con los 12 meses vacíos
    const nombresMeses = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    function inicializarGridMeses() {
        mesesGrid.innerHTML = '';
        nombresMeses.forEach((nombre, index) => {
            const mesNum = index + 1;
            const card = document.createElement('div');
            card.className = 'mes-card';
            card.innerHTML = `
                <div class="mes-titulo">${nombre}</div>
                <div class="chart-container-mini">
                    <canvas id="chart-mes-${mesNum}"></canvas>
                </div>
                <div id="pico-mes-${mesNum}" class="pico-info">
                    Máx: -- L<br><span class="text-[10px] text-slate-400">Fecha: --</span>
                </div>
            `;
            mesesGrid.appendChild(card);
        });
    }

    inicializarGridMeses();

    // 1. Cargar suministros del usuario logueado a través de la Edge Function (Cero consultas directas)
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            window.location.href = '../login.html';
            return;
        }

        const { data, error } = await supabase.functions.invoke('get-consumos-agua', {
            body: { accion: 'obtener-suministros', userId: user.id }
        });

        if (error) throw error;

        if (data && data.suministro && Array.isArray(data.suministro)) {
            const { suministro, alias, pot_punta } = data;

            suministro.forEach((cups, index) => {
                const tipo = pot_punta[index];
                const nombreAlias = alias[index] || cups;

                // Filtrar exclusivamente los suministros de agua
                if (tipo === 'agua' || !cups.startsWith('ES')) {
                    const opt = document.createElement('option');
                    opt.value = cups;
                    opt.textContent = nombreAlias; // Muestra únicamente el alias
                    selectSuministro.appendChild(opt);
                }
            });
        }
    } catch (err) {
        console.error("Error al cargar suministros de agua:", err);
    }

    // 2. Cargar años disponibles al seleccionar suministro (usando la misma Edge Function)
    selectSuministro.addEventListener('change', async (e) => {
        const contrato = e.target.value;
        selectAnio.innerHTML = '<option value="">Selecciona año...</option>';
        if (!contrato) return;

        try {
            const { data, error } = await supabase.functions.invoke('get-consumos-agua', {
                body: { contrato } // Sin año, solo contrato para extraer los años
            });

            if (error) throw error;

            if (data && data.anios) {
                data.anios.forEach(anio => {
                    const opt = document.createElement('option');
                    opt.value = anio;
                    opt.textContent = anio;
                    selectAnio.appendChild(opt);
                });
            }
        } catch (err) {
            console.error("Error al obtener años:", err);
        }
    });

    // 3. Al cambiar el año, cargar consumos y pintar los gráficos de barras por mes
    selectAnio.addEventListener('change', async () => {
        const contrato = selectSuministro.value;
        const anio = selectAnio.value;

        if (!contrato || !anio) return;

        try {
            const { data, error } = await supabase.functions.invoke('get-consumos-agua', {
                body: { contrato, anio }
            });

            if (error) throw error;

            // data.meses debe ser un array de 12 elementos con: { consumoAcumulado, maxHorario, fechaHoraMax }
            actualizarGraficosMeses(data.meses || []);

        } catch (err) {
            console.error("Error al cargar consumos de agua:", err);
        }
    });

    function actualizarGraficosMeses(datosMeses) {
        datosMeses.forEach((infoMes, index) => {
            const mesNum = index + 1;
            const canvasId = `chart-mes-${mesNum}`;
            const picoDivId = `pico-mes-${mesNum}`;

            // Destruir gráfico anterior si existe
            if (chartsInstances[mesNum]) {
                chartsInstances[mesNum].destroy();
            }

            const ctx = document.getElementById(canvasId).getContext('2d');

            chartsInstances[mesNum] = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Máx. Hora', 'Acumulado'],
                    datasets: [{
                        data: [infoMes.maxHorario || 0, infoMes.consumoAcumulado || 0],
                        backgroundColor: ['#06b6d4', '#2563eb'],
                        borderRadius: 6,
                        barThickness: 28
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const litros = context.raw || 0;
                                    const m3 = litros / 1000;

                                    const litrosStr = litros.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                                    const m3Str = m3.toLocaleString('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

                                    return [
                                        `${litrosStr} Litros`,
                                        `(${m3Str} m³)`
                                    ];
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { display: false },
                            ticks: { font: { size: 10 } }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { font: { size: 10 } }
                        }
                    }
                }
            });

            // Actualizar etiqueta inferior según el diseño solicitado
            const picoContainer = document.getElementById(picoDivId);
            const esMesPar = mesNum % 2 === 0;

            if (infoMes.maxHorario > 0 || infoMes.consumoAcumulado > 0) {
                // Extraer el día de la fecha de maximo horario (ej: "2026-07-06 00:00" -> "6")
                let diaStr = '--';
                if (infoMes.fechaHoraMax) {
                    const partesFecha = infoMes.fechaHoraMax.split(' ')[0].split('-');
                    if (partesFecha.length === 3) {
                        diaStr = parseInt(partesFecha[2], 10);
                    }
                }

                let htmlFacturacion = '';
                if (esMesPar) {
                    const totalEur = (infoMes.totalEur || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    const consumoM3Factura = (infoMes.consumoM3 || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    htmlFacturacion = `<br><span class="text-[10px] font-semibold text-slate-700">${totalEur} € (${consumoM3Factura} m³)</span>`;
                }

                picoContainer.innerHTML = `
                    Máx: <b>${infoMes.maxHorario} L</b> <span class="text-[11px] text-slate-500">(Día ${diaStr})</span>
                    ${htmlFacturacion}
                `;
            } else {
                picoContainer.innerHTML = `Máx: 0 L<br><span class="text-[10px] text-slate-400">Sin registros</span>`;
            }
        });
    }
});
