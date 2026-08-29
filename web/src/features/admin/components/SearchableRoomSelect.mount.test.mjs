import { register } from "node:module";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { act } from "react";
import { mount } from "../../../test-fixtures/reactMountHarness.mjs";

// Real component-mount coverage for the Transfer Room modal's "New Room"
// searchable dropdown. The bug this guards: picking a room used to require a
// second click OUTSIDE the menu before the selection visibly settled — the
// menu stayed open and the field kept stale search text. Root cause was a
// leftover `fetchTargetBaseline(...)` call in the parent onChange (an
// undefined reference after the future-only rewrite) throwing before
// `setIsOpen(false)` could run, plus selection living on a follow-up `click`
// rather than the pointer-down. These tests exercise the real render.
register("../../../test-fixtures/jsxLoaderHooks.mjs", import.meta.url);

let SearchableRoomSelect;

before(async () => {
  ({ default: SearchableRoomSelect } = await import("./SearchableRoomSelect.jsx"));
});

const fmtMoney = (v) => (typeof v === "number" ? `PHP ${v.toLocaleString()}` : "—");

const ROOMS = [
  {
    _id: "r-802",
    name: "GP - Room 802",
    roomNumber: "802",
    type: "double-sharing",
    monthlyPrice: 13500,
    beds: [
      { _id: "b1", status: "available" },
      { _id: "b2", status: "occupied" },
    ],
  },
  {
    _id: "r-501",
    name: "GP - Room 501",
    roomNumber: "501",
    type: "single",
    monthlyPrice: 9000,
    beds: [{ _id: "b3", status: "available" }],
  },
  {
    _id: "r-900",
    name: "GP - Room 900",
    roomNumber: "900",
    type: "quadruple-sharing",
    monthlyPrice: 7000,
    beds: [{ _id: "b4", status: "occupied" }], // full — no available bed
  },
];

// Harness that mirrors how TransferTenantModal wires the select: onChange
// commits roomId + clears any stale bed. `onChangeSpy` records the calls.
function Harness({ onChangeSpy = () => {}, initialValue = "" }) {
  const [roomId, setRoomId] = React.useState(initialValue);
  const [bedId, setBedId] = React.useState("b-stale");
  return React.createElement(
    "div",
    null,
    React.createElement(SearchableRoomSelect, {
      rooms: ROOMS,
      value: roomId,
      onChange: (id) => {
        setRoomId(id);
        setBedId(""); // stale-bed reset, exactly as the modal does
        onChangeSpy(id);
      },
      fmtMoney,
      placeholder: "Search and select room...",
    }),
    React.createElement("output", { "data-testid": "roomId" }, roomId),
    React.createElement("output", { "data-testid": "bedId" }, bedId),
  );
}

const q = (c, sel) => c.querySelector(sel);
const qa = (c, sel) => [...c.querySelectorAll(sel)];
const options = (c) => qa(c, ".twm-search-select__option");
const input = (c) => q(c, "input");
const menu = (c) => q(c, ".twm-search-select__dropdown");

const openMenu = (container) => {
  act(() => {
    input(container).focus();
  });
};

const mouseDown = (el) => {
  act(() => {
    el.dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true, cancelable: true }));
  });
};

