// assets/js/gesttelefono.js - Lógica del panel de telefonía
import { supabase } from './supabaseClient.js';

const PROPIETARIOS = ['Luisi', 'Goya', 'Elena'];
const MESES_ES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

/**
 * Plugin personalizado de Chart.js para dibujar la aguja y el marcador central de 0°
 */
const gaugeNeedlePlugin = {
    id: 'gaugeNeedle',
    afterDatasetDraw(chart) {
        const { ctx, config } = chart;
        const meta = chart.getDatasetMeta(0);
        if (!meta || !meta.data || !meta.data.length) return;

        const { value = 0, maxAbs = 100 } = config.options.plugins.gaugeNeedle || {};
        const arc = meta.data[0];
        const cx = arc.x;
        const cy = arc.y;
        const outerRadius = arc.outerRadius;
        const innerRadius = arc.innerRadius;

        ctx.save();

        // 1. Marca superior central del 0 (0 grados verticales = -PI/2 en canvas)
        ctx.beginPath();
        ctx.moveTo(cx, cy - innerRadius + 4);
        ctx.lineTo(cx, cy - outerRadius - 6);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#334155';
        ctx.stroke();

        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillStyle = '#475569';
        ctx.textAlign = 'center';
        ctx.fillText('0', cx, cy - outerRadius - 10);

        // 2. Calcular ángulo de la aguja (-PI/2 = arriba 0, -PI = izquierda rojo, 0 = derecha verde)
        const clamped = Math.max(-maxAbs, Math.min(maxAbs, value));
        const ratio = maxAbs > 0 ? clamped / maxAbs : 0; // Rango [-1, 1]
        const angle = -Math.PI / 2 + ratio * (Math.PI / 2);

        const needleLength = outerRadius - 6;

        // 3. Dibujar aguja
        ctx.translate(cx, cy);
        ctx.rotate(angle);

        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.lineTo(needleLength, 0);
        ctx.lineTo(0, 4);
        ctx.closePath();
        ctx.fillStyle = '#0f172a';
        ctx.fill();

        // 4. Punto central (pivote)
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        ctx.restore();
    }
};

function formatearUltimoMes(fechaISO) {
    if (!fechaISO) return null;
    const partes = fechaISO.split('-'); // [YYYY, MM, DD]
    if (partes.length < 2) return null;
    const anio = partes[0];
    const mesIndex = parseInt(partes[1], 10) - 1;
    const nombreMes = MESES_ES[mesIndex] || '';
    return nombreMes ? `${nombreMes}-${anio}` : null;
}

document.addEventListener('DOMContentLoaded', async () => {
    const resumenContenido = document.getElementById('resumen-contenido');
    const ultimoRegistroContainer = document.getElementById('ultimo-registro-container');
    const ultimoRegistroTexto = document.getElementById('ultimo-registro-texto');

    // 1. Verificar sesión de usuario
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            window.location.href = '../login.html';
            return;
        }

        // 2. Consultar datos agregados por propietario desde la Edge Function
        const { data, error } = await supabase.functions.invoke('resumen-asociados-telefono');

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const balances = data.balances || {};
        renderizarGauges(resumenContenido, balances);

        // 3. Mostrar última fecha registrada en formato ULTIMO-REGISTRO: mes-año
        const mesAnioFormateado = formatearUltimoMes(data.ultima_fecha);
        if (mesAnioFormateado) {
            ultimoRegistroTexto.textContent = `ULTIMO-REGISTRO: ${mesAnioFormateado}`;
            ultimoRegistroContainer.classList.remove('hidden');
        }

    } catch (err) {
        console.error('Error al cargar el resumen de telefonía:', err);
        resumenContenido.innerHTML = `
            <div class="col-span-full py-8 text-center border border-red-200 rounded-xl bg-red-50 text-red-700 text-sm font-medium">
                Error al cargar los datos: ${err.message || 'No se pudo conectar con el servidor.'}
            </div>
        `;
    }
});

function renderizarGauges(contenedor, balances) {
    // Calcular escala simétrica máxima para que todas las agujas tengan una referencia visual proporcional
    const valoresAbsolutos = PROPIETARIOS.map(prop => Math.abs(balances[prop]?.balance || 0));
    const maxValor = Math.max(...valoresAbsolutos, 10);
    const escalaMaxima = Math.ceil(maxValor * 1.2); // 20% de margen sobre el valor máximo

    contenedor.innerHTML = '';

    PROPIETARIOS.forEach((propietario) => {
        const info = balances[propietario] || { balance: 0, total_gastos: 0, total_ingresos: 0 };
        const balance = Number(info.balance || 0);

        const esNegativo = balance < 0;
        const esPositivo = balance > 0;

        const colorTexto = esNegativo
            ? 'text-red-600'
            : esPositivo
                ? 'text-emerald-600'
                : 'text-slate-700';

        const signo = esPositivo ? '+' : '';
        const valorFormateado = `${signo}${balance.toLocaleString('es-ES', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })} €`;

        const card = document.createElement('div');
        card.className = 'bg-slate-50/70 border border-slate-200 rounded-2xl p-5 flex flex-col items-center justify-between shadow-sm';

        card.innerHTML = `
            <h4 class="text-base font-bold text-slate-800 mb-2">${propietario}</h4>
            <div class="relative w-full max-w-[260px] h-[160px] flex items-center justify-center">
                <canvas id="gauge-${propietario.toLowerCase()}"></canvas>
            </div>
            <div class="mt-2 text-center">
                <p class="text-2xl font-extrabold tracking-tight ${colorTexto}">${valorFormateado}</p>
                <p class="text-[11px] text-slate-400 mt-1">
                    Ingresos: ${Number(info.total_ingresos).toFixed(2)} € · Gastos: ${Number(info.total_gastos).toFixed(2)} €
                </p>
            </div>
        `;

        contenedor.appendChild(card);

        const ctx = card.querySelector('canvas').getContext('2d');

        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Negativo', 'Positivo'],
                datasets: [{
                    data: [50, 50],
                    backgroundColor: ['#ef4444', '#10b981'], // Izquierda rojo, derecha verde
                    borderWidth: 0,
                    hoverOffset: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                rotation: -90,
                circumference: 180,
                cutout: '72%',
                layout: {
                    padding: {
                        top: 24,
                        bottom: 10,
                        left: 12,
                        right: 12
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false },
                    gaugeNeedle: {
                        value: balance,
                        maxAbs: escalaMaxima
                    }
                }
            },
            plugins: [gaugeNeedlePlugin]
        });
    });
}
