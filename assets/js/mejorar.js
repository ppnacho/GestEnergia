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

    const aliasSuministro = sessionStorage.getItem('alias_suministro') || suministro;

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

    // Listener para el checkbox de copiar precios nuevos automáticamente
    const checkCopiarNuevos = document.getElementById('check-copiar-nuevos');
    if (checkCopiarNuevos) {
        checkCopiarNuevos.addEventListener('change', function() {
            const usarNuevos = this.checked;
            document.querySelectorAll('.input-usuario-precio').forEach(input => {
                const precioActual = input.getAttribute('data-precio-actual');
                const precioNuevo = input.getAttribute('data-precio-nuevo');
                input.value = parseFloat(usarNuevos ? precioNuevo : precioActual).toFixed(7);
            });
            calcularCosteConPreciosUsuario();
        });
    }

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

    const kwh = datosAnalisisGlobal.resumen_energia || { punta: 0, llano: 0, valle: 0, excedentes: 0 };
    const potPuntaW = datosAnalisisGlobal.pot_punta_w || 0;
    const potValleW = datosAnalisisGlobal.pot_valle_w || 0;
    const factorMeses = datosAnalisisGlobal.factor_meses_fijo || 12;

    const costeActualRival = tarifaRival.coste_total;
    
    // El coste objetivo de la contraoferta se alinea directamente al total de la tarifa de renovación
    const costeObjetivoContraoferta = Math.max(0, tarifaRenovacion.coste_total);
    const recorteNecesario = Math.max(0, costeActualRival - costeObjetivoContraoferta);

    // Mostrar los valores principales en las tarjetas superiores conservadas
    document.getElementById('sim-coste-original').textContent = `${costeActualRival.toFixed(2)} €`;
    
    const labelCosteNuevo = document.getElementById('sim-coste-nuevo');
    if (labelCosteNuevo) {
        labelCosteNuevo.textContent = `${costeObjetivoContraoferta.toFixed(2)} €`;
    }

    // Costes base actuales de la rival por componentes
    const cEnergiaBase = (kwh.punta * (tarifaRival.punta || 0)) +
                         (kwh.llano * (tarifaRival.llano || 0)) +
                         (kwh.valle * (tarifaRival.valle || 0));

    const cPotenciaBase = ((potPuntaW / 1000) * 30 * (tarifaRival.fijo_punta || 0) * factorMeses) +
                          ((potValleW / 1000) * 30 * (tarifaRival.fijo_valle || 0) * factorMeses);

    let factorEnergia = 0;
    let factorPotencia = 0;
    let incrementoExcedente = 0;

    // Repartir el recorte necesario según la estrategia seleccionada
    if (recorteNecesario > 0) {
        if (estrategia === 'energia' && cEnergiaBase > 0) {
            factorEnergia = Math.min(0.90, recorteNecesario / cEnergiaBase);
        } else if (estrategia === 'potencia' && cPotenciaBase > 0) {
            factorPotencia = Math.min(0.90, recorteNecesario / cPotenciaBase);
        } else if (estrategia === 'excedentes' && kwh.excedentes > 0) {
            incrementoExcedente = recorteNecesario / kwh.excedentes;
        } else if (estrategia === 'mixta') {
            const baseMix = cEnergiaBase + cPotenciaBase;
            if (baseMix > 0) {
                const fMix = Math.min(0.60, recorteNecesario / baseMix);
                factorEnergia = fMix;
                factorPotencia = fMix;
            }
        }
    }

    // Cada vez que se recalcula la simulación, desmarcamos el checkbox por limpieza
    const checkCopiarNuevos = document.getElementById('check-copiar-nuevos');
    if (checkCopiarNuevos) checkCopiarNuevos.checked = false;

    renderizarTablasDetalladas(tarifaRival, estrategia, {
        factorEnergia,
        factorPotencia,
        incrementoExcedente
    });
}

