import { supabase } from './supabaseClient.js';

let datosAnalisisGlobal = null; // Almacenará la respuesta limpia de la Edge Function

document.addEventListener('DOMContentLoaded', async () => {
    // Validación de sesión
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
            window.location.href = '../index.html'
            return
        }
    }

    // Botón de Cerrar Sesión
    document.getElementById('btn-logout').addEventListener('click', async () => {
        await supabase.auth.signOut()
        window.location.href = '../index.html'
    })

    // Listeners para los selectores de simulación
    const selectTarifaRival = document.getElementById('select-tarifa-rival')
    const selectEstrategia = document.getElementById('select-estrategia')
    const rangeIntensidad = document.getElementById('range-intensidad')

    if (selectTarifaRival) selectTarifaRival.addEventListener('change', actualizarSimulacion)
    if (selectEstrategia) selectEstrategia.addEventListener('change', actualizarSimulacion)
    if (rangeIntensidad) rangeIntensidad.addEventListener('input', (e) => {
        document.getElementById('valor-intensidad').textContent = `${e.target.value} €`
        actualizarSimulacion()
    })

    // Carga inicial de filtros y datos
    await cargarFiltrosIniciales()
})

// Solicita los suministros iniciales a la Edge Function
async function cargarFiltrosIniciales() {
    try {
        const { data, error } = await supabase.functions.invoke('analisis-tarifas', {
            body: { action: 'init' }
        })

        if (error || !data || data.error) {
            console.error('Error al inicializar filtros:', error || data?.error)
            return
        }

        const { suministros, alias } = data.usuario
        const selectSuministro = document.getElementById('select-suministro')
        
        if (!selectSuministro) return

        selectSuministro.innerHTML = '<option value="" disabled selected>Selecciona suministro...</option>'
        
        suministros.forEach((cups, index) => {
            const nomAlias = alias && alias[index] ? alias[index] : `Suministro ${index + 1}`
            const option = document.createElement('option')
            option.value = cups
            option.textContent = nomAlias
            selectSuministro.appendChild(option)
        })

        selectSuministro.addEventListener('change', async () => {
            const suministroVal = selectSuministro.value;
            if (!suministroVal) return;
            
            // Cargar años disponibles para este suministro
            await cargarAniosSuministro(suministroVal);
            await ejecutarAnalisisMejora();
        })

        const selectAnio = document.getElementById('select-anio')
        if (selectAnio) {
            selectAnio.addEventListener('change', ejecutarAnalisisMejora)
        }

        document.querySelectorAll('.tab-periodo').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-periodo').forEach(b => {
                    b.classList.remove('bg-white', 'text-emerald-700', 'shadow-sm', 'font-semibold');
                    b.classList.add('text-slate-600', 'font-medium');
                });
                e.target.classList.add('bg-white', 'text-emerald-700', 'shadow-sm', 'font-semibold');
                e.target.classList.remove('text-slate-600', 'font-medium');
                
                ejecutarAnalisisMejora();
            });
        });

    } catch (err) {
        console.error('Error en cargarFiltrosIniciales:', err)
    }
}

async function cargarAniosSuministro(suministro) {
    try {
        const { data, error } = await supabase.functions.invoke('analisis-tarifas', {
            body: { action: 'anios', suministro }
        })

        if (error || !data) return

        const selectAnio = document.getElementById('select-anio')
        if (!selectAnio) return

        selectAnio.innerHTML = '<option value="todos">Todos los años</option>'
        data.anios.forEach(anio => {
            const opt = document.createElement('option')
            opt.value = anio
            opt.textContent = anio
            selectAnio.appendChild(opt)
        })
        selectAnio.disabled = false;
    } catch (err) {
        console.error('Error al cargar años:', err)
    }
}

// Ejecuta la llamada a la Edge Function para obtener el análisis completo
async function ejecutarAnalisisMejora() {
    const suministro = document.getElementById('select-suministro').value
    const selectAnio = document.getElementById('select-anio')
    const anio = selectAnio ? selectAnio.value : 'todos'
    
    const tabActiva = document.querySelector('.tab-periodo.bg-white')
    const periodo = tabActiva ? tabActiva.getAttribute('data-periodo') : 'todos'

    if (!suministro) return

    try {
        const { data, error } = await supabase.functions.invoke('analisis-tarifas', {
            body: { 
                suministro, 
                anio: (anio && anio !== 'todos') ? parseInt(anio) : 'todos', 
                periodo 
            }
        })

        if (error) throw error
        if (!data || data.error) {
            alert('Error en el análisis: ' + (data?.error || error.message))
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
