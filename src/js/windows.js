'use strict'

/* global chrome */

export function getWindows () {
  return new Promise((resolve, reject) => {
    chrome.windows.getAll(function (windows) {
      if (chrome.runtime.lastError) {
        console.log(chrome.runtime.lastError.message)
      }
      resolve(windows)
    })
  })
}

export function getCurrentWindow () {
  return new Promise((resolve, reject) => {
    chrome.windows.getCurrent(function (currentWindow) {
      if (chrome.runtime.lastError) {
        console.log(chrome.runtime.lastError.message)
      }
      resolve(currentWindow)
    })
  })
}

export function createWindow (obj) {
  return new Promise((resolve, reject) => {
    chrome.windows.create(
      {
        height: obj.height,
        width: obj.width,
        top: obj.top,
        left: obj.left,
        state: 'normal'
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

export function setWindowSize (id, obj) {
  return new Promise((resolve, reject) => {
    chrome.windows.update(
      id,
      {
        height: obj.height,
        width: obj.width,
        top: obj.top,
        left: obj.left,
        state: 'normal'
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

export function setWindowPosition (id, obj) {
  return new Promise((resolve, reject) => {
    chrome.windows.update(
      id,
      {
        top: obj.top,
        left: obj.left,
        state: 'normal'
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

export function updateWindowState (id, state) {
  return new Promise((resolve, reject) => {
    chrome.windows.update(
      id,
      {
        state
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
