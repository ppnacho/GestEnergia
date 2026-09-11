// assets/js/loadcsv.js - Lógica para la carga de ficheros CSV y Excel mediante Edge Functions
import { supabase } from './supabaseClient.js';

const fileInput = document.getElementById('csv-file-input');
const btnUpload = document.getElementById('btn-upload-csv');
const statusDiv = document.getElementById('upload-status');
const textoUltimoPeriodo = document.getElementById('texto-ultimo-periodo');

async function verificarSesion() {
    try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
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
    statusDiv.classList.remove('hidden', 'bg-emerald-50', 'text-emerald-800', 'bg-red-50', 'text-red-800', 'bg-blue-50', 'text-blue-800');
    
    if (tipo === 'success') {
        statusDiv.classList.add('bg-emerald-50', 'text-emerald-800', 'border', 'border-emerald-200');
    } else if (tipo === 'error') {
        statusDiv.classList.add('bg-red-50', 'text-red-800', 'border', 'border-red-200');
    } else {
        statusDiv.classList.add('bg-blue-50', 'text-blue-800', 'border', 'border-blue-200');
    }
    
    statusDiv.textContent = mensaje;
}

// Obtener los últimos periodos de cada suministro llamando a la Edge Function
async function consultarUltimoPeriodo() {
    if (!textoUltimoPeriodo) return;

    try {
        const { data, error } = await supabase.functions.invoke('load-last-register');

        if (error) {
            let serverErrorMsg = error.message;
            try {
                if (error.context && typeof error.context.json === 'function') {
                    const errorBody = await error.context.json();
                    if (errorBody && errorBody.error) {
                        serverErrorMsg = errorBody.error;
                    }
                }
            } catch (e) {
                // Silenciar error de parseo secundario
            }
            throw new Error(serverErrorMsg);
        }

        if (data && data.ultimosRegistros && Array.isArray(data.ultimosRegistros) && data.ultimosRegistros.length > 0) {
            let htmlList = '<ul style="list-style-type: none; padding-left: 0; margin: 0;">';
            
            data.ultimosRegistros.forEach(item => {
                const fechaTexto = item.ultimaFecha ? item.ultimaFecha : 'Sin registros previos';
                htmlList += `<li style="margin-bottom: 4px;"><strong>${item.alias}:</strong> ${fechaTexto}</li>`;
            });
            
            htmlList += '</ul>';
            textoUltimoPeriodo.innerHTML = htmlList;
        } else {
            textoUltimoPeriodo.textContent = "No hay suministros asociados o registros previos.";
        }
    } catch (err) {
        console.error("Error al consultar el último periodo:", err.message);
        textoUltimoPeriodo.textContent = "Error al consultar los últimos registros.";
    }
}

