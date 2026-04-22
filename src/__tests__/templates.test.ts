import { assert, assertEquals } from "@std/assert";
import { BUILT_IN_TEMPLATES, getTemplate } from "../lib/templates.ts";

// ---------------------------------------------------------------------------
// BUILT_IN_TEMPLATES
// ---------------------------------------------------------------------------

Deno.test("BUILT_IN_TEMPLATES has 5 templates", () => {
  assertEquals(BUILT_IN_TEMPLATES.length, 5);
});

Deno.test("each template has required fields", () => {
  for (const tmpl of BUILT_IN_TEMPLATES) {
    assert(typeof tmpl.id === "string" && tmpl.id.length > 0, `id missing`);
    assert(
      typeof tmpl.name === "string" && tmpl.name.length > 0,
      `name missing on ${tmpl.id}`,
    );
    assert(
      typeof tmpl.description === "string" && tmpl.description.length > 0,
      `description missing on ${tmpl.id}`,
    );
    assert(
      Array.isArray(tmpl.slides) && tmpl.slides.length > 0,
      `slides missing or empty on ${tmpl.id}`,
    );
  }
});

Deno.test("all template ids are unique", () => {
  const ids = BUILT_IN_TEMPLATES.map((t) => t.id);
  assertEquals(new Set(ids).size, ids.length);
});

Deno.test("each template slide has elements array and background", () => {
  for (const tmpl of BUILT_IN_TEMPLATES) {
    for (const slide of tmpl.slides) {
      assert(
        Array.isArray(slide.elements),
        `elements not an array on template ${tmpl.id}`,
      );
      assert(
        typeof slide.background === "string",
        `background not a string on template ${tmpl.id}`,
      );
    }
  }
});

Deno.test("template slide elements have valid structure", () => {
  for (const tmpl of BUILT_IN_TEMPLATES) {
    for (const slide of tmpl.slides) {
      for (const el of slide.elements) {
        assert(
          el.type === "text" || el.type === "shape" || el.type === "image",
          `invalid element type on template ${tmpl.id}`,
        );
        assert(typeof el.x === "number", `x should be number`);
        assert(typeof el.y === "number", `y should be number`);
        assert(typeof el.width === "number", `width should be number`);
        assert(typeof el.height === "number", `height should be number`);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// getTemplate
// ---------------------------------------------------------------------------

Deno.test("getTemplate returns correct template by id", () => {
  const tmpl = getTemplate("blank");
  assert(tmpl !== undefined);
  assertEquals(tmpl.id, "blank");
  assertEquals(tmpl.name, "Blank");
});

Deno.test("getTemplate returns each built-in template", () => {
  for (const expected of BUILT_IN_TEMPLATES) {
    const result = getTemplate(expected.id);
    assert(result !== undefined, `getTemplate(${expected.id}) should exist`);
    assertEquals(result.id, expected.id);
  }
});

Deno.test("getTemplate returns undefined for unknown id", () => {
  const result = getTemplate("nonexistent-template");
  assertEquals(result, undefined);
});

Deno.test("title-slide template has 2 text elements", () => {
  const tmpl = getTemplate("title-slide");
  assert(tmpl !== undefined);
  assertEquals(tmpl.slides.length, 1);
  const textEls = tmpl.slides[0].elements.filter((e) => e.type === "text");
  assertEquals(textEls.length, 2);
});

Deno.test("blank template has no elements", () => {
  const tmpl = getTemplate("blank");
  assert(tmpl !== undefined);
  assertEquals(tmpl.slides[0].elements.length, 0);
});