function renderizarTablasDetalladas(tarifa, estrategia, ajustes) {
    const tbodyEnergia = document.getElementById('tabla-energia-detallada');
    const tbodyPotencia = document.getElementById('tabla-potencia-detallada');
    const tbodyExcedentes = document.getElementById('tabla-excedentes-detallada');
    
    tbodyEnergia.innerHTML = '';
    tbodyPotencia.innerHTML = '';
    if (tbodyExcedentes) tbodyExcedentes.innerHTML = '';

    document.getElementById('badge-estrategia-aplicada').textContent = `Estrategia activa: ${estrategia.toUpperCase()}`;

    // 1. Desglose de Energía
    ['punta', 'llano', 'valle'].forEach(periodo => {
        const precioActual = parseFloat(tarifa[periodo]) || 0; 
        const rebaja = precioActual * ajustes.factorEnergia;
        const precioNuevo = Math.max(0.0000001, precioActual - rebaja);
        const diffAuto = precioNuevo - precioActual;
        const pctAuto = precioActual > 0 ? (diffAuto / precioActual) * 100 : 0;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="py-2.5 px-4 font-medium uppercase text-slate-700">${periodo}</td>
            <td class="py-2.5 px-4 text-right text-slate-600">${precioActual.toFixed(7)} €</td>
            <td class="py-2.5 px-4 text-right">
                <input type="number" step="0.0000001" data-tipo="energia" data-periodo="${periodo}" 
                    data-precio-actual="${precioActual}" data-precio-nuevo="${precioNuevo}"
                    value="${precioActual.toFixed(7)}" 
                    class="input-usuario-precio w-32 text-right px-2 py-1 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
            </td>
            <td class="py-2.5 px-4 text-right font-bold text-slate-900">${precioNuevo.toFixed(7)} €</td>
            <td class="py-2.5 px-4 text-right font-semibold whitespace-nowrap ${diffAuto < 0 ? 'text-emerald-600' : 'text-slate-400'}">
                ${diffAuto < 0 ? diffAuto.toFixed(7) : '-0.0000000'} € <span class="text-xs font-normal text-slate-400 ml-1">(${pctAuto.toFixed(1)}%)</span>
            </td>
            <td class="py-2.5 px-4 text-right font-semibold whitespace-nowrap text-slate-400" data-diff-tipo="energia" data-diff-periodo="${periodo}">
                -0.0000000 € <span class="text-xs font-normal text-slate-400 ml-1">(0.0%)</span>
            </td>
        `;
        tbodyEnergia.appendChild(tr);
    });

    // 2. Desglose de Potencia
    const mapeoPotencia = [
        { key: 'fijo_punta', label: 'p1' },
        { key: 'fijo_valle', label: 'p2' }
    ];

    mapeoPotencia.forEach(item => {
        const precioActual = parseFloat(tarifa[item.key]) || 0;
        const rebaja = precioActual * ajustes.factorPotencia;
        const precioNuevo = Math.max(0.0000001, precioActual - rebaja);
        const diffAuto = precioNuevo - precioActual;
        const pctAuto = precioActual > 0 ? (diffAuto / precioActual) * 100 : 0;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="py-2.5 px-4 font-medium uppercase text-slate-700">${item.label}</td>
            <td class="py-2.5 px-4 text-right text-slate-600">${precioActual.toFixed(7)} €</td>
            <td class="py-2.5 px-4 text-right">
                <input type="number" step="0.0000001" data-tipo="potencia" data-periodo="${item.key}" 
                    data-precio-actual="${precioActual}" data-precio-nuevo="${precioNuevo}"
                    value="${precioActual.toFixed(7)}" 
                    class="input-usuario-precio w-32 text-right px-2 py-1 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
            </td>
            <td class="py-2.5 px-4 text-right font-bold text-slate-900">${precioNuevo.toFixed(7)} €</td>
            <td class="py-2.5 px-4 text-right font-semibold whitespace-nowrap ${diffAuto < 0 ? 'text-emerald-600' : 'text-slate-400'}">
                ${diffAuto < 0 ? diffAuto.toFixed(7) : '-0.0000000'} € <span class="text-xs font-normal text-slate-400 ml-1">(${pctAuto.toFixed(1)}%)</span>
            </td>
            <td class="py-2.5 px-4 text-right font-semibold whitespace-nowrap text-slate-400" data-diff-tipo="potencia" data-diff-periodo="${item.key}">
                -0.0000000 € <span class="text-xs font-normal text-slate-400 ml-1">(0.0%)</span>
            </td>
        `;
        tbodyPotencia.appendChild(tr);
    });

    // 3. Desglose de Excedentes Solares
    if (tbodyExcedentes) {
        const precioExcedenteActual = parseFloat(tarifa.excedente) || 0;
        const precioExcedenteNuevo = precioExcedenteActual + ajustes.incrementoExcedente;
        const diffAutoEx = precioExcedenteNuevo - precioExcedenteActual;
        const pctAutoEx = precioExcedenteActual > 0 ? (diffAutoEx / precioExcedenteActual) * 100 : 0;

        const trEx = document.createElement('tr');
        trEx.innerHTML = `
            <td class="py-2.5 px-4 font-medium uppercase text-slate-700">Excedentes Solares</td>
            <td class="py-2.5 px-4 text-right text-slate-600">${precioExcedenteActual.toFixed(7)} €</td>
            <td class="py-2.5 px-4 text-right">
                <input type="number" step="0.0000001" data-tipo="excedente" data-periodo="excedente" 
                    data-precio-actual="${precioExcedenteActual}" data-precio-nuevo="${precioExcedenteNuevo}"
                    value="${precioExcedenteActual.toFixed(7)}" 
                    class="input-usuario-precio w-32 text-right px-2 py-1 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
            </td>
            <td class="py-2.5 px-4 text-right font-bold text-slate-900">${precioExcedenteNuevo.toFixed(7)} €</td>
            <td class="py-2.5 px-4 text-right font-semibold whitespace-nowrap ${diffAutoEx > 0 ? 'text-emerald-600' : 'text-slate-400'}">
                ${diffAutoEx >= 0 ? '+' : ''}${diffAutoEx.toFixed(7)} € <span class="text-xs font-normal text-slate-400 ml-1">(${pctAutoEx >= 0 ? '+' : ''}${pctAutoEx.toFixed(1)}%)</span>
            </td>
            <td class="py-2.5 px-4 text-right font-semibold whitespace-nowrap text-slate-400" data-diff-tipo="excedente" data-diff-periodo="excedente">
                +0.0000000 € <span class="text-xs font-normal text-slate-400 ml-1">(+0.0%)</span>
            </td>
        `;
        tbodyExcedentes.appendChild(trEx);
    }

    document.querySelectorAll('.input-usuario-precio').forEach(input => {
        input.addEventListener('input', calcularCosteConPreciosUsuario);
    });

    calcularCosteConPreciosUsuario();
}

