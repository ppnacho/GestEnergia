import { supabase } from './supabaseClient.js';

let chartInstance = null
let aniosDisponibles = [] // Variable global para conservar los años cargados al inicio

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

    // Listeners de los selectores y pestañas con la jerarquía correcta
    const selectSuministro = document.getElementById('select-suministro')
    const selectAnio = document.getElementById('select-anio')

    selectSuministro.addEventListener('change', () => {
        const suministroVal = selectSuministro.value;
        
        // Al cambiar de suministro, reseteamos el select de años pero volvemos a inyectar los años disponibles
        selectAnio.innerHTML = '<option value="" disabled selected>Selecciona un año...</option><option value="todos">Todos los años</option>';
        
        if (aniosDisponibles && Array.isArray(aniosDisponibles)) {
            aniosDisponibles.forEach(anio => {
                const opt = document.createElement('option');
                opt.value = anio;
                opt.textContent = anio;
                selectAnio.appendChild(opt);
            });
        }

        selectAnio.disabled = !suministroVal;

        if (!suministroVal) {
            document.getElementById('estado-vacio').classList.remove('hidden')
            document.getElementById('contenedor-resultados').classList.add('hidden')
            return;
        }

        // Ejecutamos análisis con el suministro recién elegido
        ejecutarAnalisis();
    })

    selectAnio.addEventListener('change', ejecutarAnalisis)

    document.querySelectorAll('.tab-periodo').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-periodo').forEach(b => {
                b.classList.remove('bg-white', 'text-emerald-700', 'shadow-sm', 'font-semibold');
                b.classList.add('text-slate-600', 'font-medium');
            });
            e.target.classList.add('bg-white', 'text-emerald-700', 'shadow-sm', 'font-semibold');
            e.target.classList.remove('text-slate-600', 'font-medium');
            
            ejecutarAnalisis();
        });
    });

    // Cargar filtros iniciales una vez configurado todo el DOM y los eventos
    await cargarFiltrosIniciales()
})

// Solicita los suministros y años iniciales a la Edge Function (Acción 'init')
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
        aniosDisponibles = data.anios || [] // Guardamos los años en la variable global

        const selectSuministro = document.getElementById('select-suministro')
        selectSuministro.innerHTML = '<option value="" disabled selected>Selecciona suministro...</option>'
        
        suministros.forEach((cups, index) => {
            const nomAlias = alias && alias[index] ? alias[index] : `Suministro ${index + 1}`
            const option = document.createElement('option')
            option.value = cups
            option.textContent = `${nomAlias}`
            selectSuministro.appendChild(option)
        })

        // El selector de años empieza bloqueado y sin selección fija hasta que el usuario elija suministro
        const selectAnio = document.getElementById('select-anio')
        selectAnio.innerHTML = '<option value="" disabled selected>Selecciona un año...</option><option value="todos">Todos los años</option>'
        
        aniosDisponibles.forEach(anio => {
            const opt = document.createElement('option')
            opt.value = anio
            opt.textContent = anio
            selectAnio.appendChild(opt)
        })
        selectAnio.disabled = true;

    } catch (err) {
        console.error('Error en cargarFiltrosIniciales:', err)
    }
}

// Ejecuta el análisis de tarifas invocando a la Edge Function
async function ejecutarAnalisis() {
    const suministro = document.getElementById('select-suministro').value
    const selectAnio = document.getElementById('select-anio')
    const anio = selectAnio.value
    
    const tabActiva = document.querySelector('.tab-periodo.bg-white')
    const periodo = tabActiva ? tabActiva.getAttribute('data-periodo') : 'todos'

    const estadoVacio = document.getElementById('estado-vacio')
    const contenedorResultados = document.getElementById('contenedor-resultados')

    if (!suministro) {
        estadoVacio.classList.remove('hidden')
        contenedorResultados.classList.add('hidden')
        return
    }

    // Habilitar el selector de años al haber suministro seleccionado
    selectAnio.disabled = false;

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

        estadoVacio.classList.add('hidden')
        contenedorResultados.classList.remove('hidden')

        renderizarResultados(data)

    } catch (err) {
        console.error('Error al invocar la Edge Function:', err)
        alert('No se pudo completar el análisis de tarifas. Revisa la consola.')
    }
}

