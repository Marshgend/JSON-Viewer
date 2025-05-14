// --- Estado global del plan ---
let planData = null;
let lastSavedJson = '';
const timeSlots = [
  { key: 'breakfast', label: 'Desayuno' },
  { key: 'snack1', label: 'Colación 1' },
  { key: 'lunch', label: 'Comida' },
  { key: 'snack2', label: 'Colación 2' },
  { key: 'dinner', label: 'Cena' }
];

// --- Utilidades ---
function showFeedback(msg, type = 'info', timeout = 3000) {
  const fb = document.getElementById('feedback');
  fb.textContent = msg;
  fb.className = 'feedback' + (type === 'error' ? ' error' : '');
  fb.style.display = 'block';
  if (timeout) setTimeout(() => { fb.style.display = 'none'; }, timeout);
}
function clearFeedback() {
  document.getElementById('feedback').style.display = 'none';
}
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
function prettyJson(obj) {
  return JSON.stringify(obj, null, 2);
}
function download(filename, text) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }, 100);
}
function getTimeSlotLabel(key) {
  const slot = timeSlots.find(s => s.key === key);
  return slot ? slot.label : key;
}
function isEmpty(val) {
  return val === undefined || val === null || val === '';
}
function placeholder(val, ph) {
  return isEmpty(val)
    ? `<span class="placeholder">${ph}</span>`
    : escapeHtml(val);
}
function focusAndSelect(el) {
  setTimeout(() => { el.focus(); el.select && el.select(); }, 0);
}

