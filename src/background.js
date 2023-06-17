'use strict'

/* global chrome */

import * as windows from './js/windows.js'
import * as display from './js/display.js'
import * as storage from './js/storage.js'

chrome.runtime.onMessage.addListener(onMessageReceived)

function onMessageReceived (message, sender, sendResponse) {
  handleNewWindowDimensions(
    message.rectangles,
    message.gridSize,
    message.currentWindowId
  )
  sendResponse()
}

/**
*
* Handles the resizing and creation of windows based on a grid layout, given an array of selection rectangles,
* a grid size, and the id of the current window.
* @async
* @function handleNewWindowDimensions
* @param {Array} arr - An array of selection rectangles
* @param {number} gridSize - The size of the grid to use
* @param {number} currentWindowId - The id of the current window
* @returns {void}
*/
async function handleNewWindowDimensions (
  arr,
  gridSize,
  currentWindowId
) {
  const existingWindows = await windows.getWindows()
    .catch((error) => {
      console.error('An error occurred:', error)
    })

  let currentWindow
  let indexOfCurrent

  if (currentWindowId) {
    currentWindow = existingWindows.find((window) => {
      return window.id === currentWindowId
    })

    indexOfCurrent = existingWindows.findIndex((window) => {
      return window.id === currentWindowId
    })
  }

  if (indexOfCurrent !== undefined && indexOfCurrent !== -1) {
    existingWindows.unshift(existingWindows.splice(indexOfCurrent, 1)[0])
  }

  const connectedDisplays = await display.getDisplayInfo()
    .catch((error) => {
      console.error('An error occurred:', error)
    })

  const currentDisplay = await getDisplayContainingCurrentWindow(
    connectedDisplays,
    currentWindow
  )
    .catch((error) => {
      console.error('An error occurred:', error)
    })

  const storedPreferences = await storage
    .load('preferences', storage.preferenceDefaults)
    .catch((error) => {
      console.error('An error occurred:', error)
    })

  const padding = storedPreferences.win_padding.status ? 10 : 0
  const numberOfGridcells = gridSize
  const percentagePerGridCell = 100 / numberOfGridcells
  const workArea = currentDisplay.workArea
  const displayWidth = workArea.width - padding
  const displayHeight = workArea.height - padding
  const displayX = workArea.left + padding
  const displayY = workArea.top + padding
  const cellRealWidth = displayWidth * (percentagePerGridCell / 100)
  const cellRealheight = displayHeight * (percentagePerGridCell / 100)

  for (const [i, rectangle] of arr.entries()) {
    const gridWidth = rectangle.width
    const gridHeight = rectangle.height
    const gridX = rectangle.x
    const gridY = rectangle.y

    const winWidth = Math.floor(cellRealWidth * gridWidth - padding)
    const winHeight = Math.floor(cellRealheight * gridHeight - padding)
    const winX = Math.floor(cellRealWidth * gridX + displayX)
    const winY = Math.floor(cellRealheight * gridY + displayY)

    const winObj = {
      width: winWidth,
      height: winHeight,
      top: winY,
      left: winX
    }

    if (existingWindows[i]) {
      try {
        windows.setWindowSize(existingWindows[i].id, winObj)
      } catch (error) {
        console.error('An error occurred:', error)
      }
    } else {
      try {
        windows.createWindow(winObj)
      } catch (error) {
        console.error('An error occurred:', error)
      }
    }
  }
}

/**
*
* Finds the display that contains the most corners of the current window.
* @async
* @function getDisplayContainingCurrentWindow
* @param {Array<Object>} connectedDisplays - An array of objects representing the connected displays.
* @param {Object} currentWindow - An object representing the current window.
* @param {number} currentWindow.top - The top coordinate of the current window.
* @param {number} currentWindow.left - The left coordinate of the current window.
* @param {number} currentWindow.width - The width of the current window.
* @param {number} currentWindow.height - The height of the current window.
* @returns {Promise<Object>} - A Promise that resolves with the display that contains the most corners of the current window.
*/
async function getDisplayContainingCurrentWindow (
  connectedDisplays,
  currentWindow
) {
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

async function clearGhost () {
  storage.clearSession('previousSelection')
}
