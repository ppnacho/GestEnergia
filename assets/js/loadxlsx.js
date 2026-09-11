// assets/js/loadxlsx.js - Lógica exclusiva para la carga de ficheros Excel mediante SheetJS
import { supabase } from './supabaseClient.js';

const fileInputXlsx = document.getElementById('xlsx-file-input');
const btnUploadXlsx = document.getElementById('btn-upload-xlsx');
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

// Consultar los últimos periodos llamando a la Edge Function
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
                // Silenciar error secundario
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

async function procesarExcel() {
    const sesionValida = await verificarSesion();
    if (!sesionValida) return;

    const file = fileInputXlsx.files[0];
    if (!file) {
        mostrarEstado("Por favor, selecciona un archivo Excel (.xls / .xlsx) primero.", "error");
        return;
    }

    mostrarEstado("Leyendo y procesando el fichero Excel...", "info");
    btnUploadXlsx.disabled = true;

    const reader = new FileReader();

    reader.onload = async function (e) {
        try {
            const arrayBuffer = e.target.result;
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            // Convertir la hoja completa a matriz de filas (array de arrays)
            const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (rows.length < 3) {
                throw new Error("El fichero Excel no contiene suficientes filas.");
            }

            // Buscar de forma dinámica en qué fila se encuentran las cabeceras reales (buscando "CUPS")
            let headerRowIndex = -1;
            let headers = [];

            for (let r = 0; r < Math.min(rows.length, 10); r++) {
                const row = rows[r];
                if (row && row.some(cell => String(cell).trim().toUpperCase().includes('CUPS'))) {
                    headerRowIndex = r;
                    headers = row.map(h => String(h || '').trim().toUpperCase());
                    break;
                }
            }

            if (headerRowIndex === -1) {
                throw new Error("No se ha encontrado la columna 'CUPS' en las primeras filas del Excel.");
            }

            // Identificar los índices de las columnas clave
            const cupsIdx = headers.findIndex(h => h.includes('CUPS'));
            const fechaIdx = headers.findIndex(h => h.includes('FECHA'));
            const invVerIdx = headers.findIndex(h => h.includes('INV') || h.includes('VER'));
            const periodoIdx = headers.findIndex(h => h.includes('PERIODO'));
            const consumoIdx = headers.findIndex(h => h.includes('CONSUMO'));
            const genIdx = headers.findIndex(h => h.includes('GENERACION') || h.includes('GENERACIN'));

            if (cupsIdx === -1 || fechaIdx === -1 || consumoIdx === -1) {
                throw new Error("No se han podido mapear las columnas obligatorias del Excel.");
            }

            const registros = [];

            // Recorrer los datos a partir de la fila siguiente a la cabecera
            for (let i = headerRowIndex + 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length === 0) continue;

                const cupsVal = row[cupsIdx];
                if (!cupsVal || String(cupsVal).trim() === '') continue; // Omitir filas vacías

                let fechaRaw = row[fechaIdx];
                if (typeof fechaRaw === 'number') {
                    // Si Excel devuelve fecha numérica de serie
                    const fechaObj = XLSX.SSF.parse_date_code(fechaRaw);
                    if (fechaObj) {
                        const anio = fechaObj.y;
                        const mes = String(fechaObj.m).padStart(2, '0');
                        const dia = String(fechaObj.d).padStart(2, '0');
                        const hora = String(fechaObj.H || 0).padStart(2, '0');
                        const min = String(fechaObj.M || 0).padStart(2, '0');
                        fechaRaw = `${anio}/${mes}/${dia} ${hora}:${min}`;
                    }
                } else {
                    fechaRaw = String(fechaRaw || '').trim();
                }

                const fechaFormateada = fechaRaw.replace(/\//g, '-');

                registros.push({
                    suministro: String(cupsVal).trim(),
                    periodo: fechaFormateada,
                    estacion: invVerIdx !== -1 ? (parseInt(row[invVerIdx]) || 0) : 0,
                    periodo_tarifa: periodoIdx !== -1 ? String(row[periodoIdx] || 'Valle').trim() : 'Valle',
                    consumo: parseInt(row[consumoIdx]) || 0,
                    generacion: genIdx !== -1 ? (parseInt(row[genIdx]) || 0) : 0
                });
            }

            if (registros.length === 0) {
                throw new Error("No se han encontrado registros de datos válidos debajo de la cabecera.");
            }

            mostrarEstado(`Procesados ${registros.length} registros. Enviando a la Edge Function...`, "info");

            // Llamada a la misma Edge Function existente
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

            mostrarEstado(`¡Carga de Excel completada con éxito! Se han procesado ${registros.length} registros correctamente.`, "success");
            fileInputXlsx.value = "";

            // Refrescar los últimos periodos en pantalla
            consultarUltimoPeriodo();

        } catch (err) {
            console.error("Error detallado durante el proceso del Excel:", err);
            mostrarEstado("Error al cargar el fichero Excel: " + err.message, "error");
        } finally {
            btnUploadXlsx.disabled = false;
        }
    };

    reader.onerror = function () {
        mostrarEstado("Error al leer el archivo Excel desde el equipo.", "error");
        btnUploadXlsx.disabled = false;
    };

    // Leer siempre como ArrayBuffer para evitar corrupciones binarias en formatos .xls/.xlsx
    reader.readAsArrayBuffer(file);
}

if (btnUploadXlsx) {
    btnUploadXlsx.addEventListener('click', procesarExcel);
}

// Validación de sesión inicial y carga de último periodo al iniciar la página
verificarSesion().then((valida) => {
    if (valida) {
        consultarUltimoPeriodo();
    }
});
