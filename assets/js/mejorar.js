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

    // Recuperamos el alias guardado en sessionStorage (o usamos el CUPS por defecto si no existiera)
    const aliasSuministro = sessionStorage.getItem('alias_suministro') || suministro;

    // Renderizar el badge de contexto en dos filas claras
    const contenedorBadge = document.getElementById('badge-contexto');
    contenedorBadge.innerHTML = `
        <div class="font-bold text-slate-900">📦 Suministro: <span class="text-indigo-600">${aliasSuministro}</span>
        </div>
        <div class="text-xs text-slate-500 flex gap-4">
            <span>📅 Año: <strong class="text-slate-700">${anio}</strong></span>
            <span>⏱️ Periodo: <strong class="text-slate-700">${periodo}</strong></span>
        </div>
    `;

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

    // Limitamos el descuento máximo al 40%
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

    // Renderizar tablas detalladas (Energía, Potencia y Excedentes)
    renderizarTablasDetalladas(tarifaRival, estrategia, factorDescuento);
}

function renderizarTablasDetalladas(tarifa, estrategia, factor) {
    const tbodyEnergia = document.getElementById('tabla-energia-detallada');
    const tbodyPotencia = document.getElementById('tabla-potencia-detallada');
    const tbodyExcedentes = document.getElementById('tabla-excedentes-detallada');
    
    tbodyEnergia.innerHTML = '';
    tbodyPotencia.innerHTML = '';
    if (tbodyExcedentes) tbodyExcedentes.innerHTML = '';

    document.getElementById('badge-estrategia-aplicada').textContent = `Estrategia: ${estrategia.toUpperCase()} (Ajuste ~${(factor * 100).toFixed(1)}%)`;

    const aplicaEnergia = estrategia === 'mixta' || estrategia === 'energia';
    const aplicaPotencia = estrategia === 'mixta' || estrategia === 'potencia';

    // 1. Desglose de Energía
    ['punta', 'llano', 'valle'].forEach(periodo => {
        const precioActual = parseFloat(tarifa[periodo]) || 0; 
        const rebaja = aplicaEnergia ? precioActual * factor : 0;
        const precioNuevo = Math.max(0.0000001, precioActual - rebaja);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="py-2.5 px-4 font-medium uppercase text-slate-700">${periodo}</td>
            <td class="py-2.5 px-4 text-right text-slate-600">${precioActual.toFixed(7)} €</td>
            <td class="py-2.5 px-4 text-right">
                <input type="number" step="0.0000001" data-tipo="energia" data-periodo="${periodo}" 
                    value="${precioActual.toFixed(7)}" 
                    class="input-usuario-precio w-28 text-right px-2 py-1 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
            </td>
            <td class="py-2.5 px-4 text-right font-bold text-slate-900">${precioNuevo.toFixed(7)} €</td>
            <td class="py-2.5 px-4 text-right font-semibold ${rebaja > 0 ? 'text-emerald-600' : 'text-slate-400'}">-${(rebaja).toFixed(7)} €</td>
        `;
        tbodyEnergia.appendChild(tr);
    });

    // 2. Desglose de Potencia (Alineado exactamente a 5 columnas)
    const mapeoPotencia = [
        { key: 'fijo_punta', label: 'p1' },
        { key: 'fijo_valle', label: 'p2' }
    ];

    mapeoPotencia.forEach(item => {
        const precioActual = parseFloat(tarifa[item.key]) || 0;
        const rebaja = aplicaPotencia ? precioActual * factor : 0;
        const precioNuevo = Math.max(0.0000001, precioActual - rebaja);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="py-2.5 px-4 font-medium uppercase text-slate-700">${item.label}</td>
            <td class="py-2.5 px-4 text-right text-slate-600">${precioActual.toFixed(7)} €</td>
            <td class="py-2.5 px-4 text-right">
                <input type="number" step="0.0000001" data-tipo="potencia" data-periodo="${item.key}" 
                    value="${precioActual.toFixed(7)}" 
                    class="input-usuario-precio w-28 text-right px-2 py-1 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
            </td>
            <td class="py-2.5 px-4 text-right font-bold text-slate-900">${precioNuevo.toFixed(7)} €</td>
            <td class="py-2.5 px-4 text-right font-semibold ${rebaja > 0 ? 'text-emerald-600' : 'text-slate-400'}">-${(rebaja).toFixed(7)} €</td>
        `;
        tbodyPotencia.appendChild(tr);
    });

    // 3. Desglose de Excedentes Solares (Alineado exactamente a 5 columnas)
    if (tbodyExcedentes) {
        const precioExcedenteActual = parseFloat(tarifa.excedente) || 0;
        const aplicaExcedentes = estrategia === 'mixta' || estrategia === 'excedentes';
        const mejoraExcedente = aplicaExcedentes ? precioExcedenteActual * (factor * 0.5) : 0;
        const precioExcedenteNuevo = precioExcedenteActual + mejoraExcedente;

        const trEx = document.createElement('tr');
        trEx.innerHTML = `
            <td class="py-2.5 px-4 font-medium uppercase text-slate-700">Excedentes Solares</td>
            <td class="py-2.5 px-4 text-right text-slate-600">${precioExcedenteActual.toFixed(7)} €</td>
            <td class="py-2.5 px-4 text-right">
                <input type="number" step="0.0000001" data-tipo="excedente" data-periodo="excedente" 
                    value="${precioExcedenteActual.toFixed(7)}" 
                    class="input-usuario-precio w-28 text-right px-2 py-1 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
            </td>
            <td class="py-2.5 px-4 text-right font-bold text-slate-900">${precioExcedenteNuevo.toFixed(7)} €</td>
            <td class="py-2.5 px-4 text-right font-semibold ${mejoraExcedente > 0 ? 'text-emerald-600' : 'text-slate-400'}">+${(mejoraExcedente).toFixed(7)} €</td>
        `;
        tbodyExcedentes.appendChild(trEx);
    }

    // Activar eventos en tiempo real para los nuevos inputs de precio de usuario
    document.querySelectorAll('.input-usuario-precio').forEach(input => {
        input.addEventListener('input', calcularCosteConPreciosUsuario);
    });

    // Calcular el valor inicial del usuario al renderizar
    calcularCosteConPreciosUsuario();
}

