// assets/js/loadcsv.js - Lógica para la carga de ficheros CSV con formato de fecha corregido
import { supabase } from './supabaseClient.js';

const fileInput = document.getElementById('csv-file-input');
const btnUpload = document.getElementById('btn-upload-csv');
const statusDiv = document.getElementById('upload-status');

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

async function procesarCSV() {
    const sesionValida = await verificarSesion();
    if (!sesionValida) return;

    const file = fileInput.files[0];
    if (!file) {
        mostrarEstado("Por favor, selecciona un archivo CSV primero.", "error");
        return;
    }

    mostrarEstado("Leyendo y parseando el fichero CSV...", "info");
    btnUpload.disabled = true;

    const reader = new FileReader();

    reader.onload = async function (e) {
        try {
            const texto = e.target.result;
            const lineas = texto.split(/\r\n|\n/);
            const registros = [];

            for (let i = 1; i < lineas.length; i++) {
                const linea = lineas.trim();
                if (!linea) continue;

                const columnas = linea.split(';');
                if (columnas.length >= 6) {
                    // Normalizar la fecha: cambiar barras '/' por guiones '-' para formato PostgreSQL (YYYY-MM-DD HH:mm)
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

            if (registros.length === 0) {
                mostrarEstado("El archivo CSV no contiene registros válidos o está vacío.", "error");
                btnUpload.disabled = false;
                return;
            }

            mostrarEstado(`Procesados ${registros.length} registros. Enviando a la Edge Function...`, "info");

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

        } catch (err) {
            console.error("Error detallado durante el proceso:", err);
            mostrarEstado("Error al cargar los datos: " + err.message, "error");
        } finally {
            btnUpload.disabled = false;
        }
    };

    reader.onerror = function () {
        mostrarEstado("Error al leer el archivo desde el equipo.", "error");
        btnUpload.disabled = false;
    };

    reader.readAsText(file, 'UTF-8');
}

if (btnUpload) {
    btnUpload.addEventListener('click', procesarCSV);
}

verificarSesion();
