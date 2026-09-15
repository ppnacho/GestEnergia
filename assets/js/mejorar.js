import { supabase } from './supabaseClient.js';

let datosAnalisisGlobal = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Validar sesión
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
            window.location.href = '../index.html'
            return
        }
    }

    // 2. Leer parámetros de la URL
    const params = new URLSearchParams(window.location.search);
    const suministro = params.get('suministro');
    const anio = params.get('anio');
    const periodo = params.get('periodo') || 'todos';

    if (!suministro || !anio) {
        alert('Faltan parámetros de suministro o año.');
        window.location.href = '../analisistarifas.html';
        return;
    }

    // Mostrar contexto en la UI
    document.getElementById('badge-contexto').textContent = `CUPS: ${suministro} | Año: ${anio} | Periodo: ${periodo}`;
    
    // Actualizar enlace de vuelta por si acaso
    document.getElementById('btn-volver').href = `../analisistarifas.html`;

    try {
        // 3. Cargar los datos del análisis llamando a la Edge Function
        const { data, error } = await supabase.functions.invoke('analisis-tarifas', {
            body: { 
                suministro, 
                anio: anio !== 'todos' ? parseInt(anio) : 'todos', 
                periodo 
            }
        });

        if (error || !data || data.error) {
            throw error || new Error(data?.error);
        }

        datosAnalisisGlobal = data;
        inicializarSimulador(data);

    } catch (err) {
        console.error('Error al cargar datos para la mejora:', err);
        alert('No se pudieron recuperar los datos del suministro para simular.');
    }
});

function inicializarSimulador(data) {
    const { tarifa_renovacion, mercado } = data;
    const selectRival = document.getElementById('select-tarifa-rival');

    // Filtrar mercado (excluyendo Renovación)
    const rivales = mercado.filter(t => t.nombre?.trim().toLowerCase() !== 'renovacion');

    selectRival.innerHTML = '<option value="" disabled selected>Selecciona una tarifa...</option>';
    rivales.forEach((t, index) => {
        const opt = document.createElement('option');
        opt.value = index;
        opt.textContent = `${t.nombre} (Coste Actual: ${t.coste_total.toFixed(2)} €)`;
        selectRival.appendChild(opt);
    });

    // Eventos para recalcular al mover cualquier parámetro
    selectRival.addEventListener('change', ejecutarSimulacionMejora);
    document.getElementById('select-estrategia').addEventListener('change', ejecutarSimulacionMejora);
    
    const sliderIntensidad = document.getElementById('range-intensidad');
    sliderIntensidad.addEventListener('input', (e) => {
        document.getElementById('label-intensidad').textContent = `Margen objetivo: -${e.target.value} €`;
        ejecutarSimulacionMejora();
    });
}

function ejecutarSimulacionMejora() {
    const selectRivalIndex = document.getElementById('select-tarifa-rival').value;
    if (selectRivalIndex === "") return;

    const tarifaRival = mercadoFiltrado()[selectRivalIndex];
    const tarifaRenovacion = datosAnalisisGlobal.tarifa_renovacion;
    const estrategia = document.getElementById('select-estrategia').value;
    const margenSeguridad = parseFloat(document.getElementById('range-intensidad').value);

    // Coste objetivo que debe alcanzar la rival para batir a la renovación por el margen indicado
    const costeObjetivo = tarifaRenovacion.coste_total - margenSeguridad;
    const costeActualRival = tarifaRival.coste_total;

    // Diferencia que necesitamos recortar
    const recorteNecesario = costeActualRival - costeObjetivo;

    // Renderizar resultados preliminares en pantalla
    document.getElementById('sim-coste-original').textContent = `${costeActualRival.toFixed(2)} €`;
    
    let costeNuevoRival = costeActualRival;
    if (recorteNecesario > 0) {
        costeNuevoRival = costeActualRival - recorteNecesario;
    }

    document.getElementById('sim-coste-nuevo').textContent = `${costeNuevoRival.toFixed(2)} €`;
    
    const diferenciaRenovacion = costeNuevoRival - tarifaRenovacion.coste_total;
    document.getElementById('sim-diferencia-renovacion').textContent = `(${diferenciaRenovacion <= 0 ? '' : '+'}${diferenciaRenovacion.toFixed(2)} € vs Renovación)`;
    
    const ahorroCliente = tarifaRenovacion.coste_total - costeNuevoRival;
    document.getElementById('sim-ahorro-cliente').textContent = `${ahorrioFormateado(ahorroCliente)} €`;

    // Visualizar desglose de estrategia aplicada
    renderizarDesgloseEstrategia(tarifaRival, estrategia, recorteNecesario);
}

function mercadoFiltrado() {
    return datosAnalisisGlobal.mercado.filter(t => t.nombre?.trim().toLowerCase() !== 'renovacion');
}

function renderizarDesgloseEstrategia(tarifa, estrategia, recorte) {
    const contenedor = document.getElementById('tabla-precios-modificados');
    contenedor.innerHTML = '';

    let mensajeEstrategia = '';
    if (recorte <= 0) {
        mensajeEstrategia = '<div class="col-span-full text-emerald-600 font-semibold">¡Esta tarifa ya es más económica que la Renovación sin modificar precios!</div>';
    } else {
        mensajeEstrategia = `<div class="col-span-full text-indigo-700 font-medium">Para superar a Renovación, se requiere un ajuste total de <b>-${recorte.toFixed(2)} €</b> aplicando la estrategia: <span uppercase>${estrategia}</span>.</div>`;
    }
    
    contenedor.innerHTML = mensajeEstrategia;
}

function ahorrioFormateado(num) {
    return Math.max(0, num).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