// --- Renderizado principal ---
function renderPlan() {
  const container = document.getElementById('planContainer');
  container.innerHTML = '';
  if (!planData) {
    container.innerHTML = '<p>Carga un archivo JSON para comenzar.</p>';
    return;
  }
  // ID del plan
  document.getElementById('planIdInput').value = planData.id || '';
  // Renderizar cada tiempo de comida
  timeSlots.forEach(slot => {
    const arr = planData[slot.key] || [];
    const section = document.createElement('section');
    section.className = 'time-slot';
    section.dataset.timeslot = slot.key;
    section.innerHTML = `<h2>${slot.label}</h2>`;
    // Opciones de menú
    arr.forEach((menuOption, menuIdx) => {
      const menuDiv = document.createElement('div');
      menuDiv.className = 'menu-option';
      menuDiv.draggable = true;
      menuDiv.dataset.menuidx = menuIdx;
      menuDiv.dataset.timeslot = slot.key;
      // MenuName editable
      menuDiv.innerHTML = `
        <div class="menu-option-header">
          <span class="drag-handle" title="Arrastrar para reordenar">&#x2630;</span>
          <span class="editable menu-name${isEmpty(menuOption.menuName) ? ' placeholder' : ''}" tabindex="0"
            data-edit="menuName" data-timeslot="${slot.key}" data-menuidx="${menuIdx}">
            ${isEmpty(menuOption.menuName) ? '[Editar nombre de menú]' : escapeHtml(menuOption.menuName)}
          </span>
          <button class="add-btn" data-action="add-dish" data-timeslot="${slot.key}" data-menuidx="${menuIdx}" title="Añadir plato">+ Plato</button>
          <button class="delete-btn" data-action="delete-menu" data-timeslot="${slot.key}" data-menuidx="${menuIdx}" title="Eliminar opción de menú">&#128465;</button>
        </div>
      `;
      // Platos
      (menuOption.dishes || []).forEach((dish, dishIdx) => {
        const dishDiv = document.createElement('div');
        dishDiv.className = 'dish';
        dishDiv.draggable = true;
        dishDiv.dataset.dishidx = dishIdx;
        dishDiv.dataset.menuidx = menuIdx;
        dishDiv.dataset.timeslot = slot.key;
        dishDiv.innerHTML = `
          <div class="dish-header">
            <span class="drag-handle" title="Arrastrar para reordenar">&#x2630;</span>
            <span class="editable dish-name${isEmpty(dish.name) ? ' placeholder' : ''}" tabindex="0"
              data-edit="dishName" data-timeslot="${slot.key}" data-menuidx="${menuIdx}" data-dishidx="${dishIdx}">
              ${isEmpty(dish.name) ? '[Editar nombre de plato]' : escapeHtml(dish.name)}
            </span>
            <button class="add-btn" data-action="add-ingredient" data-timeslot="${slot.key}" data-menuidx="${menuIdx}" data-dishidx="${dishIdx}" title="Añadir ingrediente">+ Ingrediente</button>
            <button class="delete-btn" data-action="delete-dish" data-timeslot="${slot.key}" data-menuidx="${menuIdx}" data-dishidx="${dishIdx}" title="Eliminar plato">&#128465;</button>
          </div>
        `;
        // Ingredientes
        const ul = document.createElement('ul');
        ul.className = 'ingredient-list';
        (dish.ingredients || []).forEach((ing, ingIdx) => {
          const li = document.createElement('li');
          li.className = 'ingredient';
          li.draggable = true;
          li.dataset.ingidx = ingIdx;
          li.dataset.dishidx = dishIdx;
          li.dataset.menuidx = menuIdx;
          li.dataset.timeslot = slot.key;
          // --- NUEVO RENDER DE INGREDIENTE ---
          li.innerHTML = `
            <span class="drag-handle" title="Arrastrar para reordenar">&#x2630;</span>
            <span class="editable ingredient-name${isEmpty(ing.name) ? ' placeholder' : ''}" tabindex="0"
              data-edit="ingredientName" data-timeslot="${slot.key}" data-menuidx="${menuIdx}"
              data-dishidx="${dishIdx}" data-ingidx="${ingIdx}">
              ${isEmpty(ing.name) ? '[Ingrediente]' : escapeHtml(ing.name)}
            </span>
            <span class="ingredient-fields">
              <input type="number" min="0" step="any" class="inline-edit" style="width:60px;"
                data-edit="metricQuantity" data-timeslot="${slot.key}" data-menuidx="${menuIdx}"
                data-dishidx="${dishIdx}" data-ingidx="${ingIdx}"
                value="${isEmpty(ing.metricQuantity) ? '' : ing.metricQuantity}" placeholder="Cantidad" />
              <span class="editable" data-edit="metricUnit" style="min-width:32px;max-width:80px;display:inline-block;"
                tabindex="0" data-timeslot="${slot.key}" data-menuidx="${menuIdx}"
                data-dishidx="${dishIdx}" data-ingidx="${ingIdx}">
                ${isEmpty(ing.metricUnit) ? '[Unidad]' : escapeHtml(ing.metricUnit)}
              </span>
              <input type="text" class="inline-edit" style="width:60px;"
                data-edit="alternativeQuantity" data-timeslot="${slot.key}" data-menuidx="${menuIdx}"
                data-dishidx="${dishIdx}" data-ingidx="${ingIdx}"
                value="${isEmpty(ing.alternativeQuantity) ? '' : ing.alternativeQuantity}" placeholder="Alt. Cantidad" />
              <span class="editable" data-edit="alternativeUnit" style="min-width:32px;max-width:80px;display:inline-block;"
                tabindex="0" data-timeslot="${slot.key}" data-menuidx="${menuIdx}"
                data-dishidx="${dishIdx}" data-ingidx="${ingIdx}">
                ${isEmpty(ing.alternativeUnit) ? '[Alt. Unidad]' : escapeHtml(ing.alternativeUnit)}
              </span>
              <button class="delete-btn" data-action="delete-ingredient" data-timeslot="${slot.key}"
                data-menuidx="${menuIdx}" data-dishidx="${dishIdx}" data-ingidx="${ingIdx}"
                title="Eliminar ingrediente">&#128465;</button>
            </span>
          `;
          // --- FIN NUEVO RENDER DE INGREDIENTE ---
          ul.appendChild(li);
        });
        dishDiv.appendChild(ul);
        menuDiv.appendChild(dishDiv);
      });
      // Botón añadir plato
      menuDiv.appendChild(document.createElement('div'));
      menuDiv.lastChild.className = 'section-actions';
      menuDiv.lastChild.innerHTML = '';
      menuDiv.appendChild(menuDiv.lastChild);
      section.appendChild(menuDiv);
    });
    // Botón añadir opción de menú
    const addMenuBtn = document.createElement('button');
    addMenuBtn.className = 'add-btn';
    addMenuBtn.textContent = `+ Añadir opción de ${slot.label.toLowerCase()}`;
    addMenuBtn.dataset.action = 'add-menu';
    addMenuBtn.dataset.timeslot = slot.key;
    section.appendChild(addMenuBtn);
    container.appendChild(section);
  });
}

