document.addEventListener('DOMContentLoaded', () => {
    // URL RAW de GitHub para obtener el JSON de tarifas
    const urlTarifas = 'https://raw.githubusercontent.com/almax-es/luzfija.es/main/tarifas.json';
    const contenedorResultado = document.getElementById('resultado');
    const contenedorContador = document.getElementById('contador-tarifas');

    if (!contenedorResultado) return;

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

        // Filtrar estrictamente: 
        // 1. fv.precioBV sea igual a 0 (o no esté definido / sea nulo)
        // 2. fv.exc NO sea menor que 0 (si existe)
        const tarifasFiltradas = listaTarifas.filter(tarifa => {
          const fv = tarifa.fv || {};
          
          // Filtro Precio BV === 0
          const precioBV = Number(fv.precioBV);
          const cumpleBV = !fv.precioBV || isNaN(precioBV) || precioBV === 0;

          // Filtro Excedentes (exc) >= 0 (si el campo exc está presente)
          let cumpleExc = true;
          if (fv.exc !== undefined && fv.exc !== null && fv.exc !== '') {
            const valorExc = Number(fv.exc);
            if (!isNaN(valorExc) && valorExc < 0) {
              cumpleExc = false;
            }
          }

          return cumpleBV && cumpleExc;
        });

        // Contabilizar tipos 1P y 3P (campo fuera de fv)
        let count1P = 0;
        let count3P = 0;

        tarifasFiltradas.forEach(tarifa => {
          if (tarifa.tipo === '1P') {
            count1P++;
          } else if (tarifa.tipo === '3P') {
            count3P++;
          }
        });

        // Actualizar el texto del contador en el HTML
        if (contenedorContador) {
          contenedorContador.textContent = `Mostrando ${tarifasFiltradas.length} tarifas en total (Tipo 1P: ${count1P} | Tipo 3P: ${count3P})`;
        }

        contenedorResultado.classList.remove('loading');
        contenedorResultado.innerHTML = "";

        if (tarifasFiltradas.length === 0) {
          contenedorResultado.innerHTML = `<p style="text-align: center; color: #94a3b8; padding: 2rem;">No se encontraron tarifas con los criterios seleccionados.</p>`;
          return;
        }

        // Renderizar cada tarifa filtrada en su propia card dentro del contenedor con scroll
        tarifasFiltradas.forEach(tarifa => {
          const fv = tarifa.fv || {};
          const cardItem = document.createElement("div");
          cardItem.className = "tarifa-item-card";

          cardItem.innerHTML = `
            <div class="tarifa-titulo-completo">${tarifa.nombre || 'Tarifa sin nombre'} <span style="font-size: 0.75rem; color: #94a3b8; font-weight: normal; margin-left: 8px;">[${tarifa.tipo || 'N/D'}]</span></div>
            
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
                <span style="color: #38bdf8; font-weight: bold;">${fv.precioBV !== undefined ? fv.precioBV + ' €' : '0 €'}</span>
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
});
