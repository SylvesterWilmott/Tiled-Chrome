'use strict'

/* global chrome */

export function create (path) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create(
      {
        active: true,
        url: path
      },
      function () {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError.message)
        }
        resolve()
      }
    )
  })
}
