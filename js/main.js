// --- Estado global del plan ---
let planData = null;
let lastSavedJson = '';
let currentFileName = '';
const timeSlots = [
  { key: 'breakfast', label: 'Desayuno' },
  { key: 'snack1', label: 'Colación 1' },
  { key: 'lunch', label: 'Comida' },
  { key: 'snack2', label: 'Colación 2' },
  { key: 'dinner', label: 'Cena' }
];

// Nuevo estado para mantener seguimiento del foco
let activeElement = null;
let activeElementSelectionStart = 0;
let activeElementSelectionEnd = 0;

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

// Función para preservar el foco antes de renderizar
function saveActiveElementState() {
  activeElement = document.activeElement;
  if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'SELECT')) {
    // Guardar información sobre el elemento activo
    const timeslot = activeElement.dataset.timeslot;
    const menuidx = activeElement.dataset.menuidx;
    const dishidx = activeElement.dataset.dishidx;
    const ingidx = activeElement.dataset.ingidx;
    const editType = activeElement.dataset.edit;

    // Guardar la posición del cursor
    if (activeElement.selectionStart !== undefined) {
      activeElementSelectionStart = activeElement.selectionStart;
      activeElementSelectionEnd = activeElement.selectionEnd;
    }

    // Construir un selector que identifique únicamente este elemento
    activeElement.uniqueSelector = `[data-edit="${editType}"][data-timeslot="${timeslot}"]` +
      (menuidx !== undefined ? `[data-menuidx="${menuidx}"]` : '') +
      (dishidx !== undefined ? `[data-dishidx="${dishidx}"]` : '') +
      (ingidx !== undefined ? `[data-ingidx="${ingidx}"]` : '');
  }
}

// Función para restaurar el foco después de renderizar
function restoreActiveElementState() {
  if (activeElement && activeElement.uniqueSelector) {
    const newActiveElement = document.querySelector(activeElement.uniqueSelector);
    if (newActiveElement) {
      newActiveElement.focus();

      // Restaurar la posición del cursor
      if (newActiveElement.tagName === 'INPUT' && activeElementSelectionStart !== undefined) {
        // Colocar el cursor al final
        const valueLength = newActiveElement.value.length;
        newActiveElement.setSelectionRange(valueLength, valueLength);
      }
    }
    activeElement = null;
  }
}

// --- Validación de fracciones y enteros ---
function isValidFraction(str) {
  // Permite: 1, 1/2, 2 1/2, 1 3/4, 3/4, 2, etc.
  return /^(\d+\s+)?\d+\/\d+$/.test(str.trim()) || /^\d+$/.test(str.trim());
}

// --- Detectar unidad métrica a partir de texto ---
function detectMetricUnit(unitStr) {
  if (!unitStr) return '';

  // Convertir a minúsculas y eliminar espacios
  const unit = unitStr.toLowerCase().trim();

  // Detectar "g" solo como gramos
  if (unit === 'g') return 'gramos';

  // Detectar "ml" como mililitros
  if (unit === 'ml') return 'mililitros';

  // Mantener el valor original si no coincide con estos patrones
  return unitStr;
}

