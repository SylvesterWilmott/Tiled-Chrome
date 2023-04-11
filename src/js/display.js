'use strict'

/* global chrome */

export function getDisplayInfo () {
  return new Promise((resolve, reject) => {
    chrome.system.display.getInfo(function (value) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError.message)
      }
      resolve(value)
    })
  })
}
