'use strict'

/* global chrome */

export function getAll () {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ currentWindow: true }, function (tabs) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError.message)
      }
      resolve(tabs)
    })
  })
}

export function move (tabId, windowId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.move(tabId, { windowId, index: -1 }, function (tabs) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError.message)
      }
      resolve(tabs)
    })
  })
}

export function focus (tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.update(tabId, { active: true }, function () {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError.message)
      }
      resolve()
    })
  })
}
