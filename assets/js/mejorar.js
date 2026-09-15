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
        document.getElementById('valor-intensidad').textContent = `${e.target.value} €`
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

        // Pintar resumen de energía y meses (con 3 decimales)
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
    if (!resumenEnergia) return

    const badgeMeses = document.getElementById('resumen-meses-badge')
    if (badgeMeses) {
        badgeMeses.textContent = `${resumenEnergia.factor_meses} meses`
    }

    const formato3Dec = (valor) => (valor || 0).toLocaleString('es-ES', { 
        minimumFractionDigits: 3, 
        maximumFractionDigits: 3 
    })

    const elPunta = document.getElementById('kwh-punta')
    const elLlano = document.getElementById('kwh-llano')
    const elValle = document.getElementById('kwh-valle')
    const elExcedentes = document.getElementById('kwh-excedentes')

    if (elPunta) elPunta.textContent = `${formato3Dec(resumenEnergia.punta)} kWh`
    if (elLlano) elLlano.textContent = `${formato3Dec(resumenEnergia.llano)} kWh`
    if (elValle) elValle.textContent = `${formato3Dec(resumenEnergia.valle)} kWh`
    if (elExcedentes) elExcedentes.textContent = `${formato3Dec(resumenEnergia.excedentes)} kWh`
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

    const elCosteOrig = document.getElementById('sim-coste-original')
    const elCosteNuevo = document.getElementById('sim-coste-nuevo')
    const elDiffRenov = document.getElementById('sim-diferencia-renovacion')
    const elAhorroCl = document.getElementById('sim-ahorro-cliente')
    const elBadgeEstr = document.getElementById('badge-estrategia-aplicada')

    if (elCosteOrig) elCosteOrig.textContent = `${costeActualRival.toFixed(2)} €`

    let factorDescuento = 0
    const totalEnergiaYFijo = tarifaRival.coste_energia + tarifaRival.coste_fijo

    if (costeActualRival > 0 && recorteNecesario > 0 && totalEnergiaYFijo > 0) {
        if (estrategia === 'mixta') {
            factorDescuento = recorteNecesario / totalEnergiaYFijo
        } else if (estrategia === 'energia') {
            factorDescuento = tarifaRival.coste_energia > 0 ? recorteNecesario / tarifaRival.coste_energia : 0
        } else if (estrategia === 'potencia') {
            factorDescuento = tarifaRival.coste_fijo > 0 ? recorteNecesario / tarifaRival.coste_fijo : 0
        } else {
            factorDescuento = recorteNecesario / totalEnergiaYFijo
        }
    }

    factorDescuento = Math.min(0.50, Math.max(0, factorDescuento))

    let costeNuevoRival = costeActualRival - recorteNecesario
    if (costeNuevoRival < 0) costeNuevoRival = 0

    if (elCosteNuevo) elCosteNuevo.textContent = `${costeNuevoRival.toFixed(2)} €`
    
    const diferenciaRenovacion = costeNuevoRival - tarifaRenovacion.coste_total
    if (elDiffRenov) {
        elDiffRenov.textContent = `(${diferenciaRenovacion <= 0 ? '' : '+'}${diferenciaRenovacion.toFixed(2)} € vs Renovación)`
    }
    
    const ahorroCliente = tarifaRenovacion.coste_total - costeNuevoRival
    if (elAhorroCl) {
        elAhorroCl.textContent = `${ahorroCliente.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
    }

    if (elBadgeEstr) {
        elBadgeEstr.textContent = `Estrategia: ${estrategia.toUpperCase()} (Ajuste ~${(factorDescuento * 100).toFixed(1)}%)`
    }
}
