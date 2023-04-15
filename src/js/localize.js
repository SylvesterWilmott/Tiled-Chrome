'use strict'

/* global chrome */

export function localize () {
  const strings = document.querySelectorAll('[data-localize]')

  for (const s of strings) {
    s.innerText = chrome.i18n.getMessage(s.dataset.localize)
  }
}
