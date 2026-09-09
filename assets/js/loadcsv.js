// assets/js/loadcsv.js - Lógica para la carga de ficheros CSV con depuración
import { supabase } from './supabaseClient.js';

console.log("loadcsv.js cargado correctamente.");

// Elementos del DOM
const fileInput = document.getElementById('csv-file-input');
const btnUpload = document.getElementById('btn-upload-csv');
const statusDiv = document.getElementById('upload-status');

console.log("Elementos encontrados:", { 
    fileInput: !!fileInput, 
    btnUpload: !!btnUpload, 
    statusDiv: !!statusDiv 
});

// Verificar sesión activa al cargar la página
async function verificarSesion() {
    try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            console.warn("No hay sesión activa. Redirigiendo al login...");
            window.location.href = "../login.html";
            return false;
        }
        return true;
    } catch (err) {
        console.error("Error al comprobar la sesión:", err);
        window.location.href = "../login.html";
        return false;
    }
}

// Mostrar mensajes de estado en la interfaz
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

// Procesar el fichero CSV y mapear columnas
async function procesarCSV() {
    console.log("Botón CargaCSV pulsado.");
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
                const linea = lineas[i].trim();
                if (!linea) continue;

                const columnas = linea.split(';');
                if (columnas.length >= 6) {
                    registros.push({
                        suministro: columnas[0].trim(),
                        periodo: columnas[1].trim(),
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
                throw new Error(error.message || "Error al invocar la Edge Function");
            }

            mostrarEstado(`¡Carga completada con éxito! Se han procesado ${registros.length} registros correctamente.`, "success");
            fileInput.value = "";

        } catch (err) {
            console.error("Error durante el proceso de carga:", err);
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

// Registrar el evento del botón de forma segura
if (btnUpload) {
    btnUpload.addEventListener('click', procesarCSV);
    console.log("EventListener añadido correctamente al botón 'btn-upload-csv'.");
} else {
    console.error("¡No se ha encontrado el botón con ID 'btn-upload-csv' en el DOM!");
}

// Verificación inicial
verificarSesion();
