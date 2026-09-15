import { supabase } from './supabaseClient.js';

let datosAnalisisGlobal = null;

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
            window.location.href = '../index.html'
            return
        }
    }

    const params = new URLSearchParams(window.location.search);
    const suministro = params.get('suministro');
    const anio = params.get('anio');
    const periodo = params.get('periodo') || 'todos';

    if (!suministro || !anio) {
        alert('Faltan parámetros de suministro o año.');
        window.location.href = '../analisis/analisistarifas.html';
        return;
    }

    document.getElementById('badge-contexto').textContent = `CUPS: ${suministro} | Año: ${anio} | Periodo: ${periodo}`;
    document.getElementById('btn-volver').href = `../analisis/analisistarifas.html`;

    try {
        const { data, error } = await supabase.functions.invoke('analisis-tarifas', {
            body: { 
                suministro, 
                anio: anio !== 'todos' ? parseInt(anio) : 'todos', 
                periodo 
            }
        });

        if (error || !data || data.error) throw error || new Error(data?.error);

        datosAnalisisGlobal = data;
        inicializarSimulador(data);

    } catch (err) {
        console.error('Error al cargar datos para la mejora:', err);
        alert('No se pudieron recuperar los datos del suministro para simular.');
    }
});

function inicializarSimulador(data) {
    const { mercado } = data;
    const selectRival = document.getElementById('select-tarifa-rival');
    const rivales = mercado.filter(t => t.nombre?.trim().toLowerCase() !== 'renovacion');

    selectRival.innerHTML = '<option value="" disabled selected>Selecciona una tarifa...</option>';
    rivales.forEach((t, index) => {
        const opt = document.createElement('option');
        opt.value = index;
        opt.textContent = `${t.nombre} (Coste Actual: ${t.coste_total.toFixed(2)} €)`;
        selectRival.appendChild(opt);
    });

    selectRival.addEventListener('change', ejecutarSimulacionMejora);
    document.getElementById('select-estrategia').addEventListener('change', ejecutarSimulacionMejora);
    
    const sliderIntensidad = document.getElementById('range-intensidad');
    sliderIntensidad.addEventListener('input', (e) => {
        document.getElementById('label-intensidad').textContent = `Margen objetivo: -${e.target.value} €`;
        ejecutarSimulacionMejora();
    });
}

function mercadoFiltrado() {
    return datosAnalisisGlobal.mercado.filter(t => t.nombre?.trim().toLowerCase() !== 'renovacion');
}