function calcularCosteConPreciosUsuario() {
    let inputs = document.querySelectorAll('.input-usuario-precio');
    if (inputs.length === 0) return;

    // Recogemos los valores introducidos por el usuario
    let preciosUser = {};
    inputs.forEach(input => {
        let tipo = input.getAttribute('data-tipo');
        let periodo = input.getAttribute('data-periodo');
        if (!preciosUser[tipo]) preciosUser[tipo] = {};
        preciosUser[tipo][periodo] = parseFloat(input.value) || 0;
    });

    // 1. Recuperamos los datos globales desde la respuesta limpia de la Edge Function
    const kwh = datosAnalisisGlobal.resumen_energia || { punta: 0, llano: 0, valle: 0, excedentes: 0 };
    const potPuntaW = datosAnalisisGlobal.pot_punta_w || 0;
    const potValleW = datosAnalisisGlobal.pot_valle_w || 0;
    const factorMeses = datosAnalisisGlobal.factor_meses_fijo || 12;

    const selectRivalIndex = document.getElementById('select-tarifa-rival').value;
    if (selectRivalIndex === "") return;

    // Corregido: accedemos directamente al array 'mercado' de la respuesta global
    const tarifaRival = datosAnalisisGlobal.mercado[selectRivalIndex];
    const tarifaRenovacion = datosAnalisisGlobal.tarifa_renovacion;

    // 2. Cálculo del coste de energía con los precios introducidos por el usuario
    let pEnergia = preciosUser['energia'] || {};
    let costeEnergiaUser = (kwh.punta * (pEnergia.punta ?? tarifaRival.punta)) +
                           (kwh.llano * (pEnergia.llano ?? tarifaRival.llano)) +
                           (kwh.valle * (pEnergia.valle ?? tarifaRival.valle));

    // 3. Cálculo exacto del coste fijo de potencia con los precios nuevos del usuario
    let pPotencia = preciosUser['potencia'] || {};
    let precioFijoPuntaUser = pPotencia.fijo_punta ?? pPotencia.punta ?? tarifaRival.fijo_punta;
    let precioFijoValleUser = pPotencia.fijo_valle ?? pPotencia.valle ?? tarifaRival.fijo_valle;

    let costeFijoPuntaUser = (potPuntaW / 1000) * 30 * precioFijoPuntaUser * factorMeses;
    let costeFijoValleUser = (potValleW / 1000) * 30 * precioFijoValleUser * factorMeses;
    let costeFijoUser = costeFijoPuntaUser + costeFijoValleUser;

    // 4. Excedentes con precio de usuario (o el de la tarifa si no se modificó)
    let pExcedente = preciosUser['excedente']?.excedente ?? tarifaRival.excedente;
    let costeExcedentesUser = kwh.excedentes * pExcedente;

    // 5. Coste total resultante para el usuario
    let costeTotalUser = costeEnergiaUser + costeFijoUser - costeExcedentesUser;
    if (costeTotalUser < 0) costeTotalUser = 0;

    // 6. Ahorro resultante comparado con la tarifa "Renovación"
    let ahorroUsuarioFinal = tarifaRenovacion.coste_total - costeTotalUser;

    // 7. Pintar en el DOM el nuevo indicador de ahorro con precios de usuario
    const labelAhorroUser = document.getElementById('sim-ahorro-usuario');
    if (labelAhorroUser) {
        labelAhorroUser.textContent = `${ahorroUsuarioFinal.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
        labelAhorroUser.className = `text-lg font-bold ${ahorroUsuarioFinal >= 0 ? 'text-emerald-600' : 'text-rose-600'}`;
    }
}

document.addEventListener('input', (e) => {
    if (e.target.classList.contains('input-usuario-precio')) {
        calcularCosteConPreciosUsuario();
    }
});
