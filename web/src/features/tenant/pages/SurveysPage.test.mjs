import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./SurveysPage.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./SurveysPage.css", import.meta.url), "utf8");

test("tenant surveys load only assigned records through tenant-safe API", () => {
  assert.match(source, /surveyApi\.listMine\(\)/);
  assert.match(source, /surveyApi\.getMine\(id\)/);
  assert.match(source, /apiData\(await surveyApi\.listMine\(\)\)/);
  assert.match(source, /apiData\(await surveyApi\.getMine\(id\)\)/);
});

test("survey form supports draft and duplicate-safe submission states", () => {
  assert.match(source, /surveyApi\.saveDraft/);
  assert.match(source, /surveyApi\.submit/);
  assert.match(source, /disabled=\{busy\}/);
});

test("tenant page does not render direct identity or anonymous response metadata", () => {
  assert.doesNotMatch(source, /tenantId|email|phone|roomId|bedId/);
});

test("tenant questions use accessible survey controls rather than select-only rendering", () => {
  assert.match(source, /className="tenant-survey-scale"/);
  assert.match(source, /className="tenant-survey-nps"/);
  assert.match(source, /className="tenant-survey-choices"/);
  assert.match(source, /type="radio"/);
  assert.match(source, /type="checkbox"/);
  assert.match(source, /<textarea/);
  assert.match(styles, /\.tenant-survey-scale label\.is-selected/);
  assert.match(styles, /:focus-within/);
});
