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

export function getDisplayContainingCurrentWindow (connectedDisplays, currentWindow) {
  let index = 0
  let maxCornersContained = 0

  // Get the coordinates of all four corners of the current window
  const wt = currentWindow.top
  const wl = currentWindow.left
  const wr = currentWindow.width + wl
  const wb = currentWindow.height + wt
  const corners = [
    [wt, wl],
    [wt, wr],
    [wb, wl],
    [wb, wr]
  ]

  // Iterate over the connectedDisplays array and find the display that contains the most corners of the current window
  for (const [i, display] of connectedDisplays.entries()) {
    const dt = display.bounds.top
    const dl = display.bounds.left
    const dr = display.bounds.width + dl
    const db = display.bounds.height + dt

    // Check how many corners of the current window are contained within the current display
    let cornersContained = 0
    for (const [y, x] of corners) {
      if (y >= dt && y <= db && x >= dl && x <= dr) {
        cornersContained++
      }
    }

    // Update the selected display if the current display contains more corners than the previous selection
    if (cornersContained > maxCornersContained) {
      index = i
      maxCornersContained = cornersContained
    }
  }

  return connectedDisplays[index]
}