function renderizarResultados(data) {
    const { tarifa_renovacion, mercado, ganadora } = data

    document.getElementById('renovacion-nombre').textContent = tarifa_renovacion.nombre
    document.getElementById('renovacion-coste').textContent = `${tarifa_renovacion.coste_total.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`

    if (ganadora) {
        document.getElementById('ganadora-nombre').textContent = ganadora.nombre
        document.getElementById('ganadora-coste').textContent = `${ganadora.coste_total.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`
        
        const ahorroEur = Math.abs(ganadora.diferencia_vs_renovacion)
        const ahorroPct = Math.abs(ganadora.ahorro_porcentual)

        if (ganadora.diferencia_vs_renovacion < 0) {
            document.getElementById('ganadora-ahorro-eur').textContent = `-${ahorrioFormateado(ahorroEur)} €`
            document.getElementById('ganadora-ahorro-pct').textContent = `(-${ahorroPct.toFixed(1)}% de ahorro)`
            document.getElementById('ganadora-sub').textContent = '¡Alternativa más económica! Ahorro directo frente a renovar.'
        } else {
            document.getElementById('ganadora-ahorro-eur').textContent = `+${ahorrioFormateado(ahorroEur)} €`
            document.getElementById('ganadora-ahorro-pct').textContent = `(+${ahorroPct.toFixed(1)}% más caro)`
            document.getElementById('ganadora-sub').textContent = 'Actualmente ninguna opción de mercado mejora la renovación.'
        }
    } else {
        document.getElementById('ganadora-nombre').textContent = 'Sin alternativas'
        document.getElementById('ganadora-coste').textContent = '0,00 €'
        document.getElementById('ganadora-ahorro-eur').textContent = '0,00 €'
        document.getElementById('ganadora-ahorro-pct').textContent = '(0,0%)'
    }

    renderizarGrafico(tarifa_renovacion, mercado)
    renderizarTablaRanking(tarifa_renovacion, mercado)
}

function ahorrioFormateado(num) {
    return num.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function renderizarGrafico(renovacion, mercado) {
    const ctx = document.getElementById('chartComparativa').getContext('2d')

    const labels = [renovacion.nombre, ...mercado.map(t => t.nombre)]
    const costesFijos = [renovacion.coste_fijo, ...mercado.map(t => t.coste_fijo)]
    const costesEnergia = [renovacion.coste_energia, ...mercado.map(t => t.coste_energia)]

    if (chartInstance) {
        chartInstance.destroy()
    }

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Coste Fijo (Potencia)',
                    data: costesFijos,
                    backgroundColor: '#cbd5e1',
                    borderRadius: 4
                },
                {
                    label: 'Coste Variable (Energía)',
                    data: costesEnergia,
                    backgroundColor: '#059669',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { font: { family: 'Inter', size: 12 } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` ${context.dataset.label}: ${context.raw.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`;
                        }
                    }
                }
            },
            scales: {
                x: { stacked: true, grid: { display: false } },
                y: { stacked: true, grid: { color: '#f1f5f9' } }
            }
        }
    })
}

function renderizarTablaRanking(renovacion, mercado) {
    const tbody = document.getElementById('tabla-ranking-body')
    tbody.innerHTML = ''

    const trRenovacion = document.createElement('tr')
    trRenovacion.className = 'bg-slate-50/60 font-medium'
    trRenovacion.innerHTML = `
        <td class="py-3 px-6 flex items-center space-x-2">
            <span class="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block"></span>
            <span>${renovacion.nombre} <span class="text-xs text-slate-400 font-normal">(Referencia Actual)</span></span>
        </td>
        <td class="py-3 px-6 text-right">${renovacion.coste_fijo.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
        <td class="py-3 px-6 text-right">${renovacion.coste_energia.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
        <td class="py-3 px-6 text-right font-bold">${renovacion.coste_total.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
        <td class="py-3 px-6 text-right text-slate-400">-</td>
    `
    tbody.appendChild(trRenovacion)

    mercado.forEach((t, index) => {
        const esMejor = t.diferencia_vs_renovacion < 0
        const colorDiff = esMejor ? 'text-emerald-600 font-semibold' : 'text-slate-600'
        const signoDiff = t.diferencia_vs_renovacion > 0 ? '+' : ''
        
        const tr = document.createElement('tr')
        tr.className = index === 0 && esMejor ? 'bg-emerald-50/40' : 'hover:bg-slate-50/50'
        tr.innerHTML = `
            <td class="py-3 px-6 flex items-center space-x-2">
                <span class="w-2.5 h-2.5 rounded-full ${index === 0 && esMejor ? 'bg-emerald-500' : 'bg-slate-300'} inline-block"></span>
                <span>${t.nombre} ${index === 0 && esMejor ? '<span class="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold ml-1">Mejor Opción</span>' : ''}</span>
            </td>
            <td class="py-3 px-6 text-right">${t.coste_fijo.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
            <td class="py-3 px-6 text-right">${t.coste_energia.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
            <td class="py-3 px-6 text-right font-bold">${t.coste_total.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
            <td class="py-3 px-6 text-right ${colorDiff}">
                ${signoDiff}${t.diferencia_vs_renovacion.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                <span class="text-xs font-normal block">(${signoDiff}${t.ahorro_porcentual.toFixed(1)}%)</span>
            </td>
        `
        tbody.appendChild(tr)
    })
}
