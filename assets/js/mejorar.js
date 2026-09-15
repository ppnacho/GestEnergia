import { supabase } from './supabaseClient.js';

let datosAnalisisGlobal = null; 
let tarifaPreseleccionadaUrl = null; // Para guardar la tarifa que viene en la URL

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Validación de sesión
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
            window.location.href = '../index.html'
            return
        }
    }

    // 2. Botón Volver al análisis
    const btnVolver = document.getElementById('btn-volver')
    if (btnVolver) {
        btnVolver.addEventListener('click', () => {
            window.location.href = '../analisis/analisistarifas.html'
        })
    }

    // 3. Listeners para los selectores de simulación interactiva
    const selectTarifaRival = document.getElementById('select-tarifa-rival')
    const selectEstrategia = document.getElementById('select-estrategia')
    const rangeIntensidad = document.getElementById('range-intensidad')

    if (selectTarifaRival) selectTarifaRival.addEventListener('change', actualizarSimulacion)
    if (selectEstrategia) selectEstrategia.addEventListener('change', actualizarSimulacion)
    if (rangeIntensidad) rangeIntensidad.addEventListener('input', (e) => {
        const valElem = document.getElementById('valor-intensidad');
        if (valElem) valElem.textContent = `${e.target.value} €`;
        actualizarSimulacion()
    })

    // 4. Capturar TODOS los parámetros pasados por URL desde analisistarifas.html
    const urlParams = new URLSearchParams(window.location.search)
    const suministro = urlParams.get('suministro')
    const anio = urlParams.get('anio')
    const periodo = urlParams.get('periodo') || 'todos'
    tarifaPreseleccionadaUrl = urlParams.get('tarifa') // <-- Capturamos la tarifa si viene en la URL

    // Opcional: Mostrar el alias o suministro actual
    const aliasSuministro = sessionStorage.getItem('alias_suministro')
    const elemTitulo = document.getElementById('titulo-suministro-actual')
    if (elemTitulo && aliasSuministro) {
        elemTitulo.textContent = aliasSuministro
    }

    if (!suministro || !anio) {
        alert('No se han especificado el suministro o el año para la simulación.')
        window.location.href = '../analisis/analisistarifas.html'
        return
    }

    // 5. Lanzar el análisis automáticamente
    await ejecutarAnalisisMejoraAutomatico(suministro, anio, periodo)
})

async function ejecutarAnalisisMejoraAutomatico(suministro, anio, periodo) {
    try {
        const { data, error } = await supabase.functions.invoke('analisis-tarifas', {
            body: { 
                suministro, 
                anio: anio !== 'todos' ? parseInt(anio) : 'todos', 
                periodo 
            }
        })

        if (error) throw error
        if (!data || data.error) {
            alert('Error en el análisis de mejora: ' + (data?.error || error.message))
            return
        }

        datosAnalisisGlobal = data

        // Pintar resumen de energía y meses
        pintarResumenEnergiaYMeses(data.resumen_energia)

        // Poblamos el selector y autoseleccionamos si venía en la URL
        poblarSelectorTarifasRivales(data.mercado, tarifaPreseleccionadaUrl)

        actualizarSimulacion()

    } catch (err) {
        console.error('Error al invocar la Edge Function para mejora:', err)
        alert('No se pudo cargar el análisis para la simulación.')
    }
}

function pintarResumenEnergiaYMeses(resumenEnergia) {
    const contenedor = document.getElementById('badge-contexto');
    if (!contenedor) return;

    // Recuperamos los parámetros directamente de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const anioUrl = urlParams.get('anio') || 'Todos los años';
    const periodoUrl = urlParams.get('periodo') || 'todos';

    // Formatear texto del periodo
    let periodoTexto = 'Todos los periodos';
    if (periodoUrl === 'alta') periodoTexto = 'Temporada Alta (May-Sep)';
    if (periodoUrl === 'baja') periodoTexto = 'Temporada Baja (Oct-Abr)';

    // Recuperamos el nombre/alias del suministro
    const aliasSuministro = sessionStorage.getItem('alias_suministro') || 'Suministro seleccionado';

    // Inyectamos con salto de línea (bloque inferior dividido en dos niveles)
    contenedor.innerHTML = `
        <!-- Fila 1: Nombre del suministro -->
        <div class="flex items-center justify-between">
            <span class="text-xs uppercase tracking-wider text-slate-400 font-semibold">Suministro</span>
            <span class="text-base font-bold text-slate-900">${aliasSuministro}</span>
        </div>

        <!-- Fila 2: Año y Periodos en formato vertical -->
        <div class="pt-2.5 border-t border-slate-100 mt-1.5 flex flex-col gap-1">
            <div class="flex items-center justify-between">
                <span class="text-xs text-slate-400 font-semibold uppercase tracking-wider">Año</span>
                <span class="text-xs font-bold text-slate-700">${anioUrl === 'todos' ? 'Todos los años' : anioUrl}</span>
            </div>
            <div class="flex items-center justify-between">
                <span class="text-xs text-slate-400 font-semibold uppercase tracking-wider">Periodo</span>
                <span class="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                    ${periodoTexto}
                </span>
            </div>
        </div>
    `;
}