function calcularCosteConPreciosUsuario() {
    let inputs = document.querySelectorAll('.input-usuario-precio');
    if (inputs.length === 0) return;

    let preciosUser = {};
    inputs.forEach(input => {
        let tipo = input.getAttribute('data-tipo');
        let periodo = input.getAttribute('data-periodo');
        let precioActual = parseFloat(input.getAttribute('data-precio-actual')) || 0;
        let precioUser = parseFloat(input.value) || 0;

        if (!preciosUser[tipo]) preciosUser[tipo] = {};
        preciosUser[tipo][periodo] = precioUser;

        let diffCell = document.querySelector(`[data-diff-tipo="${tipo}"][data-diff-periodo="${periodo}"]`);
        if (diffCell) {
            let pct = precioActual > 0 ? ((precioUser - precioActual) / precioActual) * 100 : 0;

            if (precioUser !== precioActual) {
                let isAhorro = tipo === 'excedente' ? (precioUser > precioActual) : (precioUser < precioActual);
                let signPct = pct > 0 ? '+' : '';

                diffCell.innerHTML = `${tipo === 'excedente' && precioUser > precioActual ? '+' : (isAhorro ? '-' : '+')}${Math.abs(precioUser - precioActual).toFixed(7)} € <span class="text-xs font-normal text-slate-400 ml-1">(${signPct}${pct.toFixed(1)}%)</span>`;
                diffCell.className = `py-2.5 px-4 text-right font-semibold whitespace-nowrap ${isAhorro ? 'text-emerald-600' : 'text-rose-600'}`;
            } else {
                diffCell.innerHTML = `${tipo === 'excedente' ? '+' : '-'}0.0000000 € <span class="text-xs font-normal text-slate-400 ml-1">(0.0%)</span>`;
                diffCell.className = 'py-2.5 px-4 text-right font-semibold whitespace-nowrap text-slate-400';
            }
        }
    });

    const kwh = datosAnalisisGlobal.resumen_energia || { punta: 0, llano: 0, valle: 0, excedentes: 0 };
    const potPuntaW = datosAnalisisGlobal.pot_punta_w || 0;
    const potValleW = datosAnalisisGlobal.pot_valle_w || 0;
    const factorMeses = datosAnalisisGlobal.factor_meses_fijo || 12;

    const selectRivalIndex = document.getElementById('select-tarifa-rival').value;
    if (selectRivalIndex === "") return;

    const tarifaRival = datosAnalisisGlobal.mercado[selectRivalIndex];
    const tarifaRenovacion = datosAnalisisGlobal.tarifa_renovacion;

    let pEnergia = preciosUser['energia'] || {};
    let costeEnergiaUser = (kwh.punta * (pEnergia.punta ?? tarifaRival.punta)) +
                           (kwh.llano * (pEnergia.llano ?? tarifaRival.llano)) +
                           (kwh.valle * (pEnergia.valle ?? tarifaRival.valle));

    let pPotencia = preciosUser['potencia'] || {};
    let precioFijoPuntaUser = pPotencia.fijo_punta ?? tarifaRival.fijo_punta;
    let precioFijoValleUser = pPotencia.fijo_valle ?? tarifaRival.fijo_valle;

    let costeFijoPuntaUser = (potPuntaW / 1000) * 30 * precioFijoPuntaUser * factorMeses;
    let costeFijoValleUser = (potValleW / 1000) * 30 * precioFijoValleUser * factorMeses;
    let costeFijoUser = costeFijoPuntaUser + costeFijoValleUser;

    let pExcedente = preciosUser['excedente']?.excedente ?? tarifaRival.excedente;
    let costeExcedentesUser = kwh.excedentes * pExcedente;

    let costeTotalUser = costeEnergiaUser + costeFijoUser - costeExcedentesUser;
    if (costeTotalUser < 0) costeTotalUser = 0;

    let ahorroUsuarioFinal = tarifaRenovacion.coste_total - costeTotalUser;
    const labelAhorroUser = document.getElementById('sim-ahorro-usuario');
    if (labelAhorroUser) {
        labelAhorroUser.textContent = `${ahorroUsuarioFinal.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
        labelAhorroUser.className = `text-lg font-bold ${ahorroUsuarioFinal >= 0 ? 'text-emerald-600' : 'text-rose-600'}`;
    }
}
