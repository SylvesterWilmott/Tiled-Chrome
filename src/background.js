'use strict'

/* global chrome */

import * as windows from './js/windows.js'
import * as display from './js/display.js'
import * as storage from './js/storage.js'
import * as tabs from './js/tabs.js'

chrome.runtime.onMessage.addListener(onMessageReceived)

async function onMessageReceived (message, sender, sendResponse) {
  if (message.msg === 'layout') {
    sendResponse()
  } else {
    return
  }

  await handleNewWindowDimensions(
    message.rectangles,
    message.gridSize,
    message.currentWindowId
  ).catch((error) => {
    console.error('An error occurred:', error)
  })
}

async function handleNewWindowDimensions (arr, gridSize, currentWindowId) {
  const existingWindows = await windows.getWindows().catch((error) => {
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

  const connectedDisplays = await display.getDisplayInfo().catch((error) => {
    console.error('An error occurred:', error)
  })

  const currentDisplay = display.getDisplayContainingCurrentWindow(connectedDisplays, currentWindow)

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

  const numberOfWindowsToBeSized = arr.length
  const numberOfExistingWindows = existingWindows.length
  let n = 0

  let allTabs = []

  if (numberOfWindowsToBeSized > 1 && storedPreferences.split_tabs.status === true && currentWindow.type === 'normal') {
    allTabs = await tabs.getAll().catch((error) => {
      console.error('An error occurred:', error)
    })
  }

  console.log(allTabs)

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

    let workingWindow

    if (existingWindows[i]) {
      workingWindow = existingWindows[i]

      try {
        await windows.setWindowSize(workingWindow.id, winObj)
        n++
      } catch (error) {
        console.error('An error occurred:', error)
      }
    } else {
      try {
        const newWindow = await windows.createWindow(winObj)
        workingWindow = newWindow
      } catch (error) {
        console.error('An error occurred:', error)
      }
    }

    if (allTabs.length > 0 && typeof allTabs[i] !== 'undefined' && workingWindow.type === 'normal') {
      try {
        await tabs.move(allTabs[i].id, workingWindow.id)
        await tabs.focus(allTabs[i].id)
      } catch (error) {
        console.error('An error occurred:', error)
      }
    }
  }

  if (
    numberOfWindowsToBeSized >= 1 &&
    numberOfWindowsToBeSized < numberOfExistingWindows
  ) {
    for (const [i, existingWindow] of existingWindows.entries()) {
      if (i + 1 > n) {
        windows.updateWindowState(existingWindow.id, 'minimized')
      }
    }
  }
}
