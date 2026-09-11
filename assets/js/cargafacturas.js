import { supabase } from './supabaseClient.js';

const selectSuministro = document.getElementById('select-suministro');
const selectMes = document.getElementById('select-mes');
const formFactura = document.getElementById('form-factura');
const btnSubmit = document.getElementById('btn-submit-factura');
const statusDiv = document.getElementById('upload-status');

async function verificarSesion() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) {
            window.location.href = "../login.html";
            return false;
        }
        return true;
    } catch (err) {
        window.location.href = "../login.html";
        return false;
    }
}

function mostrarEstado(mensaje, tipo = 'info') {
    if (!statusDiv) return;
    statusDiv.classList.remove('hidden', 'bg-emerald-50', 'text-emerald-800', 'bg-red-50', 'text-red-800', 'bg-blue-50', 'text-blue-800', 'border');
    
    if (tipo === 'success') {
        statusDiv.classList.add('bg-emerald-50', 'text-emerald-800', 'border', 'border-emerald-200');
    } else if (tipo === 'error') {
        statusDiv.classList.add('bg-red-50', 'text-red-800', 'border', 'border-red-200');
    } else {
        statusDiv.classList.add('bg-blue-50', 'text-blue-800', 'border', 'border-blue-200');
    }
    statusDiv.textContent = mensaje;
}

// Inicializar formulario pidiendo los datos exclusivamente a la Edge Function
async function inicializarFormulario() {
    const sesionValida = await verificarSesion();
    if (!sesionValida) return;

    try {
        // Invocamos a la Edge Function pasándole action: 'init'
        const { data, error } = await supabase.functions.invoke('carga-facturas', {
            body: { action: 'init' }
        });

        if (error) throw new Error(error.message);

        const suministros = data.suministros || [];
        const aliases = data.aliases || [];

        selectSuministro.innerHTML = '<option value="">-- Selecciona un suministro --</option>';
        suministros.forEach((cups, index) => {
            const aliasAmigable = aliases[index] || cups;
            const opt = document.createElement('option');
            opt.value = cups;
            opt.textContent = aliasAmigable;
            selectSuministro.appendChild(opt);
        });

        // Rellenar selector de meses en formato mmmaa (últimos 3 años)
        const mesesNombres = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        const fechaActual = new Date();
        let mesActualIdx = fechaActual.getMonth();
        let anioActual = fechaActual.getFullYear() % 100;

        selectMes.innerHTML = '';
        for (let i = 0; i < 36; i++) {
            let mStr = mesesNombres[mesActualIdx];
            let aStr = String(anioActual).padStart(2, '0');
            let formatoMmmaa = `${mStr}${aStr}`;

            const opt = document.createElement('option');
            opt.value = formatoMmmaa;
            opt.textContent = formatoMmmaa.toUpperCase();
            selectMes.appendChild(opt);

            mesActualIdx--;
            if (mesActualIdx < 0) {
                mesActualIdx = 11;
                anioActual--;
            }
        }

    } catch (err) {
        console.error("Error al inicializar formulario:", err);
        mostrarEstado("Error al cargar la configuración inicial.", "error");
    }
}

// Enviar datos de la factura a la Edge Function para su procesamiento
async function guardarFactura(e) {
    e.preventDefault();
    const sesionValida = await verificarSesion();
    if (!sesionValida) return;

    const facturaData = {
        suministro: selectSuministro.value,
        mes: selectMes.value,
        coste_energia: parseFloat(document.getElementById('input-coste-energia').value) || 0,
        excedentes_generados: parseFloat(document.getElementById('input-excedentes').value) || 0,
        total_coste: parseFloat(document.getElementById('input-total-coste').value) || 0,
        total_impuestos: parseFloat(document.getElementById('input-total-impuestos').value) || 0
    };

    if (!facturaData.suministro || !facturaData.mes) {
        mostrarEstado("Por favor, selecciona un suministro y un mes válidos.", "error");
        return;
    }

    btnSubmit.disabled = true;
    mostrarEstado("Guardando factura y calculando wallet y pagos...", "info");

    try {
        const { data, error } = await supabase.functions.invoke('carga-facturas', {
            body: facturaData
        });

        if (error) {
            let serverErrorMsg = error.message;
            try {
                if (error.context && typeof error.context.json === 'function') {
                    const errorBody = await error.context.json();
                    if (errorBody && errorBody.error) serverErrorMsg = errorBody.error;
                }
            } catch (e) {}
            throw new Error(serverErrorMsg);
        }

        mostrarEstado(`¡Factura guardada con éxito! Wallet calculado: ${data.calculos.wallet.toFixed(2)} €, Pagado: ${data.calculos.pagado.toFixed(2)} €`, "success");
        formFactura.reset();
        inicializarFormulario();

    } catch (err) {
        console.error("Error al guardar factura:", err);
        mostrarEstado("Error: " + err.message, "error");
    } finally {
        btnSubmit.disabled = false;
    }
}

if (formFactura) {
    formFactura.addEventListener('submit', guardarFactura);
}

document.addEventListener('DOMContentLoaded', inicializarFormulario);
