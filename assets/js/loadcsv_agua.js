// assets/js/loadcsv_agua.js - Lógica de carga conectada a la Edge Function dedicada
import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    const fileInput = document.getElementById('csv-agua-file-input');
    const btnUpload = document.getElementById('btn-upload-csv-agua');
    const statusDiv = document.getElementById('upload-status-agua');
    const textoUltimoPeriodo = document.getElementById('texto-ultimo-periodo-agua');

    // 1. Consultar el último periodo a través de la Edge Function dedicada
    async function comprobarUltimoPeriodo() {
        try {
            const { data, error } = await supabase.functions.invoke('carga-consumos-agua', {
                body: { accion: 'ultimo-periodo' }
            });

            if (error) throw error;

            if (data && data.ultimaFecha) {
                const ultimaFechaFormateada = data.ultimaFecha.replace('T', ' ').substring(0, 16);
                textoUltimoPeriodo.textContent = ultimaFechaFormateada;
            } else {
                textoUltimoPeriodo.textContent = 'No hay registros en la base de datos';
            }
        } catch (err) {
            console.error("Error al consultar último periodo:", err);
            textoUltimoPeriodo.textContent = 'Error al comprobar';
        }
    }

    await comprobarUltimoPeriodo();

    // 2. Procesar el fichero CSV y enviarlo en lotes a la Edge Function
    btnUpload.addEventListener('click', async () => {
        const file = fileInput.files[0];
        if (!file) {
            mostrarMensaje('Por favor, selecciona un archivo CSV primero.', 'error');
            return;
        }

        const reader = new FileReader();
        btnUpload.disabled = true;
        btnUpload.textContent = 'Procesando...';
        mostrarMensaje('Leyendo y parseando fichero CSV...', 'info');

        reader.onload = async function(e) {
            try {
                const text = e.target.result;
                const lineas = text.split(/\r\n|\n/);
                const registrosAInsertar = [];

                // Omitir cabecera (fila 0)
                for (let i = 1; i < lineas.length; i++) {
                    const linea = lineas[i].trim();
                    if (!linea) continue;

                    const col = linea.split(/\t|,|;/).map(c => c.trim().replace(/^["']|["']$/g, ''));

                    if (col.length >= 6) {
                        const contrato = col[0];
                        const contador = col[2];
                        const fechaHoraTexto = col[5]; // Ajustar según posición real de fecha/hora en tu CSV
                        const consumo = parseFloat(col[6].replace(',', '.')) || 0;

                        const fechaISO = parsearFechaAISO(fechaHoraTexto);

                        if (fechaISO) {
                            registrosAInsertar.push({
                                compañia: 'Canal Isabel II',
                                contrato: contrato,
                                id_contador: contador,
                                fecha_hora: fechaISO,
                                consumo_litros: consumo
                            });
                        }
                    }
                }

                if (registrosAInsertar.length === 0) {
                    throw new Error("No se encontraron registros válidos en el CSV.");
                }

                // Enviar en lotes (batch) de 500 para evitar saturar la petición
                const BATCH_SIZE = 500;
                for (let j = 0; j < registrosAInsertar.length; j += BATCH_SIZE) {
                    const lote = registrosAInsertar.slice(j, j + BATCH_SIZE);

                    const { error: insertError } = await supabase.functions.invoke('carga-consumos-agua', {
                        body: {
                            accion: 'insertar-consumos',
                            registros: lote
                        }
                    });

                    if (insertError) throw insertError;
                }

                mostrarMensaje(`¡${registrosAInsertar.length} registros cargados con éxito!`, 'success');
                await comprobarUltimoPeriodo();

            } catch (err) {
                console.error("Error al procesar el CSV:", err);
                mostrarMensaje(`Error al procesar: ${err.message}`, 'error');
            } finally {
                btnUpload.disabled = false;
                btnUpload.textContent = 'Procesar CSV';
            }
        };

        reader.readAsText(file, 'ISO-8859-1');
    });

    function mostrarMensaje(texto, tipo) {
        statusDiv.classList.remove('hidden', 'bg-emerald-50', 'text-emerald-800', 'bg-rose-50', 'text-rose-800', 'bg-cyan-50', 'text-cyan-900');
        if (tipo === 'success') {
            statusDiv.classList.add('bg-emerald-50', 'text-emerald-800');
        } else if (tipo === 'error') {
            statusDiv.classList.add('bg-rose-50', 'text-rose-800');
        } else {
            statusDiv.classList.add('bg-cyan-50', 'text-cyan-900');
        }
        statusDiv.textContent = texto;
    }

    function parsearFechaAISO(strFechaHora) {
        // Conversor robusto para formato de fecha/hora del CSV
        try {
            const partes = strFechaHora.split(' ');
            if (partes.length < 2) return null;
            const fechaPartes = partes[0].split('/');
            if (fechaPartes.length < 3) return null;
            const anio = fechaPartes[2];
            const mes = fechaPartes[1].padStart(2, '0');
            const dia = fechaPartes[0].padStart(2, '0');
            const hora = partes[1].padStart(2, '0');

            return `${anio}-${mes}-${dia}T${hora}:00:00Z`;
        } catch {
            return null;
        }
    }
});
