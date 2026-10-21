// Pure helpers for editing, copying and deleting a lecturer's courses and modules.
// Kept free of React and network code so they are easy to test.

// The module setup screen works on a "setup" object; this turns a saved module into one,
// opened straight on the review step so the lecturer edits what students already see.
export function moduleToSetup(module) {
  return {
    moduleSettings: {
      unitTitle: module.unit || "",
      durationMinutes: module.durationMinutes || 45,
      pace: module.pace || "standard",
      allowLiveCode: module.allowLiveCode !== false,
    },
    rawText: "",
    fileName: "",
    draft: { unit: module.unit || "", slides: (module.slides || []).map((s) => ({ ...s })) },
    phase: "preview",
    error: "",
    editingModuleId: module.id,
    editingCreatedAt: module.createdAt || null,
  };
}

// Replace the module with the same id, or append when it is new.
export function applyModuleSave(course, moduleObj) {
  const exists = (course.modules || []).some((m) => m.id === moduleObj.id);
  return {
    ...course,
    modules: exists ? course.modules.map((m) => (m.id === moduleObj.id ? moduleObj : m)) : [...(course.modules || []), moduleObj],
  };
}

export function removeModule(course, moduleId) {
  return { ...course, modules: (course.modules || []).filter((m) => m.id !== moduleId) };
}

// A copy the lecturer can change freely without touching the original.
export function duplicateModule(module, newId, now = Date.now()) {
  return {
    ...module,
    id: newId,
    unit: `${module.unit} (copy)`.slice(0, 120),
    slides: (module.slides || []).map((s) => JSON.parse(JSON.stringify(s))),
    createdAt: now,
  };
}

// Move item i up (-1) or down (+1); returns a new array (the same one when the move is impossible).
export function moveItem(list, i, dir) {
  const j = i + dir;
  if (i < 0 || i >= list.length || j < 0 || j >= list.length) return list;
  const out = list.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

export function blankSlide() {
  return { type: "concept", title: "New slide", bullets: [""], detail: "", notes: "", hasCode: false };
}

// Deleting a whole course asks the lecturer to type its code so it can't be done by accident.
export function courseDeleteConfirmed(course, typed) {
  const code = String((course && course.code) || "").trim().toLowerCase();
  return !!code && String(typed || "").trim().toLowerCase() === code;
}

// Keep the active course valid after one is removed.
export function nextActiveCourseId(courses, removedId, currentId) {
  if (currentId && currentId !== removedId && courses.some((c) => c.id === currentId)) return currentId;
  const rest = courses.filter((c) => c.id !== removedId);
  return rest.length ? rest[0].id : null;
}
