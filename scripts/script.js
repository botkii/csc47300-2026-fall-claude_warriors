"use strict";
const $ = (selector) => document.querySelector(selector);
const calendarGrid = $("#calendar-grid");
const agendaView = $("#agenda-view");
const calendarView = $("#calendar-view");
const monthTitle = $("#month-title");
const dialog = $("#event-dialog");
const form = $("#event-form");
let currentDate = new Date();
currentDate.setDate(1);
// Set by other features (e.g. the dashboard's course filter) through window.CourseFlow.
let eventFilter = () => true;
const changeListeners = [];

function toISO(date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}
function fromISO(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}
function shiftDay(amount) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + amount);
  return toISO(date);
}
function escapeHTML(value) {
  return String(value || "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}
function labelFor(type) { return type.charAt(0).toUpperCase() + type.slice(1); }

let events = [
  { id: "e1", title: "Reading: Human-centered design", date: shiftDay(1), time: "09:00", type: "reading", course: "CSC 47300", description: "Read chapters 4–5 before studio." },
  { id: "e2", title: "Interface critique", date: shiftDay(3), time: "14:30", type: "assignment", course: "CSC 47300", weight: "10%", description: "Bring your latest responsive prototype." },
  { id: "e3", title: "Algorithms midterm", date: shiftDay(5), time: "10:00", type: "exam", course: "CSC 31100", weight: "25%", description: "Covers graphs, trees, and dynamic programming." },
  { id: "e4", title: "Portfolio case study", date: shiftDay(9), time: "23:59", type: "project", course: "CSC 47300", weight: "20%", description: "Publish the first complete case study." },
  { id: "e5", title: "Reading: Accessibility patterns", date: shiftDay(13), type: "reading", course: "CSC 47300", description: "Review WCAG patterns and take notes." },
  { id: "e6", title: "Data structures problem set", date: shiftDay(18), time: "23:59", type: "assignment", course: "CSC 21200", weight: "8%", description: "Submit through Blackboard." },
  { id: "e7", title: "Final project milestone", date: shiftDay(26), time: "17:00", type: "project", course: "CSC 47300", weight: "30%", description: "Present the working alpha to the class." },
  { id: "e8", title: "Linear algebra exam 2", date: shiftDay(6), time: "10:00", type: "exam", course: "MATH 34600", weight: "20%", description: "Eigenvalues, diagonalization, and inner products." },
  { id: "e9", title: "Lab 5: Pipelining", date: shiftDay(2), time: "23:59", type: "assignment", course: "CSC 34200", weight: "5%", description: "Submit the timing diagrams." },
  { id: "e10", title: "Problem set 6", date: shiftDay(11), time: "23:59", type: "assignment", course: "MATH 34600", weight: "6%" },
  { id: "e11", title: "Cache simulator project", date: shiftDay(16), time: "23:59", type: "project", course: "CSC 34200", weight: "25%", description: "Direct-mapped and set-associative modes." },
  { id: "e12", title: "Reading: Memory hierarchy", date: shiftDay(8), type: "reading", course: "CSC 34200", description: "Chapter 7." },
  { id: "e13", title: "Algorithms homework 5", date: shiftDay(12), time: "23:59", type: "assignment", course: "CSC 31100", weight: "7%" },
  { id: "e14", title: "Algorithms final exam", date: shiftDay(40), time: "09:00", type: "exam", course: "CSC 31100", weight: "35%" },
  { id: "e15", title: "Algorithms homework 3", date: shiftDay(-10), time: "23:59", type: "assignment", course: "CSC 31100", weight: "7%" },
  { id: "e16", title: "Linear algebra exam 1", date: shiftDay(-20), time: "10:00", type: "exam", course: "MATH 34600", weight: "20%" },
  { id: "e17", title: "Usability study report", date: shiftDay(-7), time: "23:59", type: "project", course: "CSC 47300", weight: "15%" }
];

function visibleEvents() { return events.filter((event) => eventFilter(event)); }
function render() {
  renderCalendar(); renderAgenda(); renderUpcoming();
  changeListeners.forEach((listener) => listener(events.slice()));
}
function renderCalendar() {
  const year = currentDate.getFullYear(), month = currentDate.getMonth();
  monthTitle.textContent = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(currentDate);
  const first = new Date(year, month, 1), start = new Date(year, month, 1 - first.getDay());
  const today = toISO(new Date());
  calendarGrid.innerHTML = "";
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(start); date.setDate(start.getDate() + index);
    const iso = toISO(date), dayEvents = visibleEvents().filter((event) => event.date === iso).sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
    const cell = document.createElement("div");
    cell.className = `day ${date.getMonth() !== month ? "other-month" : ""} ${iso === today ? "today" : ""}`;
    cell.innerHTML = `<span class="day-number">${date.getDate()}</span>`;
    dayEvents.slice(0, 3).forEach((event) => {
      const button = document.createElement("button"); button.className = `event-chip ${event.type}`; button.textContent = event.title; button.title = event.title;
      button.addEventListener("click", () => openEditor(event)); cell.appendChild(button);
    });
    if (dayEvents.length > 3) { const more = document.createElement("button"); more.className = "event-chip"; more.textContent = `+${dayEvents.length - 3} more`; more.addEventListener("click", () => openEditor(null, iso)); cell.appendChild(more); }
    cell.addEventListener("dblclick", () => openEditor(null, iso)); calendarGrid.appendChild(cell);
  }
}
function renderAgenda() {
  const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
  const monthly = visibleEvents().filter((event) => event.date.startsWith(monthKey)).sort((a, b) => `${a.date}${a.time || ""}`.localeCompare(`${b.date}${b.time || ""}`));
  if (!monthly.length) { agendaView.innerHTML = '<p class="hero-copy">No deadlines this month. Take a breath, then add your next milestone.</p>'; return; }
  const groups = monthly.reduce((all, event) => { (all[event.date] ||= []).push(event); return all; }, {});
  agendaView.innerHTML = Object.entries(groups).map(([date, items]) => `<div class="agenda-group"><div class="agenda-date">${new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(fromISO(date))}</div><div>${items.map((event) => `<div class="agenda-item ${event.type}" data-id="${event.id}"><strong>${escapeHTML(event.title)}</strong><span>${escapeHTML(event.time || "All day")} · ${escapeHTML(event.course || labelFor(event.type))}</span></div>`).join("")}</div></div>`).join("");
  agendaView.querySelectorAll("[data-id]").forEach((item) => item.addEventListener("click", () => openEditor(events.find((event) => event.id === item.dataset.id))));
}
function renderUpcoming() {
  const today = toISO(new Date());
  const next = visibleEvents().filter((event) => event.date >= today).sort((a, b) => `${a.date}${a.time || ""}`.localeCompare(`${b.date}${b.time || ""}`)).slice(0, 4);
  $("#upcoming-list").innerHTML = next.length ? next.map((event) => { const date = fromISO(event.date); return `<article class="upcoming-item" data-id="${event.id}"><div class="upcoming-date">${new Intl.DateTimeFormat("en-US", { month: "short" }).format(date)}<strong>${date.getDate()}</strong></div><div><h3>${escapeHTML(event.title)}</h3><p>${escapeHTML(event.course || "Personal schedule")} · ${escapeHTML(event.time || "All day")}</p><span class="type-tag">${labelFor(event.type)}</span></div></article>`; }).join("") : '<p class="hero-copy">Nothing is scheduled yet.</p>';
  $("#upcoming-list").querySelectorAll("[data-id]").forEach((item) => item.addEventListener("click", () => openEditor(events.find((event) => event.id === item.dataset.id))));
}
function openEditor(event, selectedDate) {
  form.reset(); $("#event-id").value = event?.id || ""; $("#event-title").value = event?.title || ""; $("#event-date").value = event?.date || selectedDate || toISO(new Date());
  $("#event-time").value = event?.time || ""; $("#event-type").value = event?.type || "assignment"; $("#event-course").value = event?.course || ""; $("#event-weight").value = event?.weight || ""; $("#event-description").value = event?.description || "";
  $("#dialog-kicker").textContent = event ? "EDIT DEADLINE" : "NEW DEADLINE"; $("#dialog-title").textContent = event ? "Refine your plan" : "Add to your calendar"; $("#delete-event").classList.toggle("hidden", !event); dialog.showModal(); $("#event-title").focus();
}
function closeEditor() { if (dialog.open) dialog.close(); }

$("#add-event").addEventListener("click", () => openEditor());
$("#prev-month").addEventListener("click", () => { currentDate.setMonth(currentDate.getMonth() - 1); render(); });
$("#next-month").addEventListener("click", () => { currentDate.setMonth(currentDate.getMonth() + 1); render(); });
$("#today").addEventListener("click", () => { currentDate = new Date(); currentDate.setDate(1); render(); });
$("#cancel-event").addEventListener("click", closeEditor);
$("#delete-event").addEventListener("click", () => { const id = $("#event-id").value; events = events.filter((event) => event.id !== id); closeEditor(); render(); });
form.addEventListener("submit", (event) => { event.preventDefault(); if (!form.reportValidity()) return; const id = $("#event-id").value; const deadline = { id: id || `e${Date.now()}`, title: $("#event-title").value.trim(), date: $("#event-date").value, time: $("#event-time").value, type: $("#event-type").value, course: $("#event-course").value.trim(), weight: $("#event-weight").value.trim(), description: $("#event-description").value.trim() }; if (id) events = events.map((item) => item.id === id ? deadline : item); else events.push(deadline); currentDate = fromISO(deadline.date); currentDate.setDate(1); closeEditor(); render(); });
document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => { document.querySelectorAll("[data-view]").forEach((tab) => { const selected = tab === button; tab.classList.toggle("active", selected); tab.setAttribute("aria-selected", String(selected)); }); const agenda = button.dataset.view === "agenda"; agendaView.classList.toggle("hidden", !agenda); calendarView.classList.toggle("hidden", agenda); }));
render();

window.CourseFlow = {
  addEvents(newEvents) {
    events.push(...newEvents);
    const first = newEvents.map((e) => e.date).sort()[0];
    if (first) { currentDate = fromISO(first); currentDate.setDate(1); }
    render();
  },
  getEvents() { return events.slice(); },
  onChange(listener) { changeListeners.push(listener); listener(events.slice()); },
  setFilter(predicate) { eventFilter = predicate || (() => true); render(); },
  openEvent(id) { const event = events.find((item) => item.id === id); if (event) openEditor(event); }
};