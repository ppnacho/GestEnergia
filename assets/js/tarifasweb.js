// Usamos la URL RAW de GitHub para obtener directamente el contenido JSON
const urlTarifas = 'https://raw.githubusercontent.com/almax-es/luzfija.es/main/tarifas.json';

const contenedorResultado = document.getElementById('resultado');

fetch(urlTarifas)
  .then(response => {
    if (!response.ok) {
      throw new Error(`Error en la red: ${response.status} ${response.statusText}`);
    }
    return response.json();
  })
  .then(data => {
    console.log("Datos de tarifas cargados:", data);
    
    // Quitamos la clase de carga y pintamos el JSON formateado en el HTML
    contenedorResultado.classList.remove('loading');
    contenedorResultado.textContent = JSON.stringify(data, null, 2);
  })
  .catch(error => {
    console.error("Error al cargar tarifas:", error);
    contenedorResultado.classList.remove('loading');
    contenedorResultado.classList.add('error');
    contenedorResultado.textContent = "Error al cargar tarifas: " + error.message;
  });
