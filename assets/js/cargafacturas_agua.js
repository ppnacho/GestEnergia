// assets/js/cargafacturas_agua.js - Lógica de carga de facturas de agua
import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    const selectSuministro = document.getElementById('select-suministro');
    const formFactura = document.getElementById('form-factura-agua');
    const statusDiv = document.getElementById('upload-status');
    const btnSubmit = document.getElementById('btn-submit-factura');

    // 1. Cargar suministros del usuario autenticado mediante la Edge Function
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            window.location.href = '../login.html';
            return;
        }

        const { data, error } = await supabase.functions.invoke('get-consumos-agua', {
            body: { accion: 'obtener-suministros', userId: user.id }
        });

        if (error) throw error;

        selectSuministro.innerHTML = '<option value="">Selecciona un suministro de agua...</option>';
        
        if (data && data.suministro && Array.isArray(data.suministro)) {
            const { suministro, alias, pot_punta } = data;
            
            suministro.forEach((contrato, index) => {
                const nombreAlias = alias[index] || contrato;
                const tipo = pot_punta ? pot_punta[index] : '';

                // Filtramos exclusivamente los suministros que corresponden a agua
                const esAgua = tipo === 'agua' || contrato.toLowerCase().includes('agua') || !contrato.startsWith('ES');

                if (esAgua) {
                    const option = document.createElement('option');
                    option.value = contrato;
                    option.textContent = `${nombreAlias} (${contrato})`;
                    selectSuministro.appendChild(option);
                }
            });
        }

        if (selectSuministro.options.length <= 1) {
            selectSuministro.innerHTML = '<option value="">No se encontraron suministros de agua</option>';
        }

    } catch (err) {
        console.error("Error al cargar suministros:", err);
        selectSuministro.innerHTML = '<option value="">Error al cargar suministros</option>';
    }

    // 2. Envío del formulario y cálculo automático en cliente
    formFactura.addEventListener('submit', async (e) => {
        e.preventDefault();
        statusDiv.classList.add('hidden');

        const contratoSeleccionado = selectSuministro.value;
        if (!contratoSeleccionado) {
            showStatus('Por favor, selecciona un suministro válido.', 'error');
            return;
        }

        const periodo = document.getElementById('input-periodo').value.trim();
        const lecturaAnterior = parseFloat(document.getElementById('input-lectura-anterior').value) || 0;
        const lecturaActual = parseFloat(document.getElementById('input-lectura-actual').value) || 0;
        const costeConsumo = parseFloat(document.getElementById('input-coste-consumo').value) || 0;
        const cuotaFija = parseFloat(document.getElementById('input-cuota-fija').value) || 0;
        const bonificaciones = parseFloat(document.getElementById('input-bonificaciones').value) || 0;
        const suplementos = parseFloat(document.getElementById('input-suplementos').value) || 0;
        const impuestos = parseFloat(document.getElementById('input-impuestos').value) || 0;

        // Cálculos automáticos requeridos
        const consumoM3 = Number((lecturaActual - lecturaAnterior).toFixed(3));
        const totalEur = Number(((costeConsumo + cuotaFija + suplementos + impuestos) - bonificaciones).toFixed(2));

        if (consumoM3 < 0) {
            showStatus('La lectura actual no puede ser menor que la lectura anterior.', 'error');
            return;
        }

        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Guardando...';

        try {
            const { data, error } = await supabase.functions.invoke('carga-facturas-agua', {
                body: {
                    contrato: contratoSeleccionado,
                    lectura_anterior: lecturaAnterior,
                    lectura_actual: lecturaActual,
                    consumo_m3: consumoM3,
                    consumo_eur: costeConsumo,
                    cuota_fija: cuotaFija,
                    bonificaciones: bonificaciones,
                    suplementos: suplementos,
                    impuestos: impuestos,
                    total_eur: totalEur,
                    periodo: periodo
                }
            });

            if (error) throw error;

            showStatus('¡Factura guardada correctamente!', 'success');
            formFactura.reset();

        } catch (err) {
            console.error('Error al enviar factura:', err);
            showStatus(err.message || 'Error al conectar con el servidor', 'error');
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Guardar Factura';
        }
    });

    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.classList.remove('hidden', 'bg-cyan-50', 'text-cyan-800', 'bg-rose-50', 'text-rose-800', 'border-cyan-200', 'border-rose-200');
        if (type === 'success') {
            statusDiv.classList.add('bg-cyan-50', 'text-cyan-800', 'border', 'border-cyan-200');
        } else {
            statusDiv.classList.add('bg-rose-50', 'text-rose-800', 'border', 'border-rose-200');
        }
    }
});