// --- Edición inline ---
function handleInlineEdit(e) {
  const target = e.target;
  if (!target.classList.contains('editable')) return;
  const editType = target.dataset.edit;
  const timeslot = target.dataset.timeslot;
  const menuIdx = +target.dataset.menuidx;
  const dishIdx = +target.dataset.dishidx;
  const ingIdx = +target.dataset.ingidx;
  let value = target.textContent.trim();
  // Crear input
  const input = document.createElement('input');
  input.type = 'text';
  input.value = isEmpty(value) || value.startsWith('[') ? '' : value;
  input.className = 'inline-edit';
  // Si es nombre de ingrediente, plato o menú, dale la clase para que ocupe todo el ancho
  if (editType === 'ingredientName') {
    input.classList.add('ingredient-name');
  }
  if (editType === 'dishName') {
    input.classList.add('dish-name');
  }
  if (editType === 'menuName') {
    input.classList.add('menu-name');
  }
  input.style.minWidth = '60px';
  input.addEventListener('blur', () => {
    saveInlineEdit(input, target, editType, timeslot, menuIdx, dishIdx, ingIdx);
  });
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') {
      input.blur();
    } else if (ev.key === 'Escape') {
      renderPlan();
    }
  });
  target.replaceWith(input);
  focusAndSelect(input);
}
function saveInlineEdit(input, origSpan, editType, timeslot, menuIdx, dishIdx, ingIdx) {
  const val = input.value.trim();
  // Actualizar en planData
  let changed = false;
  switch (editType) {
    case 'menuName':
      planData[timeslot][menuIdx].menuName = val;
      changed = true;
      break;
    case 'dishName':
      planData[timeslot][menuIdx].dishes[dishIdx].name = val;
      changed = true;
      break;
    case 'ingredientName':
      planData[timeslot][menuIdx].dishes[dishIdx].ingredients[ingIdx].name = val;
      changed = true;
      break;
    case 'metricUnit':
      planData[timeslot][menuIdx].dishes[dishIdx].ingredients[ingIdx].metricUnit = val;
      changed = true;
      break;
    case 'alternativeUnit':
      planData[timeslot][menuIdx].dishes[dishIdx].ingredients[ingIdx].alternativeUnit = val;
      changed = true;
      break;
  }
  if (changed) {
    renderPlan();
  }
}
// Edición de metricQuantity y alternativeQuantity (inputs directos)
function handleInputChange(e) {
  const input = e.target;
  const editType = input.dataset.edit;
  const timeslot = input.dataset.timeslot;
  const menuIdx = +input.dataset.menuidx;
  const dishIdx = +input.dataset.dishidx;
  const ingIdx = +input.dataset.ingidx;
  let val = input.value;
  if (editType === 'metricQuantity') {
    planData[timeslot][menuIdx].dishes[dishIdx].ingredients[ingIdx].metricQuantity = val === '' ? '' : Number(val);
  } else if (editType === 'alternativeQuantity') {
    planData[timeslot][menuIdx].dishes[dishIdx].ingredients[ingIdx].alternativeQuantity = val;
  }
}