function poblarSelectorTarifasRivales(mercado, tarifaUrl) {
    const select = document.getElementById('select-tarifa-rival')
    if (!select) return

    select.innerHTML = '<option value="" disabled selected>Selecciona una tarifa a batir...</option>'
    
    let indexASelected = null;

    mercado.forEach((t, index) => {
        const opt = document.createElement('option')
        opt.value = index 
        opt.textContent = `${t.nombre} (${t.coste_total.toFixed(2)} €)`
        select.appendChild(opt)

        // Si coincide con la que venía en la URL (por nombre exacto o ID), la marcamos
        if (tarifaUrl && (t.nombre.toLowerCase() === tarifaUrl.toLowerCase() || t.id == tarifaUrl)) {
            indexASelected = index
        }
    })

    // Si se encontró la tarifa de la url, la seleccionamos y disparamos el evento
    if (indexASelected !== null) {
        select.value = indexASelected
    }
}

function actualizarSimulacion() {
    if (!datosAnalisisGlobal) return

    const selectRivalIndex = document.getElementById('select-tarifa-rival').value
    if (selectRivalIndex === "") return

    const tarifaRival = datosAnalisisGlobal.mercado[selectRivalIndex]
    const tarifaRenovacion = datosAnalisisGlobal.tarifa_renovacion
    const estrategia = document.getElementById('select-estrategia').value
    const margenSeguridad = parseFloat(document.getElementById('range-intensidad').value) || 0

    const costeActualRival = tarifaRival.coste_total
    const costeObjetivo = tarifaRenovacion.coste_total - margenSeguridad
    const recorteNecesario = Math.max(0, costeActualRival - costeObjetivo)

    // Clonamos la tarifa rival para modificar sus precios unitarios según la estrategia
    let tarifaModificada = JSON.parse(JSON.stringify(tarifaRival))

    // Aplicar ajustes según la estrategia seleccionada
    if (estrategia === 'energia') {
        const factor = tarifaRival.coste_energia > 0 ? Math.max(0, (tarifaRival.coste_energia - recorteNecesario) / tarifaRival.coste_energia) : 1
        tarifaModificada.punta *= factor
        tarifaModificada.llano *= factor
        tarifaModificada.valle *= factor
    } else if (estrategia === 'potencia') {
        const factor = tarifaRival.coste_fijo > 0 ? Math.max(0, (tarifaRival.coste_fijo - recorteNecesario) / tarifaRival.coste_fijo) : 1
        tarifaModificada.fijo_punta *= factor
        tarifaModificada.fijo_valle *= factor
    } else if (estrategia === 'excedentes') {
        tarifaModificada.excedente += (recorteNecesario / (datosAnalisisGlobal.resumen_energia.excedentes || 1))
    } else {
        // Mixta: Repartir el recorte entre energía y potencia proporcionalmente
        const totalBase = tarifaRival.coste_energia + tarifaRival.coste_fijo
        const factor = totalBase > 0 ? Math.max(0, (totalBase - recorteNecesario) / totalBase) : 1
        tarifaModificada.punta *= factor
        tarifaModificada.llano *= factor
        tarifaModificada.valle *= factor
        tarifaModificada.fijo_punta *= factor
        tarifaModificada.fijo_valle *= factor
    }

    // Recalcular costes finales con los precios modificados
    const resumenEnergia = datosAnalisisGlobal.resumen_energia
    const factorMeses = resumenEnergia.factor_meses || 12
    const diasTotales = factorMeses * 30

    const potPuntaKw = 4.5
    const potValleKw = 5.5

    const nuevoCosteFijo = (potPuntaKw * tarifaModificada.fijo_punta * diasTotales) + (potValleKw * tarifaModificada.fijo_valle * diasTotales)
    const nuevoCosteEnergia = (resumenEnergia.punta * tarifaModificada.punta) + (resumenEnergia.llano * tarifaModificada.llano) + (resumenEnergia.valle * tarifaModificada.valle)
    const nuevoCosteExcedentes = resumenEnergia.excedentes * tarifaModificada.excedente

    const nuevoCosteTotal = nuevoCosteFijo + nuevoCosteEnergia - nuevoCosteExcedentes
    const ahorroCliente = tarifaRival.coste_total - nuevoCosteTotal
    const diferenciaRenovacion = nuevoCosteTotal - tarifaRenovacion.coste_total
    const ahorroConPrecioUsuario = tarifaRenovacion.coste_total - nuevoCosteTotal

    // Actualizar Tarjetas UI Principales
    const elCosteOrig = document.getElementById('sim-coste-original')
    const elCosteNuevo = document.getElementById('sim-coste-nuevo')
    const elDiffRenov = document.getElementById('sim-diferencia-renovacion')
    const elAhorroCl = document.getElementById('sim-ahorro-cliente')
    const elAhorroUsuario = document.getElementById('sim-ahorro-usuario')
    const elBadgeEstr = document.getElementById('badge-estrategia-aplicada')

    if (elCosteOrig) elCosteOrig.textContent = `${costeActualRival.toFixed(2)} €`
    if (elCosteNuevo) elCosteNuevo.textContent = `${nuevoCosteTotal.toFixed(2)} €`
    if (elDiffRenov) elDiffRenov.textContent = `(${diferenciaRenovacion <= 0 ? '' : '+'}${diferenciaRenovacion.toFixed(2)} € vs Renovación)`
    if (elAhorroCl) elAhorroCl.textContent = `${ahorroCliente.toFixed(2)} €`
    if (elAhorroUsuario) elAhorroUsuario.textContent = `${ahorroConPrecioUsuario.toFixed(2)} €`
    if (elBadgeEstr) elBadgeEstr.textContent = `Estrategia activa: ${estrategia.toUpperCase()}`

    // Rellenar las tablas detalladas de precios unitarios
    renderizarTablasDetalladas(tarifaRival, tarifaModificada)
}