// React 19 tracks the input's value via a native setter; set through it so the
// synthetic onChange sees the update.
const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
  window.HTMLInputElement.prototype,
  "value",
).set;
const typeInto = (container, text) => {
  act(() => {
    const el = input(container);
    nativeInputValueSetter.call(el, text);
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
};

test("opening the dropdown lists the available rooms", () => {
  const { container, unmount } = mount(React.createElement(Harness));
  assert.equal(menu(container), null, "menu starts closed");
  openMenu(container);
  assert.ok(menu(container), "menu opens on focus");
  assert.equal(options(container).length, 3);
  unmount();
});

test("one pointer-down on a room commits it immediately — no outside click needed", () => {
  const calls = [];
  const { container, unmount } = mount(
    React.createElement(Harness, { onChangeSpy: (id) => calls.push(id) }),
  );
  openMenu(container);

  const room802 = options(container).find((o) => o.textContent.includes("Room 802"));
  mouseDown(room802);

  assert.deepEqual(calls, ["r-802"], "onChange fired once with the room id");
  assert.equal(q(container, '[data-testid="roomId"]').textContent, "r-802");
  unmount();
});

test("the dropdown closes immediately after selection (no outside click)", () => {
  const { container, unmount } = mount(React.createElement(Harness));
  openMenu(container);
  mouseDown(options(container).find((o) => o.textContent.includes("Room 802")));
  assert.equal(menu(container), null, "menu is closed right after the pick");
  unmount();
});

test("the input shows the selected room label, not stale partial search text", () => {
  const { container, unmount } = mount(React.createElement(Harness));
  openMenu(container);
  typeInto(container, "80"); // partial filter
  assert.equal(options(container).length, 1, "filtered to Room 802");
  mouseDown(options(container)[0]);
  assert.equal(input(container).value, "GP - Room 802 (PHP 13,500)");
  unmount();
});

test("reopening after a selection shows the FULL room list — no 'No matching rooms found'", () => {
  // Regression: after a pick, the input held the selected room's label. On
  // reopen that label was used as the filter query and matched nothing, so
  // the menu showed "No matching rooms found" and the user could not pick a
  // different room. Reopening must clear the query and list every room.
  const { container, unmount } = mount(React.createElement(Harness));
  openMenu(container);
  mouseDown(options(container).find((o) => o.textContent.includes("Room 802")));
  assert.equal(input(container).value, "GP - Room 802 (PHP 13,500)", "closed field shows the label");

  openMenu(container); // reopen
  assert.equal(input(container).value, "", "reopening clears the search text");
  assert.equal(q(container, ".twm-search-select__empty"), null, "no empty-state message");
  assert.equal(options(container).length, 3, "all rooms listed again");
  unmount();
});

test("reopening after a selection lets the user search again from scratch", () => {
  const { container, unmount } = mount(React.createElement(Harness));
  openMenu(container);
  mouseDown(options(container).find((o) => o.textContent.includes("Room 802")));
  // reopen
  openMenu(container);
  typeInto(container, "501");
  const opts = options(container);
  assert.equal(opts.length, 1);
  assert.ok(opts[0].textContent.includes("Room 501"));
  unmount();
});

test("re-picking works with a single pointer-down after a prior selection", () => {
  const calls = [];
  const { container, unmount } = mount(
    React.createElement(Harness, { onChangeSpy: (id) => calls.push(id) }),
  );
  openMenu(container);
  mouseDown(options(container).find((o) => o.textContent.includes("Room 802")));
  openMenu(container); // reopen, no typing
  // one click on a different room — must commit immediately, no outside click
  mouseDown(options(container).find((o) => o.textContent.includes("Room 501")));
  assert.deepEqual(calls, ["r-802", "r-501"]);
  assert.equal(menu(container), null, "menu closed after the re-pick");
  assert.equal(input(container).value, "GP - Room 501 (PHP 9,000)");
  unmount();
});

test("switching room A -> room B replaces the selection cleanly", () => {
  const calls = [];
  const { container, unmount } = mount(
    React.createElement(Harness, { onChangeSpy: (id) => calls.push(id) }),
  );
  openMenu(container);
  mouseDown(options(container).find((o) => o.textContent.includes("Room 802")));
  openMenu(container);
  mouseDown(options(container).find((o) => o.textContent.includes("Room 501")));

  assert.deepEqual(calls, ["r-802", "r-501"]);
  assert.equal(q(container, '[data-testid="roomId"]').textContent, "r-501");
  assert.equal(input(container).value, "GP - Room 501 (PHP 9,000)");
  unmount();
});

test("selecting a room clears the previously-set stale bed", () => {
  const { container, unmount } = mount(React.createElement(Harness));
  assert.equal(q(container, '[data-testid="bedId"]').textContent, "b-stale");
  openMenu(container);
  mouseDown(options(container).find((o) => o.textContent.includes("Room 802")));
  assert.equal(
    q(container, '[data-testid="bedId"]').textContent,
    "",
    "bed selection is reset when the room changes",
  );
  unmount();
});

test("a full room (no available bed) is NOT selectable and does not commit", () => {
  const calls = [];
  const { container, unmount } = mount(
    React.createElement(Harness, { onChangeSpy: (id) => calls.push(id) }),
  );
  openMenu(container);
  const full = options(container).find((o) => o.textContent.includes("Room 900"));
  assert.ok(full, "the full room is still listed");
  mouseDown(full);
  assert.deepEqual(calls, [], "no selection for a room with no available bed");
  assert.equal(q(container, '[data-testid="roomId"]').textContent, "");
  unmount();
});

test("an outside pointer-down with no selection simply closes the menu", () => {
  const calls = [];
  const { container, unmount } = mount(
    React.createElement(Harness, { onChangeSpy: (id) => calls.push(id) }),
  );
  openMenu(container);
  assert.ok(menu(container));
  act(() => {
    document.body.dispatchEvent(
      new window.MouseEvent("mousedown", { bubbles: true, cancelable: true }),
    );
  });
  assert.equal(menu(container), null, "menu closed");
  assert.deepEqual(calls, [], "nothing was selected");
  unmount();
});

const pressKey = (container, key) =>
  act(() => {
    input(container).dispatchEvent(
      new window.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
    );
  });

test("keyboard: Enter selects the highlighted room and closes the menu", () => {
  const calls = [];
  const { container, unmount } = mount(
    React.createElement(Harness, { onChangeSpy: (id) => calls.push(id) }),
  );
  openMenu(container); // first option is pre-highlighted
  pressKey(container, "Enter");
  assert.deepEqual(calls, ["r-802"]);
  assert.equal(menu(container), null, "menu closed after Enter select");
  unmount();
});

test("keyboard: ArrowDown moves the highlight before Enter selects", () => {
  const calls = [];
  const { container, unmount } = mount(
    React.createElement(Harness, { onChangeSpy: (id) => calls.push(id) }),
  );
  openMenu(container);
  pressKey(container, "ArrowDown"); // 0 -> 1 (Room 501)
  pressKey(container, "Enter");
  assert.deepEqual(calls, ["r-501"]);
  unmount();
});

test("keyboard: Escape closes the menu without changing the selection", () => {
  const calls = [];
  const { container, unmount } = mount(
    React.createElement(Harness, { onChangeSpy: (id) => calls.push(id) }),
  );
  openMenu(container);
  act(() => {
    input(container).dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
  });
  assert.equal(menu(container), null);
  assert.deepEqual(calls, []);
  unmount();
});

test("regression: the menu closes before onChange is invoked, so a throwing parent onChange cannot strand it open", () => {
  // The concrete old failure: the parent onChange had a leftover
  // `fetchTargetBaseline(...)` (undefined after the future-only rewrite) that
  // threw before `setIsOpen(false)` could run, leaving the menu open until an
  // outside click. commitSelection now closes FIRST; even a parent onChange
  // that throws leaves the menu closed.
  const seen = [];
  function ThrowyHarness() {
    const [roomId, setRoomId] = React.useState("");
    return React.createElement(
      "div",
      null,
      React.createElement(SearchableRoomSelect, {
        rooms: ROOMS,
        value: roomId,
        onChange: (id) => {
          setRoomId(id);
          seen.push(id);
          throw new Error("boom — simulating a leftover undefined call in the parent");
        },
        fmtMoney,
      }),
      React.createElement("output", { "data-testid": "roomId" }, roomId),
    );
  }
  const { container, unmount } = mount(React.createElement(ThrowyHarness));
  openMenu(container);
  const room802 = options(container).find((o) => o.textContent.includes("Room 802"));
  try {
    mouseDown(room802);
  } catch {
    // the parent onChange throws by design; commitSelection has already
    // closed the menu and queued the room-state update before calling it.
  }
  assert.deepEqual(seen, ["r-802"], "onChange still ran");
  assert.equal(menu(container), null, "menu closed despite the throw");
  assert.equal(q(container, '[data-testid="roomId"]').textContent, "r-802", "room state committed");
  unmount();
});