// --- Renderizado principal ---
function renderPlan() {
  // Guardar posición de scroll y estado del foco
  const scrollPos = {
    x: window.scrollX || window.pageXOffset,
    y: window.scrollY || window.pageYOffset
  };

  // Guardar el estado del elemento activo
  saveActiveElementState();

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
            data-edit="menuName" data-timeslot="${slot.key}" data-menuidx="${menuIdx}">${isEmpty(menuOption.menuName) ? '[Editar nombre de menú]' : escapeHtml(menuOption.menuName)}</span>
          <button class="add-btn" data-action="add-dish" data-timeslot="${slot.key}" data-menuidx="${menuIdx}" title="Añadir plato">Plato</button>
          <button class="delete-btn" data-action="delete-menu" data-timeslot="${slot.key}" data-menuidx="${menuIdx}" title="Eliminar opción de menú"></button>
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
              data-edit="dishName" data-timeslot="${slot.key}" data-menuidx="${menuIdx}" data-dishidx="${dishIdx}">${isEmpty(dish.name) ? '[Editar nombre de plato]' : escapeHtml(dish.name)}</span>
            <button class="add-btn" data-action="add-ingredient" data-timeslot="${slot.key}" data-menuidx="${menuIdx}" data-dishidx="${dishIdx}" title="Añadir ingrediente">Ingrediente</button>
            <button class="delete-btn" data-action="delete-dish" data-timeslot="${slot.key}" data-menuidx="${menuIdx}" data-dishidx="${dishIdx}" title="Eliminar plato"></button>
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

          // Validación: comprobar si hay unidades sin cantidades o viceversa
          const hasMetricQuantity = !isEmpty(ing.metricQuantity);
          const hasMetricUnit = !isEmpty(ing.metricUnit);
          const hasAltQuantity = !isEmpty(ing.alternativeQuantity);
          const hasAltUnit = !isEmpty(ing.alternativeUnit);

          const metricQuantityWarning = hasMetricUnit && !hasMetricQuantity;
          const metricUnitWarning = hasMetricQuantity && !hasMetricUnit;
          const altQuantityWarning = hasAltUnit && !hasAltQuantity;
          const altUnitWarning = hasAltQuantity && !hasAltUnit;

          // --- RENDER DE INGREDIENTE ---
          let metricUnitHtml = '';
          if (!isEmpty(ing.metricQuantity)) {
            // Si hay cantidad, muestra dropdown con las opciones correctas
            const unit = ing.metricUnit;

            // Determinar si es un valor estándar o uno personalizado
            const isGramos = unit === 'gramos' || unit === 'g';
            const isMililitros = unit === 'mililitros' || unit === 'ml';
            const isCustomUnit = !isGramos && !isMililitros && !isEmpty(unit);

            if (isCustomUnit) {
              // Si es una unidad personalizada, mostrarla como opción
              metricUnitHtml = `
                <select class="metric-unit-select${metricUnitWarning ? ' validation-warning' : ''}" data-edit="metricUnit" data-timeslot="${slot.key}" data-menuidx="${menuIdx}" data-dishidx="${dishIdx}" data-ingidx="${ingIdx}">
                  <option value="gramos" ${isGramos ? 'selected' : ''}>gramos</option>
                  <option value="mililitros" ${isMililitros ? 'selected' : ''}>mililitros</option>
                  <option value="${escapeHtml(unit)}" selected>${escapeHtml(unit)}</option>
                </select>
              `;
            } else {
              // Si es gramos o mililitros, solo mostrar las opciones estándar
              metricUnitHtml = `
                <select class="metric-unit-select${metricUnitWarning ? ' validation-warning' : ''}" data-edit="metricUnit" data-timeslot="${slot.key}" data-menuidx="${menuIdx}" data-dishidx="${dishIdx}" data-ingidx="${ingIdx}">
                  <option value="gramos" ${isGramos ? 'selected' : ''}>gramos</option>
                  <option value="mililitros" ${isMililitros ? 'selected' : ''}>mililitros</option>
                </select>
              `;
            }
          } else {
            // Si no hay cantidad, muestra placeholder
            metricUnitHtml = `
              <span class="editable placeholder${metricUnitWarning ? ' validation-warning' : ''}" data-edit="metricUnit" tabindex="0"
                data-timeslot="${slot.key}" data-menuidx="${menuIdx}" data-dishidx="${dishIdx}" data-ingidx="${ingIdx}">
                [Unidad]
              </span>
            `;
          }

          // Unidad alternativa - siempre mostrarla como editable, independientemente
          // del valor en cantidad alternativa
          let altUnitHtml = '';
          if (isEmpty(ing.alternativeUnit)) {
            altUnitHtml = `
              <span class="editable placeholder${altUnitWarning ? ' validation-warning' : ''}" data-edit="alternativeUnit" tabindex="0"
                data-timeslot="${slot.key}" data-menuidx="${menuIdx}" data-dishidx="${dishIdx}" data-ingidx="${ingIdx}">
                [Alt. Unidad]
              </span>
            `;
          } else {
            altUnitHtml = `
              <span class="editable${altUnitWarning ? ' validation-warning' : ''}" data-edit="alternativeUnit" tabindex="0"
                data-timeslot="${slot.key}" data-menuidx="${menuIdx}" data-dishidx="${dishIdx}" data-ingidx="${ingIdx}">
                ${escapeHtml(ing.alternativeUnit)}
              </span>
            `;
          }

          li.innerHTML = `
            <span class="drag-handle" title="Arrastrar para reordenar">&#x2630;</span>
            <span class="editable ingredient-name${isEmpty(ing.name) ? ' placeholder' : ''}" tabindex="0"
              data-edit="ingredientName" data-timeslot="${slot.key}" data-menuidx="${menuIdx}"
              data-dishidx="${dishIdx}" data-ingidx="${ingIdx}">
              ${isEmpty(ing.name) ? '[Ingrediente]' : escapeHtml(ing.name)}
            </span>
            <span class="ingredient-fields">
              <input type="text" class="inline-edit${metricQuantityWarning ? ' validation-warning' : ''}" style="width:40px;" data-edit="metricQuantity"
                data-timeslot="${slot.key}" data-menuidx="${menuIdx}" data-dishidx="${dishIdx}" data-ingidx="${ingIdx}"
                value="${isEmpty(ing.metricQuantity) ? '' : ing.metricQuantity}" placeholder="X" />
              ${metricUnitHtml}
              <input type="text" class="inline-edit${altQuantityWarning ? ' validation-warning' : ''}" style="width:90px;" data-edit="alternativeQuantity"
                data-timeslot="${slot.key}" data-menuidx="${menuIdx}" data-dishidx="${dishIdx}" data-ingidx="${ingIdx}"
                value="${isEmpty(ing.alternativeQuantity) ? '' : ing.alternativeQuantity}" placeholder="Y" />
              ${altUnitHtml}
              <button class="delete-btn" data-action="delete-ingredient" data-timeslot="${slot.key}"
                data-menuidx="${menuIdx}" data-dishidx="${dishIdx}" data-ingidx="${ingIdx}"
                title="Eliminar ingrediente"></button>
            </span>
          `;
          // --- FIN RENDER DE INGREDIENTE ---
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
    addMenuBtn.textContent = `Opción`;
    addMenuBtn.dataset.action = 'add-menu';
    addMenuBtn.dataset.timeslot = slot.key;
    section.appendChild(addMenuBtn);
    container.appendChild(section);
  });

  // Restaurar posición de scroll
  setTimeout(() => {
    window.scrollTo(scrollPos.x, scrollPos.y);

    // Restaurar el foco después de renderizar
    restoreActiveElementState();
  }, 0);
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

  // Añadir atributos data para poder encontrar este elemento después
  input.dataset.edit = editType;
  input.dataset.timeslot = timeslot;
  if (menuIdx !== undefined) input.dataset.menuidx = menuIdx;
  if (dishIdx !== undefined) input.dataset.dishidx = dishIdx;
  if (ingIdx !== undefined) input.dataset.ingidx = ingIdx;

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

  // Enfocar y seleccionar todo el texto
  input.focus();
  input.select();
}

