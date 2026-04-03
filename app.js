const STORAGE_KEY = "maya_epilepsy_events_v1";

const eventForm = document.getElementById("eventForm");
const eventDateInput = document.getElementById("eventDate");
const eventTimeInput = document.getElementById("eventTime");
const durationMinutesInput = document.getElementById("durationMinutes");
const triggersInput = document.getElementById("triggers");
const dailyMedicationInput = document.getElementById("dailyMedication");
const rescueMedicationInput = document.getElementById("rescueMedication");
const symptomsInput = document.getElementById("symptoms");
const notesInput = document.getElementById("notes");

const eventsTableBody = document.getElementById("eventsTableBody");
const totalEventsEl = document.getElementById("totalEvents");
const lastEventTextEl = document.getElementById("lastEventText");
const timeSinceLastNowEl = document.getElementById("timeSinceLastNow");

const downloadPdfBtn = document.getElementById("downloadPdfBtn");
const clearAllBtn = document.getElementById("clearAllBtn");
const resetBtn = document.getElementById("resetBtn");

let events = loadEvents();

init();

function init() {
  setDefaultDateTime();
  renderAll();

  eventForm.addEventListener("submit", handleSubmit);
  clearAllBtn.addEventListener("click", handleClearAll);
  downloadPdfBtn.addEventListener("click", downloadPdf);
  resetBtn.addEventListener("click", () => {
    setTimeout(setDefaultDateTime, 0);
  });

  setInterval(updateLiveTimeSinceLast, 60000);
}

function setDefaultDateTime() {
  const now = new Date();
  eventDateInput.value = formatDateForInput(now);
  eventTimeInput.value = formatTimeForInput(now);
}

