"use strict";

/**
 * Feature 4 — Multi-Course Aggregation Dashboard.
 * Reads events through window.CourseFlow (scripts/script.js) and renders the
 * summary stats, the priority-ranked Focus list, per-course cards (which double
 * as calendar filters), and the crunch-week warning.
 *
 * @typedef {{ id: string, title: string, date: string, time?: string, type: string, course?: string, weight?: string, description?: string }} CalendarEvent
 */
(function () {
	const $ = (selector) => document.querySelector(selector);
	const app = window.CourseFlow;
	if (!app || typeof app.onChange !== "function") { console.warn("Dashboard needs window.CourseFlow.onChange from scripts/script.js."); return; }

	// Fall 2026 term window for "Semester complete". Replace with user settings later.
	const TERM_START = "2026-08-26";
	const TERM_END = "2026-12-22";
	const FOCUS_LIMIT = 5;
	const CRUNCH_MIN = 3;       // major deadlines inside one 7-day window
	const MAJOR_WEIGHT = 15;    // % of grade that makes a deadline "major"
	const TYPE_FACTOR = { exam: 1.5, project: 1.25, assignment: 1, reading: 0.6, other: 0.8 };
	const DEFAULT_WEIGHT = { exam: 20, project: 15, assignment: 5, reading: 2, other: 3 };
	const PALETTE = ["#862a2a", "#357a68", "#7656a7", "#b87916", "#2f6690", "#a8507a", "#5c7a29", "#865b2a"];
	const NO_COURSE = "Personal";

	/** @type {Map<string, string>} */
	const courseColors = new Map();
	/** @type {Set<string>} */
	const hiddenCourses = new Set();
	/** @type {CalendarEvent[]} */
	let events = [];

	/* ---------- Helpers ---------- */
	function escapeHTML(value) {
		return String(value || "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
	}
	function labelFor(type) { return type.charAt(0).toUpperCase() + type.slice(1); }
	function toISO(date) {
		const offset = date.getTimezoneOffset() * 60000;
		return new Date(date.getTime() - offset).toISOString().slice(0, 10);
	}
	function fromISO(iso) {
		const [year, month, day] = iso.split("-").map(Number);
		return new Date(year, month - 1, day);
	}
	function todayISO() { return toISO(new Date()); }
	function addDays(iso, amount) { const date = fromISO(iso); date.setDate(date.getDate() + amount); return toISO(date); }
	function daysUntil(iso) { return Math.round((fromISO(iso) - fromISO(todayISO())) / 86400000); }
	function shortDate(iso) { return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(fromISO(iso)); }

	function courseOf(event) { return (event.course || "").trim() || NO_COURSE; }
	function colorFor(course) {
		if (!courseColors.has(course)) courseColors.set(course, PALETTE[courseColors.size % PALETTE.length]);
		return courseColors.get(course);
	}
	/** @returns {number | null} the numeric percent in strings like "20%" or "20" */
	function parseWeight(weight) {
		const match = String(weight || "").match(/\d+(\.\d+)?/);
		return match ? Number(match[0]) : null;
	}
	function isMajor(event) { return event.type === "exam" || (parseWeight(event.weight) ?? 0) >= MAJOR_WEIGHT; }

	/**
	 * Higher = more urgent. Grade weight (or a per-type default when the syllabus
	 * lists none) scaled by how serious the type is, divided by days remaining.
	 */
	function priorityScore(event) {
		const weight = parseWeight(event.weight) ?? DEFAULT_WEIGHT[event.type] ?? DEFAULT_WEIGHT.other;
		const factor = TYPE_FACTOR[event.type] ?? TYPE_FACTOR.other;
		return (weight * factor) / (Math.max(0, daysUntil(event.date)) + 1);
	}
	function dueLabel(days) {
		if (days === 0) return "Due today";
		if (days === 1) return "Tomorrow";
		return `In ${days} days`;
	}
	function semesterProgress() {
		const start = fromISO(TERM_START).getTime(), end = fromISO(TERM_END).getTime();
		const pct = ((Date.now() - start) / (end - start)) * 100;
		return Math.round(Math.min(100, Math.max(0, pct)));
	}

	/* ---------- Stats ---------- */
	function renderStats(upcoming) {
		const weekEnd = addDays(todayISO(), 6);
		$("#total-count").textContent = String(upcoming.length);
		$("#week-count").textContent = String(upcoming.filter((event) => event.date <= weekEnd).length);
		$("#course-count").textContent = String(new Set(upcoming.map(courseOf)).size);
		$("#semester-progress").textContent = `${semesterProgress()}%`;
	}

	/* ---------- Focus list ---------- */
	function renderFocus(upcoming) {
		const list = $("#focus-list");
		const visible = upcoming.filter((event) => !hiddenCourses.has(courseOf(event)));
		if (!visible.length) {
			list.innerHTML = `<li class="dashboard-empty">${upcoming.length ? "Every course with upcoming work is hidden. Turn one back on to see priorities." : "Nothing upcoming. Import a syllabus or add a deadline to get started."}</li>`;
			return;
		}
		const ranked = visible
			.map((event) => ({ event, score: priorityScore(event) }))
			.sort((a, b) => b.score - a.score || a.event.date.localeCompare(b.event.date))
			.slice(0, FOCUS_LIMIT);
		const top = ranked[0].score;
		list.innerHTML = ranked.map(({ event, score }, index) => {
			const course = courseOf(event), days = daysUntil(event.date);
			const reason = [event.weight, labelFor(event.type)].filter(Boolean).map(escapeHTML).join(" · ");
			return `<li><button type="button" class="focus-item" data-id="${escapeHTML(event.id)}">
				<span class="focus-rank">${index + 1}</span>
				<span class="focus-body">
					<strong>${escapeHTML(event.title)}</strong>
					<span class="focus-meta"><span class="course-dot" style="background-color:${colorFor(course)}"></span>${escapeHTML(course)} · ${reason}</span>
					<span class="priority-bar" aria-hidden="true"><span style="width:${Math.max(8, Math.round((score / top) * 100))}%"></span></span>
				</span>
				<span class="focus-due ${days <= 2 ? "urgent" : ""}">${dueLabel(days)}</span>
			</button></li>`;
		}).join("");
	}

	/* ---------- Course cards ---------- */
	function summarizeCourses() {
		const today = todayISO();
		/** @type {Map<string, CalendarEvent[]>} */
		const groups = new Map();
		events.forEach((event) => { const course = courseOf(event); if (!groups.has(course)) groups.set(course, []); groups.get(course).push(event); });
		return [...groups].map(([course, items]) => {
			const upcoming = items.filter((event) => event.date >= today).sort((a, b) => a.date.localeCompare(b.date));
			const weighted = items.filter((event) => parseWeight(event.weight) !== null);
			const total = weighted.reduce((sum, event) => sum + parseWeight(event.weight), 0);
			const done = weighted.filter((event) => event.date < today).reduce((sum, event) => sum + parseWeight(event.weight), 0);
			return { course, color: colorFor(course), upcoming, next: upcoming[0], total, done };
		}).sort((a, b) => (a.next?.date || "9999").localeCompare(b.next?.date || "9999") || a.course.localeCompare(b.course));
	}

	function renderCourses() {
		const grid = $("#course-grid");
		const courses = summarizeCourses();
		const names = new Set(courses.map((c) => c.course));
		[...hiddenCourses].forEach((course) => { if (!names.has(course)) hiddenCourses.delete(course); });
		$("#show-all-courses").classList.toggle("hidden", hiddenCourses.size === 0);
		if (!courses.length) { grid.innerHTML = '<p class="dashboard-empty">Courses appear here once you import a syllabus.</p>'; return; }
		grid.innerHTML = courses.map(({ course, color, upcoming, next, total, done }) => {
			const hidden = hiddenCourses.has(course);
			const progress = total ? Math.round((done / total) * 100) : null;
			return `<button type="button" class="course-card ${hidden ? "is-hidden" : ""}" data-course="${escapeHTML(course)}" aria-pressed="${!hidden}" style="--course-color:${color}">
				<span class="course-card-top"><span class="course-dot"></span><strong>${escapeHTML(course)}</strong><span class="course-toggle">${hidden ? "Hidden" : "Showing"}</span></span>
				<span class="course-next">${next ? `Next: ${escapeHTML(next.title)} · ${shortDate(next.date)}` : "No upcoming deadlines"}</span>
				<span class="course-stats"><span><b>${upcoming.length}</b> left</span>${total ? `<span><b>${Math.round(total - done)}%</b> of grade ahead</span>` : ""}</span>
				${progress === null ? '<small>No grade weights listed</small>' : `<span class="course-progress" aria-hidden="true"><span style="width:${progress}%"></span></span><small>${progress}% of graded work done</small>`}
			</button>`;
		}).join("");
	}

	function applyFilter() {
		app.setFilter(hiddenCourses.size ? (event) => !hiddenCourses.has(courseOf(event)) : null);
	}

	/* ---------- Crunch warning ---------- */
	/** Finds the first 7-day window with CRUNCH_MIN or more major deadlines. */
	function findCrunch(upcoming) {
		const majors = upcoming.filter(isMajor).sort((a, b) => a.date.localeCompare(b.date));
		for (let i = 0; i < majors.length; i += 1) {
			const windowEnd = addDays(majors[i].date, 6);
			const cluster = majors.slice(i).filter((event) => event.date <= windowEnd);
			if (cluster.length >= CRUNCH_MIN) return cluster;
		}
		return null;
	}

	function renderCrunch(upcoming) {
		const banner = $("#crunch-banner");
		const cluster = findCrunch(upcoming);
		banner.classList.toggle("hidden", !cluster);
		if (!cluster) { banner.innerHTML = ""; return; }
		const courses = [...new Set(cluster.map(courseOf))];
		const first = cluster[0].date, last = cluster[cluster.length - 1].date;
		banner.innerHTML = `<span class="crunch-icon" aria-hidden="true">!</span>
			<div><strong>Crunch week ahead: ${cluster.length} major deadlines from ${shortDate(first)} to ${shortDate(last)}</strong>
			<span>${cluster.map((event) => `${escapeHTML(event.title)} (${escapeHTML(courseOf(event))})`).join(" · ")}</span>
			<small>${courses.length > 1 ? `Spread across ${courses.length} courses. ` : ""}Start early on the first one.</small></div>`;
	}

	/* ---------- Wiring ---------- */
	function renderDashboard() {
		const today = todayISO();
		const upcoming = events.filter((event) => event.date >= today);
		renderStats(upcoming); renderCrunch(upcoming); renderCourses(); renderFocus(upcoming);
	}

	$("#focus-list").addEventListener("click", (e) => {
		const item = e.target.closest(".focus-item");
		if (item) app.openEvent(item.dataset.id);
	});
	$("#course-grid").addEventListener("click", (e) => {
		const card = e.target.closest(".course-card"); if (!card) return;
		const course = card.dataset.course;
		if (hiddenCourses.has(course)) hiddenCourses.delete(course); else hiddenCourses.add(course);
		applyFilter();
	});
	$("#show-all-courses").addEventListener("click", () => { hiddenCourses.clear(); applyFilter(); });

	app.onChange((latest) => { events = latest; renderDashboard(); });
})();
