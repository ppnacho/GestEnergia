// URL RAW de GitHub para obtener el JSON de tarifas
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
    console.log("Datos de tarifas cargados correctamente:", data);

    // Extraer la lista de tarifas (manejando si vienen en un objeto { tarifas: [...] } o directamente como array)
    const listaTarifas = Array.isArray(data) ? data : (data.tarifas || []);

    // Aplicar el filtro requerido:
    // fv.tipo diferente de "NO COMPENSA" Y fv.bv === true
    const tarifasFiltradas = listaTarifas.filter(tarifa => {
      const fv = tarifa.fv;
      if (!fv) return false;
      return fv.tipo !== "NO COMPENSA" && fv.bv === true;
    });

    contenedorResultado.classList.remove('loading');
    contenedorResultado.innerHTML = "";

    if (tarifasFiltradas.length === 0) {
      contenedorResultado.innerHTML = `<p style="text-align: center; color: #94a3b8; padding: 2rem;">No se encontraron tarifas que cumplan con los criterios de Batería Virtual activa y compensación.</p>`;
      return;
    }

    // Renderizar cada tarifa filtrada en su propia card dentro del contenedor con scroll
    tarifasFiltradas.forEach(tarifa => {
      const fv = tarifa.fv || {};
      const cardItem = document.createElement("div");
      cardItem.className = "tarifa-item-card";

      cardItem.innerHTML = `
        <div class="tarifa-titulo-completo">${tarifa.nombre || 'Tarifa sin nombre'}</div>
        
        <div class="tarifa-campo">
            <label>Consumo Punta</label>
            <span>${tarifa.cPunta !== undefined ? tarifa.cPunta + ' €/kWh' : '—'}</span>
        </div>

        <div class="tarifa-campo">
            <label>Consumo Llano</label>
            <span>${tarifa.cLlano !== undefined ? tarifa.cLlano + ' €/kWh' : '—'}</span>
        </div>

        <div class="tarifa-campo">
            <label>Consumo Valle</label>
            <span>${tarifa.cValle !== undefined ? tarifa.cValle + ' €/kWh' : '—'}</span>
        </div>

        <div class="tarifa-campo">
            <label>Potencia P1</label>
            <span>${tarifa.p1 !== undefined ? tarifa.p1 + ' €/kW·día' : '—'}</span>
        </div>

        <div class="tarifa-campo">
            <label>Potencia P2</label>
            <span>${tarifa.p2 !== undefined ? tarifa.p2 + ' €/kW·día' : '—'}</span>
        </div>

        <div class="tarifa-campo">
            <label>Excedentes (exc)</label>
            <span>${fv.exc !== undefined ? fv.exc + ' €/kWh' : '—'}</span>
        </div>

        <div class="tarifa-campo">
            <label>Precio BV</label>
            <span>${fv.precioBV !== undefined ? fv.precioBV + ' €' : '—'}</span>
        </div>
      `;

      contenedorResultado.appendChild(cardItem);
    });

  })
  .catch(error => {
    console.error("Error al cargar tarifas:", error);
    contenedorResultado.classList.remove('loading');
    contenedorResultado.classList.add('error');
    contenedorResultado.textContent = "Error al cargar las tarifas: " + error.message;
  });