function handleSubmit(event) {
  event.preventDefault();

  const date = eventDateInput.value;
  const time = eventTimeInput.value;
  const durationMinutes = durationMinutesInput.value.trim();

  if (!date || !time || !durationMinutes) {
    showToast("Faltan datos obligatorios.");
    return;
  }

  const dateTime = new Date(`${date}T${time}`);
  if (Number.isNaN(dateTime.getTime())) {
    showToast("La fecha u hora no son válidas.");
    return;
  }

  const newEvent = {
    id: crypto.randomUUID(),
    date,
    time,
    timestamp: dateTime.toISOString(),
    durationMinutes: durationMinutes,
    triggers: triggersInput.value.trim(),
    dailyMedication: dailyMedicationInput.value.trim(),
    rescueMedication: rescueMedicationInput.value.trim(),
    symptoms: symptomsInput.value.trim(),
    notes: notesInput.value.trim()
  };

  events.push(newEvent);
  sortEvents();
  saveEvents();
  renderAll();

  eventForm.reset();
  setDefaultDateTime();

  const lastAddedIndex = events.findIndex((item) => item.id === newEvent.id);
  if (lastAddedIndex !== -1) {
    const row = document.querySelector(`[data-id="${newEvent.id}"]`);
    if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  showToast("Evento guardado.");
}

function handleDelete(id) {
  events = events.filter((event) => event.id !== id);
  saveEvents();
  renderAll();
  showToast("Evento eliminado.");
}

function handleClearAll() {
  if (!events.length) {
    showToast("No hay eventos para borrar.");
    return;
  }

  const confirmed = window.confirm(
    "Vas a borrar todos los eventos guardados en este dispositivo. ¿Seguro?"
  );

  if (!confirmed) return;

  events = [];
  saveEvents();
  renderAll();
  showToast("Se ha borrado todo el registro.");
}

function renderAll() {
  sortEvents();
  renderTable();
  renderSummary();
}

function renderTable() {
  if (!events.length) {
    eventsTableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="10">Todavía no hay eventos guardados.</td>
      </tr>
    `;
    return;
  }

  const rowsHtml = events
    .map((event, index) => {
      const previousEvent = index > 0 ? events[index - 1] : null;
      const timeFromPrevious = previousEvent
        ? diffBetweenEvents(previousEvent.timestamp, event.timestamp)
        : "Primer registro";

      return `
        <tr data-id="${event.id}">
          <td>${escapeHtml(formatDateForDisplay(event.timestamp))}</td>
          <td><span class="badge-time">${escapeHtml(timeFromPrevious)}</span></td>
          <td>${escapeHtml(event.time)}</td>
          <td>${escapeHtml(event.durationMinutes)} min</td>
          <td>${escapeHtml(event.triggers || "—")}</td>
          <td>${escapeHtml(event.dailyMedication || "—")}</td>
          <td>${escapeHtml(event.rescueMedication || "—")}</td>
          <td>${escapeHtml(event.symptoms || "—")}</td>
          <td>${escapeHtml(event.notes || "—")}</td>
          <td>
            <div class="row-actions">
              <button
                class="icon-btn delete"
                type="button"
                aria-label="Eliminar evento"
                onclick="deleteEventById('${event.id}')"
              >
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  eventsTableBody.innerHTML = rowsHtml;
}

function renderSummary() {
  totalEventsEl.textContent = String(events.length);

  if (!events.length) {
    lastEventTextEl.textContent = "—";
    timeSinceLastNowEl.textContent = "—";
    return;
  }

  const lastEvent = events[events.length - 1];
  lastEventTextEl.textContent = `${formatDateForDisplay(lastEvent.timestamp)} · ${lastEvent.time}`;
  timeSinceLastNowEl.textContent = diffFromNow(lastEvent.timestamp);
}

function updateLiveTimeSinceLast() {
  if (!events.length) return;
  const lastEvent = events[events.length - 1];
  timeSinceLastNowEl.textContent = diffFromNow(lastEvent.timestamp);
}

function downloadPdf() {
  if (!events.length) {
    showToast("No hay eventos para exportar.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4"
  });

  const now = new Date();
  const title = "Registro de ataques - Maya";
  const subtitle = `Exportado el ${formatDateForPdf(now)} a las ${formatTimeForPdf(now)}`;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, 14, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(subtitle, 14, 20);

  const bodyRows = events.map((event, index) => {
    const previousEvent = index > 0 ? events[index - 1] : null;
    const timeFromPrevious = previousEvent
      ? diffBetweenEvents(previousEvent.timestamp, event.timestamp)
      : "Primer registro";

    return [
      formatDateForDisplay(event.timestamp),
      timeFromPrevious,
      event.time,
      `${event.durationMinutes} min`,
      event.triggers || "—",
      event.dailyMedication || "—",
      event.rescueMedication || "—",
      event.symptoms || "—",
      event.notes || "—"
    ];
  });

  doc.autoTable({
    startY: 26,
    head: [[
      "Fecha",
      "Desde el último",
      "Hora",
      "Duración",
      "Desencadenantes",
      "Prevención",
      "Rescate",
      "Síntomas",
      "Observaciones"
    ]],
    body: bodyRows,
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      overflow: "linebreak",
      valign: "top"
    },
    headStyles: {
      fillColor: [124, 92, 59]
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 28 },
      2: { cellWidth: 16 },
      3: { cellWidth: 18 },
      4: { cellWidth: 34 },
      5: { cellWidth: 34 },
      6: { cellWidth: 28 },
      7: { cellWidth: 34 },
      8: { cellWidth: 45 }
    },
    margin: { left: 8, right: 8 }
  });

  doc.save(`registro-maya-${formatDateFileName(now)}.pdf`);
}

function loadEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (error) {
    console.error("Error cargando eventos:", error);
    return [];
  }
}

function saveEvents() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

function sortEvents() {
  events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

function diffBetweenEvents(previousIso, currentIso) {
  const previous = new Date(previousIso).getTime();
  const current = new Date(currentIso).getTime();
  const diffMs = current - previous;

  return humanizeDuration(diffMs);
}

function diffFromNow(lastIso) {
  const last = new Date(lastIso).getTime();
  const now = Date.now();
  const diffMs = now - last;

  if (diffMs < 0) return "0 min";
  return humanizeDuration(diffMs);
}

function humanizeDuration(milliseconds) {
  const totalMinutes = Math.floor(milliseconds / 60000);

  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts = [];

  if (days > 0) parts.push(`${days} d`);
  if (hours > 0) parts.push(`${hours} h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes} min`);

  return parts.join(" ");
}

function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTimeForInput(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatDateForDisplay(isoString) {
  const date = new Date(isoString);

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function formatDateForPdf(date) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function formatTimeForPdf(date) {
  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatDateFileName(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function showToast(message) {
  let toast = document.querySelector(".toast");

  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast._timeout);
  showToast._timeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

window.deleteEventById = handleDelete;
