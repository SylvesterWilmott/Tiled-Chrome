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
      if (platformInfo.os === 'mac') {
        s.title = chrome.i18n.getMessage(`ACCELERATOR_${s.dataset.shortcut}_MAC`)
      } else {
        s.title = chrome.i18n.getMessage(`ACCELERATOR_${s.dataset.shortcut}`)
      }
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