// Función auxiliar para parsear filas de texto CSV tradicional
function parsearLineasCSV(texto) {
    const lineas = texto.split(/\r\n|\n/);
    const registros = [];

    for (let i = 1; i < lineas.length; i++) {
        const linea = lineas[i].trim();
        if (!linea) continue;

        const columnas = linea.split(';');
        if (columnas.length >= 6) {
            const fechaRaw = columnas[1].trim();
            const fechaFormateada = fechaRaw.replace(/\//g, '-');

            registros.push({
                suministro: columnas[0].trim(),
                periodo: fechaFormateada,
                estacion: columnas[2].trim(),
                periodo_tarifa: columnas[3].trim(),
                consumo: parseInt(columnas[4].trim()) || 0,
                generacion: parseInt(columnas[5].trim()) || 0
            });
        }
    }
    return registros;
}

// Función para parsear ficheros Excel (.xls / .xlsx) con cabeceras informativas en las 2 primeras filas
async function parsearExcel(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // Convertir la hoja a matriz de filas (array de arrays)
                const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (rows.length < 4) {
                    throw new Error("El formato del fichero Excel no contiene suficientes filas.");
                }

                // Fila 2 (índice 2) contiene la cabecera real según la estructura analizada:
                // ["CUPS", "FECHA-HORA", "INV / VER", "PERIODO TARIFARIO", "CONSUMO Wh", "GENERACION Wh"]
                const headerRowIndex = 2;
                const headers = rows[headerRowIndex];

                const cupsIdx = headers.indexOf('CUPS');
                const fechaIdx = headers.indexOf('FECHA-HORA');
                const invVerIdx = headers.indexOf('INV / VER');
                const periodoIdx = headers.indexOf('PERIODO TARIFARIO');
                const consumoIdx = headers.indexOf('CONSUMO Wh');
                const genIdx = headers.indexOf('GENERACION Wh');

                if (cupsIdx === -1 || fechaIdx === -1 || consumoIdx === -1) {
                    throw new Error("No se han encontrado las columnas obligatorias en la cabecera (Fila 3 del Excel).");
                }

                const registros = [];

                for (let i = headerRowIndex + 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.length === 0 || !row[cupsIdx]) continue;

                    let fechaRaw = row[fechaIdx];
                    
                    // Manejo por si Excel devuelve el número de serie de fecha o un string
                    if (typeof fechaRaw === 'number') {
                        fechaRaw = XLSX.SSF.format('yyyy/mm/dd hh:mm', fechaRaw);
                    } else {
                        fechaRaw = String(fechaRaw || '').trim();
                    }
                    
                    const fechaFormateada = fechaRaw.replace(/\//g, '-');

                    registros.push({
                        suministro: String(row[cupsIdx] || '').trim(),
                        periodo: fechaFormateada,
                        estacion: String(row[invVerIdx] !== undefined ? row[invVerIdx] : '0').trim(),
                        periodo_tarifa: String(row[periodoIdx] || 'Valle').trim(),
                        consumo: parseInt(row[consumoIdx]) || 0,
                        generacion: parseInt(row[genIdx]) || 0
                    });
                }

                resolve(registros);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
}

async function procesarFichero() {
    const sesionValida = await verificarSesion();
    if (!sesionValida) return;

    const file = fileInput.files[0];
    if (!file) {
        mostrarEstado("Por favor, selecciona un archivo CSV o Excel primero.", "error");
        return;
    }

    mostrarEstado("Leyendo y procesando el fichero...", "info");
    btnUpload.disabled = true;

    try {
        let registros = [];
        const fileName = file.name.toLowerCase();

        // Determinar el formato por la extensión del archivo
        if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) {
            registros = await parsearExcel(file);
        } else {
            // Leer como texto plano si es CSV
            const texto = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (err) => reject(err);
                reader.readAsText(file, 'UTF-8');
            });
            registros = parsearLineasCSV(texto);
        }

        if (registros.length === 0) {
            mostrarEstado("El archivo no contiene registros válidos o está vacío.", "error");
            btnUpload.disabled = false;
            return;
        }

        mostrarEstado(`Procesados ${registros.length} registros. Enviando a la Edge Function...`, "info");

        // Llamada a la Edge Function existente (carga-consumos) sin modificarla
        const { data, error } = await supabase.functions.invoke('carga-consumos', {
            body: { registros }
        });

        if (error) {
            let errorMessage = error.message;
            try {
                if (error.context && typeof error.context.json === 'function') {
                    const errorBody = await error.context.json();
                    if (errorBody && errorBody.error) {
                        errorMessage = errorBody.error;
                    }
                }
            } catch (parseErr) {
                console.error("Error al leer detalle del servidor:", parseErr);
            }
            throw new Error(errorMessage);
        }

        mostrarEstado(`¡Carga completada con éxito! Se han procesado ${registros.length} registros correctamente.`, "success");
        fileInput.value = "";

        // Actualizar en pantalla el nuevo último periodo tras la subida exitosa
        consultarUltimoPeriodo();

    } catch (err) {
        console.error("Error detallado durante el proceso:", err);
        mostrarEstado("Error al cargar los datos: " + err.message, "error");
    } finally {
        btnUpload.disabled = false;
    }
}

if (btnUpload) {
    btnUpload.addEventListener('click', procesarFichero);
}

// Inicialización al cargar la página
verificarSesion().then((valida) => {
    if (valida) {
        consultarUltimoPeriodo();
    }
});