function ejecutarSimulacionMejora() {
    const selectRivalIndex = document.getElementById('select-tarifa-rival').value;
    if (selectRivalIndex === "") return;

    const tarifaRival = mercadoFiltrado()[selectRivalIndex];
    const tarifaRenovacion = datosAnalisisGlobal.tarifa_renovacion;
    const estrategia = document.getElementById('select-estrategia').value;
    const margenSeguridad = parseFloat(document.getElementById('range-intensidad').value);

    // Coste objetivo a batir
    const costeObjetivo = tarifaRenovacion.coste_total - margenSeguridad;
    const costeActualRival = tarifaRival.coste_total;
    const recorteNecesario = Math.max(0, costeActualRival - costeObjetivo);

    document.getElementById('sim-coste-original').textContent = `${costeActualRival.toFixed(2)} €`;

    // Factor de descuento proporcional necesario para conseguir el recorte
    // Evitamos división por cero si el coste actual es 0
    let factorDescuento = 0;
    if (costeActualRival > 0 && recorteNecesario > 0) {
        if (estrategia === 'mixta') {
            factorDescuento = recorteNecesario / (tarifaRival.coste_energia + tarifaRival.coste_fijo);
        } else if (estrategia === 'energia') {
            factorDescuento = tarifaRival.coste_energia > 0 ? recorteNecesario / tarifaRival.coste_energia : 0;
        } else if (estrategia === 'potencia') {
            factorDescuento = tarifaRival.coste_fijo > 0 ? recorteNecesario / tarifaRival.coste_fijo : 0;
        } else {
            factorDescuento = recorteNecesario / (tarifaRival.coste_energia + tarifaRival.coste_fijo);
        }
    }

    // Limitamos el descuento para que no sea un absurdo (máximo 40% de rebaja)
    factorDescuento = Math.min(0.40, Math.max(0, factorDescuento));

    // Calculamos nuevo coste estimado
    let ahorroCalculado = recorteNecesario;
    let costeNuevoRival = costeActualRival - ahorroCalculado;
    if (costeNuevoRival < 0) costeNuevoRival = 0;

    document.getElementById('sim-coste-nuevo').textContent = `${costeNuevoRival.toFixed(2)} €`;
    
    const diferenciaRenovacion = costeNuevoRival - tarifaRenovacion.coste_total;
    document.getElementById('sim-diferencia-renovacion').textContent = `(${diferenciaRenovacion <= 0 ? '' : '+'}${diferenciaRenovacion.toFixed(2)} € vs Renovación)`;
    
    const ahorroCliente = tarifaRenovacion.coste_total - costeNuevoRival;
    document.getElementById('sim-ahorro-cliente').textContent = `${ahorroCliente.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

    // Renderizar tablas detalladas de precios unitarios
    renderizarTablasDetalladas(tarifaRival, estrategia, factorDescuento);
}

function renderizarTablasDetalladas(tarifa, estrategia, factor) {
    const tbodyEnergia = document.getElementById('tabla-energia-detallada');
    const tbodyPotencia = document.getElementById('tabla-potencia-detallada');
    tbodyEnergia.innerHTML = '';
    tbodyPotencia.innerHTML = '';

    document.getElementById('badge-estrategia-aplicada').textContent = `Estrategia: ${estrategia.toUpperCase()} (Ajuste ~${(factor * 100).toFixed(1)}%)`;

    // 1. Desglose de Energía (Punta, Llano, Valle si existen en los precios de la tarifa)
    // Supongamos que la tarifa trae un objeto de precios unitarios o los simulamos de forma proporcional
    const preciosEnergiaActual = tarifa.precios_energia || { punta: 0.15, llano: 0.12, valle: 0.09 }; 
    // Nota: Si tu estructura de objeto guarda los precios unitarios en otro campo, ajústalo aquí. 
    // Vamos a aplicar el factor según la estrategia elegida:
    const aplicaEnergia = estrategia === 'mixta' || estrategia === 'energia';

    ['punta', 'llano', 'valle'].forEach(periodo => {
        const precioActual = preciosEnergiaActual[periodo] || 0.12; // Valor por defecto orientativo si no viene desglosado
        const rebaja = aplicaEnergia ? precioActual * factor : 0;
        const precioNuevo = Math.max(0.01, precioActual - rebaja);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="py-2.5 px-4 font-medium uppercase text-slate-700">${periodo}</td>
            <td class="py-2.5 px-4 text-right text-slate-600">${precioActual.toFixed(5)} €</td>
            <td class="py-2.5 px-4 text-right font-bold text-indigo-700">${precioNuevo.toFixed(5)} €</td>
            <td class="py-2.5 px-4 text-right text-emerald-600 font-semibold">-${(rebaja).toFixed(5)} € (${(factor * 100).toFixed(0)}%)</td>
        `;
        tbodyEnergia.appendChild(tr);
    });

    // 2. Desglose de Potencia (P1, P2)
    const preciosPotenciaActual = tarifa.precios_potencia || { p1: 0.08, p2: 0.04 };
    const aplicaPotencia = estrategia === 'mixta' || estrategia === 'potencia';

    ['p1', 'p2'].forEach(periodo => {
        const precioActual = preciosPotenciaActual[periodo] || 0.06;
        const rebaja = aplicaPotencia ? precioActual * factor : 0;
        const precioNuevo = Math.max(0.005, precioActual - rebaja);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="py-2.5 px-4 font-medium uppercase text-slate-700">${periodo}</td>
            <td class="py-2.5 px-4 text-right text-slate-600">${precioActual.toFixed(5)} €</td>
            <td class="py-2.5 px-4 text-right font-bold text-indigo-700">${precioNuevo.toFixed(5)} €</td>
            <td class="py-2.5 px-4 text-right text-emerald-600 font-semibold">-${(rebaja).toFixed(5)} €</td>
        `;
        tbodyPotencia.appendChild(tr);
    });
}