function renderizarTablasDetalladas(original, modificado) {
    // 1. Tabla Energía (€/kWh con 7 decimales)
    const tbodyEnergia = document.getElementById('tabla-energia-detallada')
    if (tbodyEnergia) {
        const periodosEnergia = [
            { nombre: 'Punta', orig: original.punta, mod: modificado.punta },
            { nombre: 'Llano', orig: original.llano, mod: modificado.llano },
            { nombre: 'Valle', orig: original.valle, mod: modificado.valle }
        ]
        tbodyEnergia.innerHTML = periodosEnergia.map(p => {
            const diff = p.mod - p.orig
            return `
                <tr class="border-b border-slate-100 text-xs">
                    <td class="py-2.5 px-4 font-medium text-slate-800">${p.nombre}</td>
                    <td class="py-2.5 px-4 text-right text-slate-600">${p.orig.toFixed(7)} €</td>
                    <td class="py-2.5 px-4 text-right text-slate-400">-</td>
                    <td class="py-2.5 px-4 text-right font-bold text-indigo-600">${p.mod.toFixed(7)} €</td>
                    <td class="py-2.5 px-4 text-right ${diff <= 0 ? 'text-emerald-600' : 'text-red-600'}">${diff <= 0 ? '' : '+'}${diff.toFixed(7)}</td>
                </tr>
            `
        }).join('')
    }

    // 2. Tabla Potencia (€/kW·día)
    const tbodyPotencia = document.getElementById('tabla-potencia-detallada')
    if (tbodyPotencia) {
        const diffPunta = modificado.fijo_punta - original.fijo_punta
        const diffValle = modificado.fijo_valle - original.fijo_valle
        tbodyPotencia.innerHTML = `
            <tr>
                <td class="py-2.5 px-4 font-medium">Punta (P1)</td>
                <td class="py-2.5 px-4 text-right">${original.fijo_punta.toFixed(6)} €</td>
                <td class="py-2.5 px-4 text-right font-bold text-indigo-600">${modificado.fijo_punta.toFixed(6)} €</td>
                <td class="py-2.5 px-4 text-right ${diffPunta <= 0 ? 'text-emerald-600' : 'text-red-600'}">${diffPunta <= 0 ? '' : '+'}${diffPunta.toFixed(6)}</td>
            </tr>
            <tr>
                <td class="py-2.5 px-4 font-medium">Valle (P2)</td>
                <td class="py-2.5 px-4 text-right">${original.fijo_valle.toFixed(6)} €</td>
                <td class="py-2.5 px-4 text-right font-bold text-indigo-600">${modificado.fijo_valle.toFixed(6)} €</td>
                <td class="py-2.5 px-4 text-right ${diffValle <= 0 ? 'text-emerald-600' : 'text-red-600'}">${diffValle <= 0 ? '' : '+'}${diffValle.toFixed(6)}</td>
            </tr>
        `
    }

    // 3. Tabla Excedentes (€/kWh)
    const tbodyExcedentes = document.getElementById('tabla-excedentes-detallada')
    if (tbodyExcedentes) {
        const diffExcedente = modificado.excedente - original.excedente
        tbodyExcedentes.innerHTML = `
            <tr>
                <td class="py-2.5 px-4 font-medium">Compensación Solar</td>
                <td class="py-2.5 px-4 text-right">${original.excedente.toFixed(5)} €</td>
                <td class="py-2.5 px-4 text-right font-bold text-indigo-600">${modificado.excedente.toFixed(5)} €</td>
                <td class="py-2.5 px-4 text-right text-emerald-600">+${diffExcedente.toFixed(5)}</td>
            </tr>
        `
    }
}
