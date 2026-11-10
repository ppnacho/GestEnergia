import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    const selectSuministro = document.getElementById('select-suministro');
    const formFactura = document.getElementById('form-factura-agua');
    const statusDiv = document.getElementById('upload-status');
    const btnSubmit = document.getElementById('btn-submit-factura');

    let suministrosMap = {}; // Mapeo de alias -> número de contrato

    // 1. Cargar suministros del usuario autenticado
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            window.location.href = '../login.html';
            return;
        }

        // Llamada a la Edge Function para obtener suministros de forma segura
        const response = await fetch(`${SUPABASE_URL}/functions/v1/get-consumos-agua`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
            },
            body: JSON.stringify({
                accion: 'obtener-suministros',
                userId: user.id
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Error al obtener suministros');

        selectSuministro.innerHTML = '<option value="">Selecciona un suministro de agua...</option>';
        
        const { suministro, alias } = data;
        
        if (suministro && suministro.length > 0) {
            suministro.forEach((contrato, index) => {
                const nombreAlias = alias[index] || contrato;
                const esAgua = contrato.toLowerCase().includes('agua') || !contrato.startsWith('ES');

                // Filtramos exclusivamente los suministros que corresponden a agua
                if (esAgua) {
                    suministrosMap[nombreAlias] = contrato;
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

    // 2. Envío del formulario y cálculo automático en cliente antes de enviar
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
            const session = (await supabase.auth.getSession()).data.session;

            const res = await fetch(`${SUPABASE_URL}/functions/v1/carga-facturas-agua`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
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
                })
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Error al guardar la factura');

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
        statusDiv.classList.remove('hidden', 'bg-emerald-50', 'text-emerald-800', 'bg-rose-50', 'text-rose-800');
        if (type === 'success') {
            statusDiv.classList.add('bg-emerald-50', 'text-emerald-800', 'border', 'border-emerald-200');
        } else {
            statusDiv.classList.add('bg-rose-50', 'text-rose-800', 'border', 'border-rose-200');
        }
    }
});