function saveInlineEdit(input, origSpan, editType, timeslot, menuIdx, dishIdx, ingIdx) {
  const val = input.value.trim();
  // Validación de fracciones y enteros para cantidad y alternativa
  if (editType === 'metricQuantity' || editType === 'alternativeQuantity') {
    if (val !== '' && !isValidFraction(val)) {
      showFeedback('Solo se permiten números enteros o fracciones tipo 1/2, 2 1/2, etc.', 'error', 3000);
      input.focus();
      return;
    }
  }

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
    case 'metricQuantity':
      planData[timeslot][menuIdx].dishes[dishIdx].ingredients[ingIdx].metricQuantity = val;
      // Si se borra la cantidad, borra la unidad y actualiza de inmediato
      if (val === '') {
        planData[timeslot][menuIdx].dishes[dishIdx].ingredients[ingIdx].metricUnit = '';
      } else if (isEmpty(planData[timeslot][menuIdx].dishes[dishIdx].ingredients[ingIdx].metricUnit)) {
        planData[timeslot][menuIdx].dishes[dishIdx].ingredients[ingIdx].metricUnit = 'gramos';
      }
      changed = true;
      break;
    case 'alternativeQuantity':
      planData[timeslot][menuIdx].dishes[dishIdx].ingredients[ingIdx].alternativeQuantity = val;
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

// --- Manejo de dropdown de unidad métrica ---
document.addEventListener('change', function (e) {
  if (e.target.classList.contains('metric-unit-select')) {
    const select = e.target;
    const timeslot = select.dataset.timeslot;
    const menuIdx = +select.dataset.menuidx;
    const dishIdx = +select.dataset.dishidx;
    const ingIdx = +select.dataset.ingidx;

    // Guardar estado del elemento activo antes de cambiar
    saveActiveElementState();

    planData[timeslot][menuIdx].dishes[dishIdx].ingredients[ingIdx].metricUnit = select.value;

    renderPlan();
  }
});

// Manejo directo de inputs sin renderizar todo el plan
document.addEventListener('input', function (e) {
  if (e.target.matches('input[data-edit="metricQuantity"], input[data-edit="alternativeQuantity"]')) {
    const input = e.target;
    const editType = input.dataset.edit;
    const timeslot = input.dataset.timeslot;
    const menuIdx = +input.dataset.menuidx;
    const dishIdx = +input.dataset.dishidx;
    const ingIdx = +input.dataset.ingidx;
    let val = input.value;

    // Validación de fracciones y enteros
    if ((editType === 'metricQuantity' || editType === 'alternativeQuantity') &&
      val !== '' && !isValidFraction(val)) {
      input.setCustomValidity('Solo se permiten números enteros o fracciones tipo 1/2, 2 1/2, etc.');
      input.reportValidity();
      return;
    } else {
      input.setCustomValidity('');
    }

    // Actualizar el modelo de datos
    if (editType === 'metricQuantity') {
      planData[timeslot][menuIdx].dishes[dishIdx].ingredients[ingIdx].metricQuantity = val;

      // Si se borra la cantidad, hay que borrar la unidad y actualizar
      // Si se añade una cantidad sin unidad, hay que asignar una unidad por defecto
      if (val === '' && !isEmpty(planData[timeslot][menuIdx].dishes[dishIdx].ingredients[ingIdx].metricUnit)) {
        planData[timeslot][menuIdx].dishes[dishIdx].ingredients[ingIdx].metricUnit = '';
        renderPlan();
      } else if (val !== '' && isEmpty(planData[timeslot][menuIdx].dishes[dishIdx].ingredients[ingIdx].metricUnit)) {
        planData[timeslot][menuIdx].dishes[dishIdx].ingredients[ingIdx].metricUnit = 'gramos';
        renderPlan();
      }

      // Aplicar advertencia visual si es necesario sin renderizar todo
      const altUnitElement = document.querySelector(`[data-edit="alternativeUnit"][data-timeslot="${timeslot}"][data-menuidx="${menuIdx}"][data-dishidx="${dishIdx}"][data-ingidx="${ingIdx}"]`);
      const altQuantityElement = document.querySelector(`[data-edit="alternativeQuantity"][data-timeslot="${timeslot}"][data-menuidx="${menuIdx}"][data-dishidx="${dishIdx}"][data-ingidx="${ingIdx}"]`);

      if (altUnitElement && altQuantityElement) {
        const hasAltQuantity = !isEmpty(altQuantityElement.value);
        const hasAltUnit = !isEmpty(altUnitElement.textContent) && !altUnitElement.textContent.includes('[');

        if (hasAltUnit && !hasAltQuantity) {
          altQuantityElement.classList.add('validation-warning');
        } else {
          altQuantityElement.classList.remove('validation-warning');
        }

        if (hasAltQuantity && !hasAltUnit) {
          altUnitElement.classList.add('validation-warning');
        } else {
          altUnitElement.classList.remove('validation-warning');
        }
      }

    } else if (editType === 'alternativeQuantity') {
      planData[timeslot][menuIdx].dishes[dishIdx].ingredients[ingIdx].alternativeQuantity = val;

      // Aplicar advertencia visual si es necesario sin renderizar todo
      const altUnitElement = document.querySelector(`[data-edit="alternativeUnit"][data-timeslot="${timeslot}"][data-menuidx="${menuIdx}"][data-dishidx="${dishIdx}"][data-ingidx="${ingIdx}"]`);

      if (altUnitElement) {
        const hasAltUnit = !isEmpty(altUnitElement.textContent) && !altUnitElement.textContent.includes('[');

        if (val !== '' && !hasAltUnit) {
          altUnitElement.classList.add('validation-warning');
        } else {
          altUnitElement.classList.remove('validation-warning');
        }

        if (val === '' && hasAltUnit) {
          input.classList.add('validation-warning');
        } else {
          input.classList.remove('validation-warning');
        }
      }
    }
  }
});

// --- Añadir elementos ---
function handleAdd(e) {
  // Guardar posición de scroll
  const scrollPos = {
    x: window.scrollX || window.pageXOffset,
    y: window.scrollY || window.pageYOffset
  };

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
    // Hacer scroll al final de la sección recién añadida
    const sections = document.querySelectorAll(`.time-slot[data-timeslot="${timeslot}"]`);
    if (sections.length) {
      sections[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  } else if (action === 'add-dish') {
    planData[timeslot][menuIdx].dishes.push({
      name: '',
      ingredients: []
    });
    renderPlan();
    window.scrollTo(scrollPos.x, scrollPos.y);
  } else if (action === 'add-ingredient') {
    planData[timeslot][menuIdx].dishes[dishIdx].ingredients.push({
      name: '',
      metricQuantity: '',
      metricUnit: '',
      alternativeQuantity: '',
      alternativeUnit: ''
    });
    renderPlan();
    window.scrollTo(scrollPos.x, scrollPos.y);
  }
}

// --- Eliminar elementos ---
function handleDelete(e) {
  // Guardar posición de scroll
  const scrollPos = {
    x: window.scrollX || window.pageXOffset,
    y: window.scrollY || window.pageYOffset
  };

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
      window.scrollTo(scrollPos.x, scrollPos.y);
    }
  } else if (action === 'delete-dish') {
    msg = '¿Eliminar este plato?';
    if (window.confirm(msg)) {
      planData[timeslot][menuIdx].dishes.splice(dishIdx, 1);
      renderPlan();
      window.scrollTo(scrollPos.x, scrollPos.y);
    }
  } else if (action === 'delete-ingredient') {
    msg = '¿Eliminar este ingrediente?';
    if (window.confirm(msg)) {
      planData[timeslot][menuIdx].dishes[dishIdx].ingredients.splice(ingIdx, 1);
      renderPlan();
      window.scrollTo(scrollPos.x, scrollPos.y);
    }
  }
}