// --- Añadir elementos ---
function handleAdd(e) {
  const btn = e.target;
  const action = btn.dataset.action;
  const timeslot = btn.dataset.timeslot;
  const menuIdx = +btn.dataset.menuidx;
  const dishIdx = +btn.dataset.dishidx;
  if (action === 'add-menu') {
    if (!planData[timeslot]) planData[timeslot] = [];
    planData[timeslot].push({
      menuName: '',
      dishes: []
    });
    renderPlan();
  } else if (action === 'add-dish') {
    planData[timeslot][menuIdx].dishes.push({
      name: '',
      ingredients: []
    });
    renderPlan();
  } else if (action === 'add-ingredient') {
    planData[timeslot][menuIdx].dishes[dishIdx].ingredients.push({
      name: '',
      metricQuantity: '',
      metricUnit: '',
      alternativeQuantity: '',
      alternativeUnit: ''
    });
    renderPlan();
  }
}

// --- Eliminar elementos ---
function handleDelete(e) {
  const btn = e.target;
  const action = btn.dataset.action;
  const timeslot = btn.dataset.timeslot;
  const menuIdx = +btn.dataset.menuidx;
  const dishIdx = +btn.dataset.dishidx;
  const ingIdx = +btn.dataset.ingidx;
  let msg = '';
  if (action === 'delete-menu') {
    msg = '¿Eliminar esta opción de menú?';
    if (window.confirm(msg)) {
      planData[timeslot].splice(menuIdx, 1);
      renderPlan();
    }
  } else if (action === 'delete-dish') {
    msg = '¿Eliminar este plato?';
    if (window.confirm(msg)) {
      planData[timeslot][menuIdx].dishes.splice(dishIdx, 1);
      renderPlan();
    }
  } else if (action === 'delete-ingredient') {
    msg = '¿Eliminar este ingrediente?';
    if (window.confirm(msg)) {
      planData[timeslot][menuIdx].dishes[dishIdx].ingredients.splice(ingIdx, 1);
      renderPlan();
    }
  }
}

// --- Reordenamiento drag & drop ---
let dragSrc = null;
function handleDragStart(e) {
  const el = e.target;
  dragSrc = el;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', '');
  el.style.opacity = '0.5';
}
function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}
function handleDrop(e) {
  e.preventDefault();
  if (!dragSrc) return;
  const src = dragSrc;
  const tgt = e.target.closest('.menu-option, .dish, .ingredient');
  if (!tgt || src === tgt) return;
  // Determinar tipo y reordenar en planData
  if (src.classList.contains('menu-option') && tgt.classList.contains('menu-option')) {
    const timeslot = src.dataset.timeslot;
    const srcIdx = +src.dataset.menuidx;
    const tgtIdx = +tgt.dataset.menuidx;
    if (srcIdx !== tgtIdx) {
      const arr = planData[timeslot];
      const [item] = arr.splice(srcIdx, 1);
      arr.splice(tgtIdx, 0, item);
      renderPlan();
    }
  } else if (src.classList.contains('dish') && tgt.classList.contains('dish')) {
    const timeslot = src.dataset.timeslot;
    const menuIdx = +src.dataset.menuidx;
    const srcIdx = +src.dataset.dishidx;
    const tgtIdx = +tgt.dataset.dishidx;
    if (srcIdx !== tgtIdx) {
      const arr = planData[timeslot][menuIdx].dishes;
      const [item] = arr.splice(srcIdx, 1);
      arr.splice(tgtIdx, 0, item);
      renderPlan();
    }
  } else if (src.classList.contains('ingredient') && tgt.classList.contains('ingredient')) {
    const timeslot = src.dataset.timeslot;
    const menuIdx = +src.dataset.menuidx;
    const dishIdx = +src.dataset.dishidx;
    const srcIdx = +src.dataset.ingidx;
    const tgtIdx = +tgt.dataset.ingidx;
    if (srcIdx !== tgtIdx) {
      const arr = planData[timeslot][menuIdx].dishes[dishIdx].ingredients;
      const [item] = arr.splice(srcIdx, 1);
      arr.splice(tgtIdx, 0, item);
      renderPlan();
    }
  }
  dragSrc = null;
}
function handleDragEnd(e) {
  e.target.style.opacity = '';
  dragSrc = null;
}

