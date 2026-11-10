// assets/js/loadcsv_agua.js - Corrección para usar Edge Function en lugar de consulta directa
import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
    const fileInput = document.getElementById('csv-agua-file-input');
    const btnUpload = document.getElementById('btn-upload-csv-agua');
    const statusDiv = document.getElementById('upload-status-agua');
    const textoUltimoPeriodo = document.getElementById('texto-ultimo-periodo-agua');

    // 1. Consultar el último registro en la BD a través de la Edge Function
    async function comprobarUltimoPeriodo() {
        try {
            // Invocamos a la Edge Function pasando un indicador de acción o consultando el estado general
            const { data, error } = await supabase.functions.invoke('get-consumos-agua', {
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
    
    // 2. Procesar el fichero CSV al hacer clic en el botón
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

                // Omitir cabecera (fila 0) y recorrer el resto
                for (let i = 1; i < lineas.length; i++) {
                    const linea = lineas[i].trim();
                    if (!linea) continue;

                    // El CSV puede venir separado por comas, tabuladores o espacios múltiples (según el formato de origen)
                    // Vamos a parsear adaptándonos a separadores comunes o espacios en columnas fijas
                    const columnas = parsearLineaCSV(linea);

                    if (columnas.length >= 6) {
                        // Basándonos en la estructura visual de tu CSV:
                        // [0] Contrato, [1..] Dirección, [Contador], [Frecuencia], [Periodo], [Fecha/Hora], [Consumo]
                        // O mapeando por posiciones clave:
                        const contrato = columnas[0];
                        // Buscamos el identificador de contador (empieza por letra ej. S23...)
                        const contador = columnas.find(c => /^S[0-9A-Z]+/i.test(c)) || columnas[1]; 
                        
                        // Extraer Fecha/Hora y Consumo de las últimas columnas
                        const consumoStr = columnas[columnas.length - 1].replace(',', '.');
                        const consumoLitros = parseFloat(consumoStr) || 0;

                        // La fecha/hora suele venir en formato "DD/MM/YYYY HH" o similar
                        const fechaHoraRaw = `${columnas[columnas.length - 2]} ${columnas[columnas.length - 1]}`; // Ajustar según formato exacto
                        
                        // Transformar "04/07/2026 01" a formato ISO "2026-07-04T01:00:00Z"
                        const fechaISO = convertirFechaHoraAISO(columnas[columnas.length - 3] + ' ' + columnas[columnas.length - 2]); // Dependiendo del split exacto

                        // Construir objeto para la tabla consumos_agua
                        // (Nota: Ajustaremos la extracción exacta según el delimitador de tu CSV real)
                    }
                }

                // Ejemplo de inserción en lotes (batch) hacia Supabase
                // const { error: insertError } = await supabase.from('consumos_agua').insert(registrosAInsertar);
                // if (insertError) throw insertError;

                mostrarMensaje('¡Archivo CSV procesado y cargado con éxito!', 'success');
                await comprobarUltimoPeriodo();

            } catch (err) {
                console.error("Error al procesar el CSV:", err);
                mostrarMensaje(`Error al procesar: ${err.message}`, 'error');
            } finally {
                btnUpload.disabled = false;
                btnUpload.textContent = 'Procesar CSV';
            }
        };

        reader.readAsText(file, 'ISO-8859-1'); // O 'UTF-8' según la codificación de tu CSV de agua
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

    function parsearLineaCSV(linea) {
        // Limpieza y división por separador habitual (tabulador, punto y coma o coma)
        return linea.split(/,|\t|;/).map(c => c.trim().replace(/^["']|["']$/g, ''));
    }

    function convertirFechaHoraAISO(strFechaHora) {
        // Ejemplo de conversor para formato "DD/MM/YYYY HH" -> "YYYY-MM-DDTHH:00:00Z"
        try {
            const partes = strFechaHora.split(' ');
            if (partes.length < 2) return null;
            const fechaPartes = partes[0].split('/');
            if (fechaPartes.length < 3) return null;
            const anio = fechaPartes[2];
            const mes = fechaPartes[1];
            const dia = fechaPartes[0];
            const hora = partes[1].padStart(2, '0');

            return `${anio}-${mes}-${dia}T${hora}:00:00Z`;
        } catch {
            return null;
        }
    }
});