// --- Reordenamiento drag & drop con feedback visual y SWAP ---
let dragSrc = null;
let dragOverEl = null;
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
  // Feedback visual: resalta solo el tipo correcto
  const src = dragSrc;
  const tgt = e.target.closest('.menu-option, .dish, .ingredient');
  if (dragOverEl && dragOverEl !== tgt) {
    dragOverEl.classList.remove('drag-over');
  }
  if (tgt && tgt !== src) {
    // Solo resalta si el tipo coincide
    if (
      (src.classList.contains('menu-option') && tgt.classList.contains('menu-option')) ||
      (src.classList.contains('dish') && tgt.classList.contains('dish')) ||
      (src.classList.contains('ingredient') && tgt.classList.contains('ingredient'))
    ) {
      tgt.classList.add('drag-over');
      dragOverEl = tgt;
    } else if (dragOverEl) {
      dragOverEl.classList.remove('drag-over');
      dragOverEl = null;
    }
  }
}
function handleDrop(e) {
  e.preventDefault();
  if (dragOverEl) dragOverEl.classList.remove('drag-over');
  if (!dragSrc) return;

  // Guardar posición de scroll
  const scrollPos = {
    x: window.scrollX || window.pageXOffset,
    y: window.scrollY || window.pageYOffset
  };

  const src = dragSrc;
  const tgt = e.target.closest('.menu-option, .dish, .ingredient');
  if (!tgt || src === tgt) return;
  // Solo permite soltar en el mismo tipo y hace SWAP
  if (src.classList.contains('menu-option') && tgt.classList.contains('menu-option')) {
    const timeslot = src.dataset.timeslot;
    const srcIdx = +src.dataset.menuidx;
    const tgtIdx = +tgt.dataset.menuidx;
    if (srcIdx !== tgtIdx) {
      const arr = planData[timeslot];
      [arr[srcIdx], arr[tgtIdx]] = [arr[tgtIdx], arr[srcIdx]];
      renderPlan();
      window.scrollTo(scrollPos.x, scrollPos.y);
    }
  } else if (src.classList.contains('dish') && tgt.classList.contains('dish')) {
    const timeslot = src.dataset.timeslot;
    const menuIdx = +src.dataset.menuidx;
    const srcIdx = +src.dataset.dishidx;
    const tgtIdx = +tgt.dataset.dishidx;
    if (srcIdx !== tgtIdx) {
      const arr = planData[timeslot][menuIdx].dishes;
      [arr[srcIdx], arr[tgtIdx]] = [arr[tgtIdx], arr[srcIdx]];
      renderPlan();
      window.scrollTo(scrollPos.x, scrollPos.y);
    }
  } else if (src.classList.contains('ingredient') && tgt.classList.contains('ingredient')) {
    const timeslot = src.dataset.timeslot;
    const menuIdx = +src.dataset.menuidx;
    const dishIdx = +src.dataset.dishidx;
    const srcIdx = +src.dataset.ingidx;
    const tgtIdx = +tgt.dataset.ingidx;
    if (srcIdx !== tgtIdx) {
      const arr = planData[timeslot][menuIdx].dishes[dishIdx].ingredients;
      [arr[srcIdx], arr[tgtIdx]] = [arr[tgtIdx], arr[srcIdx]];
      renderPlan();
      window.scrollTo(scrollPos.x, scrollPos.y);
    }
  }
  dragSrc = null;
  dragOverEl = null;
}
function handleDragEnd(e) {
  e.target.style.opacity = '';
  if (dragOverEl) dragOverEl.classList.remove('drag-over');
  dragSrc = null;
  dragOverEl = null;
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

      // Normalizar las unidades métricas (g -> gramos, ml -> mililitros)
      normalizeMetricUnits(json);

      planData = deepClone(json);
      lastSavedJson = prettyJson(planData);

      // Usar el nombre del archivo como ID del plan
      const filename = file.name.replace(/\.json$/, '');
      currentFileName = filename;
      planData.id = filename;

      renderPlan();
      showFeedback('JSON cargado correctamente.', 'info');
    } catch (err) {
      showFeedback('Error al parsear el archivo JSON.', 'error', 5000);
    }
  };
  reader.readAsText(file, 'utf-8');
}

