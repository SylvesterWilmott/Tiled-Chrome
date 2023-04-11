'use strict'

/* global chrome */

import * as windows from './js/windows.js'
import * as display from './js/display.js'
import * as storage from './js/storage.js'
import * as menu from './js/menu.js'

chrome.runtime.onInstalled.addListener(init)
chrome.runtime.onStartup.addListener(restorePreferences)
chrome.runtime.onMessage.addListener(onMessageReceived)
chrome.contextMenus.onClicked.addListener(onMenuClick)

async function init () {
  try {
    await setupContextMenu()
    await restorePreferences()
  } catch (error) {
    console.error('An error occurred:', error)
  }
}

async function setupContextMenu () {
  const menuItems = [
    {
      title: chrome.i18n.getMessage('PREFERENCES'),
      contexts: ['action'],
      id: 'h_1',
      enabled: false
    },
    {
      title: chrome.i18n.getMessage('PREF_GRID_SIZE'),
      contexts: ['action'],
      id: 'grid_size'
    },
    {
      title: chrome.i18n.getMessage('PREF_GRID_SIZE_6'),
      contexts: ['action'],
      id: '6',
      parentId: 'grid_size',
      type: 'radio'
    },
    {
      title: chrome.i18n.getMessage('PREF_GRID_SIZE_8'),
      contexts: ['action'],
      id: '8',
      parentId: 'grid_size',
      type: 'radio'
    },
    {
      title: chrome.i18n.getMessage('PREF_GRID_SIZE_9'),
      contexts: ['action'],
      id: '9',
      parentId: 'grid_size',
      type: 'radio'
    },
    {
      title: chrome.i18n.getMessage('PREF_PADDING'),
      contexts: ['action'],
      id: 'win_padding',
      checked: true,
      type: 'checkbox'
    }
  ]

  try {
    await menu.create(menuItems)
  } catch (error) {
    console.error('An error occurred:', error)
  }
}

async function onMenuClick (info) {
  const menuId = info.menuItemId

  let userPreferences

  try {
    userPreferences = await storage.load('userPreferences', { grid_size: '6', win_padding: true })
  } catch (error) {
    console.error('An error occurred:', error)
    userPreferences = { grid_size: '6', win_padding: true }
  }

  switch (menuId) {
    case '6':
    case '8':
    case '9':
      userPreferences.grid_size = menuId
      clearGhost()
      break
    case 'win_padding':
      userPreferences.win_padding = info.checked
      break
  }

  try {
    await storage.save('userPreferences', userPreferences)
  } catch (error) {
    console.error('An error occurred:', error)
  }
}

async function restorePreferences () {
  let userPreferences

  try {
    userPreferences = await storage.load('userPreferences', { grid_size: '6', win_padding: true })
  } catch (error) {
    console.error('An error occurred:', error)
    userPreferences = { grid_size: '6', win_padding: true }
  }

  for (const preference in userPreferences) {
    if (typeof userPreferences[preference] === 'boolean') {
      menu.update(preference, userPreferences[preference])
    } else {
      menu.update(userPreferences[preference], true)
    }
  }
}

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
  let existingWindows

  try {
    existingWindows = await windows.getWindows()
  } catch (error) {
    console.error('An error occurred:', error)
  }

  const currentWindow = existingWindows.find((window) => {
    return window.id === currentWindowId
  })

  const indexOfCurrent = existingWindows.findIndex((window) => {
    return window.id === currentWindowId
  })

  existingWindows.unshift(existingWindows.splice(indexOfCurrent, 1)[0])

  let connectedDisplays

  try {
    connectedDisplays = await display.getDisplayInfo()
  } catch (error) {
    console.error('An error occurred:', error)
    return
  }

  let currentDisplay

  try {
    currentDisplay = await getDisplayContainingCurrentWindow(
      connectedDisplays,
      currentWindow
    )
  } catch (error) {
    console.error('An error occurred:', error)
    return
  }

  let userPreferences = {}

  try {
    userPreferences = await storage.load('userPreferences', { grid_size: '6', win_padding: true })
  } catch (error) {
    console.error('An error occurred:', error)
    userPreferences = { grid_size: '6', win_padding: true }
  }

  const padding = userPreferences.win_padding ? 10 : 0
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