// --- Carga de JSON con drag & drop y feedback ---
function setupDropZone() {
  const dropZone = document.getElementById('dropZone');

  // Prevenir comportamiento por defecto en toda la ventana
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    document.addEventListener(eventName, function (e) {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  // Feedback visual solo en el dropZone
  dropZone.addEventListener('dragenter', function (e) {
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragover', function (e) {
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', function (e) {
    dropZone.classList.remove('dragover');
  });
  dropZone.addEventListener('drop', function (e) {
    dropZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0 && (files[0].type === "application/json" || files[0].name.endsWith('.json'))) {
      readJsonFile(files[0]);
    } else {
      showFeedback('Por favor, arrastra un archivo .json válido.', 'error', 4000);
    }
  });
  dropZone.addEventListener('click', function () {
    document.getElementById('jsonFile').click();
  });
}
function readJsonFile(file) {
  const reader = new FileReader();
  reader.onload = function (ev) {
    try {
      const json = JSON.parse(ev.target.result);
      planData = deepClone(json);
      lastSavedJson = prettyJson(planData);
      renderPlan();
      showFeedback('JSON cargado correctamente.', 'info');
    } catch (err) {
      showFeedback('Error al parsear el archivo JSON.', 'error', 5000);
    }
  };
  reader.readAsText(file, 'utf-8');
}

// --- Edición de ID del plan ---
function handlePlanIdEdit(e) {
  if (!planData) return;
  planData.id = e.target.value;
}

// --- Descargar JSON ---
function handleDownload() {
  if (!planData) {
    showFeedback('No hay plan cargado para descargar.', 'error', 3000);
    return;
  }
  // Reconstruir el JSON (ya está en planData)
  const jsonStr = prettyJson(planData);
  const filename = (planData.id ? planData.id : 'plan_nutricional') + '.json';
  download(filename, jsonStr);
  showFeedback('Plan descargado.', 'info', 2000);
}

// --- Delegación de eventos ---
function setupEventDelegation() {
  // Edición inline
  document.getElementById('planContainer').addEventListener('click', handleInlineEdit);
  // Inputs de cantidad/unidad
  document.getElementById('planContainer').addEventListener('input', function (e) {
    if (e.target.matches('input[data-edit="metricQuantity"], input[data-edit="alternativeQuantity"]')) {
      handleInputChange(e);
    }
  });
  // Añadir
  document.getElementById('planContainer').addEventListener('click', function (e) {
    if (e.target.classList.contains('add-btn')) {
      handleAdd(e);
    }
  });
  // Eliminar
  document.getElementById('planContainer').addEventListener('click', function (e) {
    if (e.target.classList.contains('delete-btn')) {
      handleDelete(e);
    }
  });
  // Drag & drop
  document.getElementById('planContainer').addEventListener('dragstart', handleDragStart);
  document.getElementById('planContainer').addEventListener('dragover', handleDragOver);
  document.getElementById('planContainer').addEventListener('drop', handleDrop);
  document.getElementById('planContainer').addEventListener('dragend', handleDragEnd);
}

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('jsonFile').addEventListener('change', function (e) {
    if (e.target.files.length > 0) {
      readJsonFile(e.target.files[0]);
    }
  });
  document.getElementById('planIdInput').addEventListener('input', handlePlanIdEdit);
  document.getElementById('downloadJsonButton').addEventListener('click', handleDownload);
  setupEventDelegation();
  setupDropZone();
  renderPlan();
});
