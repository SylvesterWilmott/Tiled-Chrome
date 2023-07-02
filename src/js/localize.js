'use strict'

/* global chrome */

export async function localize () {
  const strings = document.querySelectorAll('[data-localize]')

  if (strings) {
    for (const s of strings) {
      s.innerText = chrome.i18n.getMessage(s.dataset.localize)
    }
  }

  const accelerators = document.querySelectorAll('[data-accelerator]')
  const shortcuts = document.querySelectorAll('[data-shortcut]')
  const labelShortcuts = document.querySelectorAll('[data-labelshortcut]')
  const labels = document.querySelectorAll('[data-label]')

  const platformInfo = await getPlatformInfo().catch((error) => {
    console.error('An error occurred:', error)
  })

  if (accelerators) {
    for (const a of accelerators) {
      if (platformInfo.os === 'mac') {
        a.innerText = chrome.i18n.getMessage(`ACCELERATOR_${a.dataset.accelerator}_MAC`)
      } else {
        a.innerText = chrome.i18n.getMessage(`ACCELERATOR_${a.dataset.accelerator}`)
      }
    }
  }

  if (shortcuts) {
    for (const s of shortcuts) {
      const label = chrome.i18n.getMessage(`${s.dataset.shortcut}`)
      let shortcut

      if (platformInfo.os === 'mac') {
        shortcut = chrome.i18n.getMessage(`ACCELERATOR_${s.dataset.shortcut}_MAC`)
      } else {
        shortcut = chrome.i18n.getMessage(`ACCELERATOR_${s.dataset.shortcut}`)
      }

      s.title = `${label} (${shortcut})`
    }
  }

  if (labelShortcuts) {
    for (const ls of labelShortcuts) {
      const label = chrome.i18n.getMessage(`${ls.dataset.labelshortcut}`)
      let shortcut

      if (platformInfo.os === 'mac') {
        shortcut = chrome.i18n.getMessage(`ACCELERATOR_${ls.dataset.labelshortcut}_MAC`)
      } else {
        shortcut = chrome.i18n.getMessage(`ACCELERATOR_${ls.dataset.labelshortcut}`)
      }

      ls.innerText = `${label} (${shortcut})`
    }
  }

  if (labels) {
    for (const l of labels) {
      l.title = chrome.i18n.getMessage(`${l.dataset.label}`)
    }
  }
}

function getPlatformInfo () {
  return new Promise((resolve, reject) => {
    chrome.runtime.getPlatformInfo(function (info) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError.message)
      }
      resolve(info)
    })
  })
}
