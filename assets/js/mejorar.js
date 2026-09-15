import { supabase } from './supabaseClient.js';

let datosAnalisisGlobal = null; // Almacenará la respuesta limpia de la Edge Function

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

    // 4. Capturar los parámetros pasados por URL desde analisistarifas.html
    const urlParams = new URLSearchParams(window.location.search)
    const suministro = urlParams.get('suministro')
    const anio = urlParams.get('anio')
    const periodo = urlParams.get('periodo') || 'todos'

    // Opcional: Mostrar el alias o suministro actual si tienes un elemento para ello
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

    // 5. Lanzar el análisis automáticamente con los datos heredados
    await ejecutarAnalisisMejoraAutomatico(suministro, anio, periodo)
})

// Ejecuta la llamada a la Edge Function de forma automática con los parámetros de la URL
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

        // Guardamos la respuesta completa de la Edge Function en la variable global
        datosAnalisisGlobal = data

        // Poblamos el selector de tarifas rivales con las opciones de mercado que devuelve la función
        poblarSelectorTarifasRivales(data.mercado)

        // Actualizamos la simulación visual con los datos frescos
        actualizarSimulacion()

    } catch (err) {
        console.error('Error al invocar la Edge Function para mejora:', err)
        alert('No se pudo cargar el análisis para la simulación.')
    }
}

function poblarSelectorTarifasRivales(mercado) {
    const select = document.getElementById('select-tarifa-rival')
    if (!select) return

    select.innerHTML = '<option value="" disabled selected>Selecciona una tarifa a batir...</option>'
    
    mercado.forEach((t, index) => {
        const opt = document.createElement('option')
        opt.value = index // Guardamos el índice del array de mercado
        opt.textContent = `${t.nombre} (${t.coste_total.toFixed(2)} €)`
        select.appendChild(opt)
    })
}

// Realiza los cálculos interactivos de la contraoferta basados en los totales del servidor
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
