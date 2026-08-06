import { register } from "node:module";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { act } from "react";
import { mount } from "../../test-fixtures/reactMountHarness.mjs";

// Real component-mount coverage for ProfileAvatar's image-load-failure
// fallback (PR #64 added the onError handling this exercises). The rest of
// this repo's frontend tests are pure-logic (`node --test`, no DOM), so this
// is deliberately scoped to the one behavior that can't be verified without
// an actual render: the img->initials fallback swap on a real DOM node.
register("../../test-fixtures/jsxLoaderHooks.mjs", import.meta.url);

let ProfileAvatar;

before(async () => {
  ({ default: ProfileAvatar } = await import("./ProfileAvatar.jsx"));
});

test("renders an <img> with the given src and alt when a photo url is provided", () => {
  const { container, unmount } = mount(
    React.createElement(ProfileAvatar, { src: "https://example.com/photo.jpg", alt: "Jose Cruz profile photo" }),
  );
  const img = container.querySelector("img");
  assert.ok(img, "expected an <img> element to be rendered");
  assert.equal(img.getAttribute("src"), "https://example.com/photo.jpg");
  assert.equal(img.getAttribute("alt"), "Jose Cruz profile photo");
  unmount();
});

test("falls back to the initials span, not a broken-image icon, when the image fails to load", () => {
  const { container, unmount } = mount(
    React.createElement(ProfileAvatar, { src: "https://example.com/broken.jpg", initials: "JC" }),
  );
  const img = container.querySelector("img");
  assert.ok(img, "expected an <img> element before the failure");

  act(() => {
    img.dispatchEvent(new window.Event("error"));
  });

  assert.equal(container.querySelector("img"), null, "the failed <img> must be removed, not left as a broken-image icon");
  const fallback = container.querySelector("span");
  assert.ok(fallback, "expected an initials fallback span after the image fails");
  assert.equal(fallback.textContent, "JC");
  assert.equal(fallback.getAttribute("aria-hidden"), "true");
  unmount();
});

test("re-arms and retries a new image after a previous src failed", () => {
  const { container, rerender, unmount } = mount(
    React.createElement(ProfileAvatar, { src: "https://example.com/broken.jpg", initials: "JC" }),
  );
  act(() => {
    container.querySelector("img").dispatchEvent(new window.Event("error"));
  });
  assert.equal(container.querySelector("img"), null);

  rerender(React.createElement(ProfileAvatar, { src: "https://example.com/new-photo.jpg", initials: "JC" }));

  const img = container.querySelector("img");
  assert.ok(img, "expected a fresh <img> attempt after the src prop changed");
  assert.equal(img.getAttribute("src"), "https://example.com/new-photo.jpg");
  unmount();
});

test("renders initials directly, with no <img>, when no photo url is provided at all", () => {
  const { container, unmount } = mount(
    React.createElement(ProfileAvatar, { initials: "AB" }),
  );
  assert.equal(container.querySelector("img"), null);
  const fallback = container.querySelector("span");
  assert.equal(fallback.textContent, "AB");
  unmount();
});

test("does not repeatedly retry the same failed image on unrelated re-renders (no reload loop)", () => {
  const { container, rerender, unmount } = mount(
    React.createElement(ProfileAvatar, { src: "https://example.com/broken.jpg", initials: "JC", size: 32 }),
  );
  act(() => {
    container.querySelector("img").dispatchEvent(new window.Event("error"));
  });
  assert.equal(container.querySelector("img"), null);

  // Same src, unrelated prop change (size) — must stay on the fallback,
  // not attempt to reload the already-failed image.
  rerender(React.createElement(ProfileAvatar, { src: "https://example.com/broken.jpg", initials: "JC", size: 48 }));
  assert.equal(container.querySelector("img"), null, "must not re-attempt a src that already failed");
  unmount();
});
