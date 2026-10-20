"use strict";
import type { CalendarEvent } from "./script";

(function () {
	const $ = (selector) => document.querySelector(selector);
	const dialog = $("#import-dialog");
	if (!dialog) return;

	const TYPES: CalendarEvent["type"][] = ["assignment", "exam", "project", "reading", "other"];
	const LOW_CONFIDENCE = 0.7;
	const MAX_FILE_BYTES = 12 * 1024 * 1024;

	const state = { file: null, items: [], course: "" };

	const panes = {
		upload: $("#import-pane-upload"),
		parsing: $("#import-pane-parsing"),
		review: $("#import-pane-review")
	};
	const stepEls = [...document.querySelectorAll("#import-steps li")];
	const textArea = $("#syllabus-text");
	const fileInput = $("#syllabus-file");
	const dropzone = $("#syllabus-dropzone");
	const fileChip = $("#syllabus-file-chip");
	const errorBox = $("#import-error");
	const parseButton = $("#import-parse");
	const confirmButton = $("#import-confirm");
	const backButton = $("#import-back");
	const reviewList = $("#review-list");
	const selectAll = $("#review-select-all");
	const reviewCount = $("#review-count");

	function escapeHTML(value) {
		return String(value || "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
	}
	function labelFor(type) { return type.charAt(0).toUpperCase() + type.slice(1); }

	/* ---------- AI extraction ---------- */
	async function parseSyllabus(text, file) {
		let uploadedFile;
		if (file && !text) {
			const data = await new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onerror = () => reject(new Error("The selected file could not be read."));
				reader.onload = () => {
					if (typeof reader.result !== "string") {
						reject(new Error("The selected file could not be read."));
						return;
					}
					resolve(reader.result);
				};
				reader.readAsDataURL(file);
			});
			uploadedFile = { name: file.name, data };
		}
		const response = await fetch("/api/extract", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text, file: uploadedFile })
		});
		const result = await response.json();
		if (!response.ok) throw new Error(result.error || "Syllabus extraction failed.");
		return result;
	}

	/* ---------- Step handling ---------- */
	function showStep(name) {
		Object.entries(panes).forEach(([key, el]) => el.classList.toggle("hidden", key !== name));
		const order = ["upload", "parsing", "review"];
		const index = order.indexOf(name);
		stepEls.forEach((el, i) => {
			el.classList.toggle("active", i === index);
			el.classList.toggle("done", i < index);
		});
		parseButton.classList.toggle("hidden", name !== "upload");
		confirmButton.classList.toggle("hidden", name !== "review");
		backButton.classList.toggle("hidden", name !== "review");
	}

	function showError(message) {
		errorBox.textContent = message || "";
		errorBox.classList.toggle("visible", Boolean(message));
	}

	function resetImport() {
		state.file = null; state.items = []; state.course = "";
		textArea.value = ""; fileInput.value = "";
		renderFileChip(); showError(""); showStep("upload");
	}

	function openImport() {
		resetImport();
		dialog.showModal();
		dropzone.focus();
	}
	function closeImport() { if (dialog.open) dialog.close(); }

	/* ---------- Upload ---------- */
	function renderFileChip() {
		if (!state.file) { fileChip.classList.remove("visible"); fileChip.innerHTML = ""; return; }
		const kb = Math.max(1, Math.round(state.file.size / 1024));
		fileChip.innerHTML = `<span>📄 ${escapeHTML(state.file.name)} · ${kb} KB</span><button type="button" id="remove-file" aria-label="Remove file">Remove</button>`;
		fileChip.classList.add("visible");
		$("#remove-file").addEventListener("click", (e) => { e.stopPropagation(); state.file = null; fileInput.value = ""; renderFileChip(); });
	}

	function setFile(file) {
		if (!file) return;
		const extension = file.name.toLowerCase().split(".").pop();
		if (!["pdf", "docx", "txt", "md"].includes(extension)) {
			state.file = null;
			fileInput.value = "";
			renderFileChip();
			showError("Choose a PDF, Word (.docx), or text (.txt/.md) file. Legacy .doc files are not supported.");
			return;
		}
		if (file.size > MAX_FILE_BYTES) {
			state.file = null;
			fileInput.value = "";
			renderFileChip();
			showError("Files must be smaller than 12 MB.");
			return;
		}
		state.file = file; showError(""); renderFileChip();
		if (file.type === "text/plain" || /\.(txt|md)$/i.test(file.name)) {
			const reader = new FileReader();
			reader.onload = () => {
				textArea.value = String(reader.result || "");
				showError("");
			};
			reader.onerror = () => showError("The selected text file could not be read.");
			reader.readAsText(file);
		} else {
			textArea.value = "";
		}
	}

	dropzone.addEventListener("click", () => fileInput.click());
	dropzone.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); } });
	fileInput.addEventListener("change", () => setFile(fileInput.files[0]));
	["dragenter", "dragover"].forEach((type) => dropzone.addEventListener(type, (e) => { e.preventDefault(); dropzone.classList.add("dragging"); }));
	["dragleave", "drop"].forEach((type) => dropzone.addEventListener(type, (e) => { e.preventDefault(); dropzone.classList.remove("dragging"); }));
	dropzone.addEventListener("drop", (e) => setFile(e.dataTransfer.files[0]));

	async function startParse() {
		const text = textArea.value.trim();
		if (!text && !state.file) {
			showError("Upload a syllabus file or paste its text to continue.");
			return;
		}
		showError(""); showStep("parsing");
		try {
			const result = await parseSyllabus(text, state.file);
			state.course = result.course || "";
			state.items = (result.items || []).map((item, i) => ({ ...item, _id: `p${i}`, included: true }));
			renderReview(); showStep("review");
		} catch (error) {
			showStep("upload");
			showError(error instanceof Error ? error.message : "Syllabus extraction failed. Please try again.");
		}
	}

	function renderReview() {
		$("#import-course").value = state.course;
		if (!state.items.length) {
			reviewList.innerHTML = '<div class="import-empty">No deadlines found. Go back and try pasting the schedule section of the syllabus.</div>';
			updateCount(); return;
		}
		reviewList.innerHTML = state.items.map((item) => {
			const low = typeof item.confidence === "number" && item.confidence < LOW_CONFIDENCE;
			const type = TYPES.includes(item.type) ? item.type : "other";
			return `<div class="review-row ${type} ${item.included ? "" : "excluded"}" data-id="${item._id}">
				<input type="checkbox" ${item.included ? "checked" : ""} data-field="included" aria-label="Include ${escapeHTML(item.title)}" />
				<input type="text" value="${escapeHTML(item.title)}" data-field="title" aria-label="Title" />
				<input type="date" value="${escapeHTML(item.date)}" data-field="date" class="field-date" aria-label="Date" />
				<select data-field="type" class="field-type" aria-label="Type">${TYPES.map((t) => `<option value="${t}" ${t === type ? "selected" : ""}>${labelFor(t)}</option>`).join("")}</select>
				<div class="source">${item.source ? `<q>${escapeHTML(item.source)}</q>` : ""}${low ? '<span class="confidence low">Double-check</span>' : ""}${item.weight ? `<span class="confidence">${escapeHTML(item.weight)}</span>` : ""}</div>
			</div>`;
		}).join("");
		updateCount();
	}

	function updateCount() {
		const included = state.items.filter((item) => item.included).length;
		reviewCount.textContent = `${included} of ${state.items.length} selected`;
		confirmButton.textContent = included ? `Add ${included} to calendar` : "Add to calendar";
		confirmButton.disabled = included === 0;
		selectAll.checked = state.items.length > 0 && included === state.items.length;
	}

	reviewList.addEventListener("input", (e) => {
		const row = e.target.closest(".review-row"); if (!row) return;
		const item = state.items.find((x) => x._id === row.dataset.id); if (!item) return;
		const field = e.target.dataset.field;
		if (field === "included") { item.included = e.target.checked; row.classList.toggle("excluded", !item.included); }
		else if (field) { item[field] = e.target.value; }
		if (field === "type") { TYPES.forEach((t) => row.classList.remove(t)); row.classList.add(item.type); }
		updateCount();
	});
	selectAll.addEventListener("change", () => {
		state.items.forEach((item) => { item.included = selectAll.checked; });
		renderReview();
	});

	function confirmImport() {
		const course = $("#import-course").value.trim();
		const chosen = state.items.filter((item) => item.included);
		const invalid = chosen.find((item) => !item.title.trim() || !item.date);
		if (invalid) { showError("Every selected item needs a title and a date."); return; }
		const events = chosen.map((item, i) => ({
			id: `imp${Date.now()}${i}`,
			title: item.title.trim(),
			date: item.date,
			time: item.time || "",
			type: item.type,
			course,
			weight: item.weight || "",
			description: item.source || item.description || ""
		}));
		if (window.CourseFlow && typeof window.CourseFlow.addEvents === "function") window.CourseFlow.addEvents(events);
		else console.warn("window.CourseFlow.addEvents is missing — see integration notes.");
		closeImport();
	}

	/* ---------- Wiring ---------- */
	$("#import-syllabus").addEventListener("click", openImport);
	$("#import-parse").addEventListener("click", startParse);
	$("#import-back").addEventListener("click", () => { showError(""); showStep("upload"); });
	$("#import-confirm").addEventListener("click", confirmImport);
	$("#import-cancel").addEventListener("click", closeImport);
	$("#import-close").addEventListener("click", closeImport);
})();
