// assets/js/cargaasociados_telefono.js
import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('form-asociados-telefono');
    const statusDiv = document.getElementById('upload-status');
    const btnSubmit = document.getElementById('btn-submit-asociado');

    const inputLinea = document.getElementById('input-linea');
    const inputPrecioBase = document.getElementById('input-precio-base');
    const inputConsumoExtra = document.getElementById('input-consumo-extra');
    const inputGastoExtra = document.getElementById('input-gasto-extra');
    const inputIvaPct = document.getElementById('input-iva-pct');
    const inputTotal = document.getElementById('input-total');

    // 1. Verificar sesión activa
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = '../login.html';
        return;
    }

    // 2. Forzar entrada numérica pura en el campo línea (máx. 9 dígitos)
    inputLinea.addEventListener('input', () => {
        inputLinea.value = inputLinea.value.replace(/\D/g, '').slice(0, 9);
    });

    // 3. Cálculo automático con 4 decimales: Base Imponible y Cuota IVA (€)
    const calcularImportes = () => {
        const base = parseFloat(inputPrecioBase.value) || 0;
        const consumoExtra = parseFloat(inputConsumoExtra.value) || 0;
        const gastoExtra = parseFloat(inputGastoExtra.value) || 0;
        const pctIva = parseFloat(inputIvaPct.value) || 0;

        const baseImponible = base + consumoExtra + gastoExtra;
        const cuotaIvaEuros = Number((baseImponible * (pctIva / 100)).toFixed(4));
        const totalFactura = Number((baseImponible + cuotaIvaEuros).toFixed(4));

        inputTotal.value = totalFactura.toFixed(4);
        return { cuotaIvaEuros, totalFactura };
    };

    document.querySelectorAll('.calc-total').forEach(el => {
        el.addEventListener('input', calcularImportes);
    });

    function mostrarEstado(mensaje, esError = false) {
        statusDiv.textContent = mensaje;
        statusDiv.classList.remove('hidden', 'bg-red-50', 'text-red-700', 'border-red-200', 'bg-emerald-50', 'text-emerald-700', 'border-emerald-200', 'border');
        if (esError) {
            statusDiv.classList.add('bg-red-50', 'text-red-700', 'border', 'border-red-200');
        } else {
            statusDiv.classList.add('bg-emerald-50', 'text-emerald-700', 'border', 'border-emerald-200');
        }
    }

    // 4. Envío del formulario a la Edge Function
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const fecha_factura = document.getElementById('input-fecha-factura').value;
        const linea = inputLinea.value.trim();
        const precio_base = parseFloat(inputPrecioBase.value);
        const consumo_extra = parseFloat(inputConsumoExtra.value) || 0;
        const gasto_extra = parseFloat(inputGastoExtra.value) || 0;
        const { cuotaIvaEuros } = calcularImportes();
        const total = parseFloat(inputTotal.value);
        
        // Ingresos opcionales
        const ingreso_linea = parseFloat(document.getElementById('input-ingreso-linea').value) || 0;
        const ingreso_extras = parseFloat(document.getElementById('input-ingreso-extras').value) || 0;

        if (!/^\d{9}$/.test(linea)) {
            mostrarEstado('La línea debe ser un número exacto de 9 cifras.', true);
            inputLinea.focus();
            return;
        }

        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Guardando...';
        statusDiv.classList.add('hidden');

        try {
            const { data, error } = await supabase.functions.invoke('carga-asociados-telefono', {
                body: {
                    fecha_factura,
                    linea,
                    precio_base,
                    consumo_extra,
                    gasto_extra,
                    iva: cuotaIvaEuros,
                    total,
                    ingreso_linea,
                    ingreso_extras
                }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            mostrarEstado('Registro de línea asociada guardado correctamente.');
            form.reset();
            
            // Restablecer valores por defecto
            inputConsumoExtra.value = '0.0000';
            inputGastoExtra.value = '0.0000';
            inputIvaPct.value = '21';

        } catch (err) {
            console.error('Error al guardar asociado:', err);
            mostrarEstado(err.message || 'Error al guardar el registro en el servidor.', true);
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Guardar Registro';
        }
    });
});
