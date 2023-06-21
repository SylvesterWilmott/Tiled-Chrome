"use strict";

// TODO
// Save padding status with saved objects
// Add feedback when layout saved
// Promp when deleting layout
// Make responsive grid
// Run standard.js
// Combine listeners in new js file

// New options
// Orientation -- set it when page loads according to display it's loaded on

// Do translations

/* global chrome, Audio */

import * as navigation from "./navigation.js";
import * as windows from "./windows.js";
import * as message from "./message.js";
import * as storage from "./storage.js";
import * as i18n from "./localize.js";
import * as tabs from './tabs.js'

document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    try {
      await Promise.all([
        i18n.localize(),
        renderSavedLayouts(),
      ]);
    } catch (error) {
      console.error("An error occurred:", error);
    }
  } catch (error) {
    console.error("An error occurred:", error);
  }

  registerListeners();
  navigation.init();
}

async function renderSavedLayouts() {
  const storedLayouts = await storage.load("layouts", []).catch((error) => {
    console.error("An error occurred:", error);
  });

  if (storedLayouts.length === 0) {
    return;
  }

  for (const layout of storedLayouts) {
    renderLayoutItem(layout);
  }
}

function registerListeners() {
  const on = (target, event, handler) => {
    if (typeof target === "string") {
      document.getElementById(target).addEventListener(event, handler, false);
    } else {
      target.addEventListener(event, handler, false);
    }
  };

  const onAll = (target, event, handler) => {
    const elements = document.querySelectorAll(target);

    for (const el of elements) {
      el.addEventListener(event, handler, false);
    }
  };

  on("savedLayouts", "click", onSavedLayoutClicked);
  on("newLayout", "click", onNewLayoutClicked);
}

async function renderLayoutItem(layout) {
  // Get the parent element
  const savedLayoutsElement = document.getElementById("savedLayouts");

  // create a new item
  const pathToPredefinedHtml = chrome.runtime.getURL("../html/fragment.html");

  const response = await fetch(pathToPredefinedHtml).catch((error) => {
    console.error("An error occurred:", error);
  });

  const html = await response.text().catch((error) => {
    console.error("An error occurred:", error);
  });

  const fragment = document.createRange().createContextualFragment(html);

  const itemElement = fragment.querySelector(".item");
  itemElement.dataset.id = layout.id;

  const labelElement = fragment.querySelector(".label");
  labelElement.innerText = layout.name;

  savedLayoutsElement.appendChild(fragment);
}

async function onSavedLayoutClicked(e) {
  const target = e.target;

  if (target.classList.contains("item")) {
    const itemId = target.dataset.id;

    // find the object from storage
    const storedLayouts = await storage.load("layouts", []).catch((error) => {
      console.error("An error occurred:", error);
    });

    const foundObjIndex = storedLayouts.findIndex((obj) => obj.id === itemId);

    if (foundObjIndex === -1) {
      return;
    }

    const foundObj = storedLayouts[foundObjIndex];

    const currentWindow = await windows.getCurrentWindow().catch((error) => {
      console.error("An error occurred:", error);
    });

    try {
      await message.send({
        rectangles: foundObj.layout,
        gridSize: foundObj.gridSize,
        currentWindowId: currentWindow.id,
      });
    } catch (error) {
      console.error("An error occurred:", error);
    }
  } else if (target.classList.contains("delete")) {
    const itemElement = target.closest(".item");

    if (!itemElement) {
      return;
    }

    const itemId = itemElement.dataset.id;

    const storedLayouts = await storage.load("layouts", []).catch((error) => {
      console.error("An error occurred:", error);
    });

    const foundObjIndex = storedLayouts.findIndex((obj) => obj.id === itemId);

    if (foundObjIndex === -1) {
      return;
    }

    // Remove from storage and resave
    storedLayouts.splice(foundObjIndex, 1);

    await storage.save("layouts", storedLayouts).catch((error) => {
      console.error("An error occurred:", error);
    });

    // Remove closest parent element with class 'item' from DOM
    itemElement.remove();

    const parentElement = document.getElementById("savedLayouts");
    parentElement.innerHTML = parentElement.innerHTML.trim();
  }
}

async function onNewLayoutClicked() {
  const pathToNewLayoutPage = chrome.runtime.getURL("../html/new-layout.html");
  await tabs.create(pathToNewLayoutPage)
}