// Función para normalizar unidades métricas
function normalizeMetricUnits(json) {
  // Recorrer todas las comidas
  timeSlots.forEach(slot => {
    if (json[slot.key]) {
      json[slot.key].forEach(menu => {
        if (menu.dishes) {
          menu.dishes.forEach(dish => {
            if (dish.ingredients) {
              dish.ingredients.forEach(ing => {
                // Normalizar unidades métricas: g -> gramos, ml -> mililitros
                if (ing.metricUnit) {
                  const unit = ing.metricUnit.toLowerCase().trim();
                  if (unit === 'g') {
                    ing.metricUnit = 'gramos';
                  } else if (unit === 'ml') {
                    ing.metricUnit = 'mililitros';
                  }
                  // Otras unidades se mantienen sin cambios
                }
              });
            }
          });
        }
      });
    }
  });
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
  let filename = '';

  // Usar el nombre de archivo original si está disponible, sino usar el ID del plan
  if (currentFileName) {
    filename = currentFileName + '.json';
  } else {
    filename = (planData.id ? planData.id : 'plan_nutricional') + '.json';
  }

  download(filename, jsonStr);
  showFeedback('Plan descargado.', 'info', 2000);
}

// --- Delegación de eventos ---
function setupEventDelegation() {
  // Edición inline
  document.getElementById('planContainer').addEventListener('click', handleInlineEdit);

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
  // Crear el contenedor para el feedback al lado del input de ID
  const header = document.querySelector('header');
  const labelAndInput = document.createElement('div');
  labelAndInput.id = 'id-container';

  // Mover elementos existentes
  const label = document.querySelector('label[for="planIdInput"]');
  const input = document.getElementById('planIdInput');
  const feedback = document.getElementById('feedback');

  // Quitar estos elementos de su ubicación actual
  if (label) label.parentElement.removeChild(label);
  if (input) input.parentElement.removeChild(input);
  if (feedback) feedback.parentElement.removeChild(feedback);

  // Añadirlos al nuevo contenedor
  labelAndInput.appendChild(label);
  labelAndInput.appendChild(input);
  labelAndInput.appendChild(feedback);

  // Insertar el nuevo contenedor al principio del header
  header.insertBefore(labelAndInput, header.firstChild);

  // Inicializar eventos
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
