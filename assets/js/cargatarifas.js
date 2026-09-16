// assets/js/cargatarifas.js - Lógica para la carga y gestión de tarifas
import { supabase } from './supabaseClient.js';

let tarifasCache = [];

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            window.location.href = "../login.html";
            return;
        }
    } catch (err) {
        console.error("Error al comprobar sesión:", err);
        window.location.href = "../login.html";
        return;
    }

    const tarifaForm = document.getElementById('tarifaForm');
    const formMessage = document.getElementById('formMessage');
    const submitButton = tarifaForm.querySelector('button[type="submit"]');
    const btnNueva = document.getElementById('btnNueva');
    const formTitle = document.getElementById('formTitle');

    await cargarTarifas();

    if (btnNueva) {
        btnNueva.addEventListener('click', () => {
            tarifaForm.reset();
            document.getElementById('tarifaId').value = '';
            formTitle.textContent = 'Carga de Tarifa Eléctrica';
            btnNueva.classList.add('hidden');
            formMessage.classList.add('hidden');
        });
    }

    if (tarifaForm) {
        tarifaForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            formMessage.classList.remove('hidden', 'bg-emerald-50', 'text-emerald-700', 'bg-rose-50', 'text-rose-700');
            formMessage.textContent = '';

            const originalText = submitButton.textContent;
            const tarifaId = document.getElementById('tarifaId').value;

            try {
                submitButton.textContent = 'Guardando...';
                submitButton.disabled = true;

                const payload = {
                    id: tarifaId ? tarifaId : undefined,
                    suministro: document.getElementById('suministro').value.trim(),
                    nombre: document.getElementById('nombre').value.trim(),
                    punta: parseFloat(document.getElementById('punta').value),
                    llano: parseFloat(document.getElementById('llano').value),
                    valle: parseFloat(document.getElementById('valle').value),
                    excedente: parseFloat(document.getElementById('excedente').value),
                    fijo_punta: parseFloat(document.getElementById('fijo_punta').value),
                    fijo_valle: parseFloat(document.getElementById('fijo_valle').value),
                    activa: document.getElementById('activa').checked,
                    compara: document.getElementById('compara').checked
                };

                const { data, error } = await supabase.functions.invoke('carga-tarifas', {
                    body: payload
                });

                if (error) throw new Error(error.message || 'Error en la invocación de la función.');
                if (data && data.error) throw new Error(data.error);

                formMessage.textContent = tarifaId ? '¡Tarifa actualizada correctamente!' : '¡Tarifa registrada correctamente!';
                formMessage.classList.add('bg-emerald-50', 'text-emerald-700');
                formMessage.classList.remove('hidden');

                tarifaForm.reset();
                document.getElementById('tarifaId').value = '';
                formTitle.textContent = 'Carga de Tarifa Eléctrica';
                btnNueva.classList.add('hidden');

                await cargarTarifas();

            } catch (err) {
                console.error("Error al guardar tarifa:", err);
                formMessage.textContent = `Error: ${err.message || 'No se pudo guardar la tarifa.'}`;
                formMessage.classList.add('bg-rose-50', 'text-rose-700');
                formMessage.classList.remove('hidden');
            } finally {
                submitButton.textContent = originalText;
                submitButton.disabled = false;
            }
        });
    }
});

async function cargarTarifas() {
    const tbody = document.getElementById('tarifasTableBody');
    const contador = document.getElementById('contadorTarifas');

    try {
        const { data, error } = await supabase.functions.invoke('carga-tarifas', {
            method: 'GET'
        });

        if (error) throw new Error(error.message);
        if (data && data.error) throw new Error(data.error);

        tarifasCache = data.data || [];
        contador.textContent = `${tarifasCache.length} tarifa${tarifasCache.length === 1 ? '' : 's'}`;

        if (tarifasCache.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="text-center py-6 text-slate-400">No hay tarifas activas o en comparación.</td></tr>`;
            return;
        }

        tbody.innerHTML = '';
        tarifasCache.forEach((tarifa) => {
            const tr = document.createElement('tr');
            tr.className = tarifa.activa ? 'bg-emerald-50/50 font-medium' : 'hover:bg-slate-50/50';

            let fechaFormateada = '-';
            if (tarifa.created_at) {
                const fechaObj = new Date(tarifa.created_at);
                if (!isNaN(fechaObj)) {
                    fechaFormateada = fechaObj.toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                    });
                }
            }

            tr.innerHTML = `
                <td class="py-3 px-4">
                    <div class="flex flex-col space-y-1">
                        <div class="flex items-center space-x-1.5">
                            ${tarifa.activa ? '<span class="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span>' : ''}
                            <span class="text-slate-900 font-semibold">${tarifa.nombre || 'Sin nombre'}</span>
                        </div>
                        <div class="flex items-center space-x-1.5">
                            <span class="text-indigo-600 font-medium text-[11px] bg-indigo-50 px-2 py-0.5 rounded">${tarifa.alias_suministro || 'Suministro'}</span>
                            ${tarifa.activa ? '<span class="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">Activa</span>' : ''}
                            ${tarifa.compara ? '<span class="text-[9px] bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded font-bold">Compara</span>' : ''}
                        </div>
                    </div>
                </td>
                <td class="py-3 px-4 text-slate-500 text-[11px]">${fechaFormateada}</td>
                <td class="py-3 px-4 text-right">
                    <button type="button" class="btn-editar bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors" data-id="${tarifa.id}">
                        Editar
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.btn-editar').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                llenarFormularioTarifa(id);
            });
        });

    } catch (err) {
        console.error("Error al cargar tarifas:", err);
        tbody.innerHTML = `<tr><td colspan="3" class="text-center py-6 text-rose-500 text-xs">Error al cargar listado.</td></tr>`;
    }
}

function llenarFormularioTarifa(id) {
    const tarifa = tarifasCache.find(t => t.id == id);
    if (!tarifa) return;

    document.getElementById('tarifaId').value = tarifa.id;
    document.getElementById('suministro').value = tarifa.suministro || '';
    document.getElementById('nombre').value = tarifa.nombre || '';
    document.getElementById('punta').value = tarifa.punta ?? '';
    document.getElementById('llano').value = tarifa.llano ?? '';
    document.getElementById('valle').value = tarifa.valle ?? '';
    document.getElementById('excedente').value = tarifa.excedente ?? '';
    document.getElementById('fijo_punta').value = tarifa.fijo_punta ?? '';
    document.getElementById('fijo_valle').value = tarifa.fijo_valle ?? '';
    document.getElementById('activa').checked = Boolean(tarifa.activa);
    document.getElementById('compara').checked = Boolean(tarifa.compara);

    document.getElementById('formTitle').textContent = `Actualizar Tarifa: ${tarifa.nombre}`;
    document.getElementById('btnNueva').classList.remove('hidden');

    window.scrollTo({ top: 0, behavior: 'smooth' });
}
