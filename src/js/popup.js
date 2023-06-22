'use strict'

// Todo
// show saved layout on grid when selected
// Add select to nav-index
// Run standard.js

/* global chrome, Audio */

import * as navigation from './navigation.js'
import * as windows from './windows.js'
import * as message from './message.js'
import * as storage from './storage.js'
import * as i18n from './localize.js'
import * as uid from './uid.js'

document.addEventListener('DOMContentLoaded', init)

async function init () {
  try {
    await Promise.all([
      restorePreferences(),
      buildGrid(),
      renderSavedLayouts(),
      i18n.localize()
    ])
  } catch (error) {
    console.error('An error occurred:', error)
  }

  setupGrid()
  registerListeners()
  navigation.init()
  ready()
}

function ready () {
  postponeAnimationUntilReady()
}

function postponeAnimationUntilReady () {
  const animatedElements = document.querySelectorAll('.no-transition')

  for (const el of animatedElements) {
    const pseudoBefore = window.getComputedStyle(el, ':before').content
    const pseudoAfter = window.getComputedStyle(el, ':after').content
    const hasBeforeContent = pseudoBefore !== 'none' && pseudoBefore !== ''
    const hasAfterContent = pseudoAfter !== 'none' && pseudoAfter !== ''

    if (hasBeforeContent || hasAfterContent) {
      el.addEventListener(
        'transitionend',
        function () {
          el.classList.remove('no-transition')
        },
        { once: true }
      )
    }

    el.classList.remove('no-transition')
  }
}

async function renderSavedLayouts () {
  const storedLayouts = await storage.load('layouts', []).catch((error) => {
    console.error('An error occurred:', error)
  })

  if (storedLayouts.length > 0) {
    for (const layout of storedLayouts) {
      renderLayoutItem(layout)
    }
  }
}

async function restorePreferences () {
  const storedPreferences = await storage
    .load('preferences', storage.preferenceDefaults)
    .catch((error) => {
      console.error('An error occurred:', error)
    })

  for (const preferenceName in storedPreferences) {
    const preferenceObj = storedPreferences[preferenceName]

    if (preferenceObj.type === 'checkbox') {
      const preferenceElement = document.getElementById(preferenceName)

      if (preferenceElement) {
        preferenceElement.checked = preferenceObj.status
      }
    } else if (preferenceObj.type === 'select') {
      const preferenceElement = document.getElementById(preferenceName)

      if (preferenceElement) {
        // Add options to select element
        for (const option of preferenceObj.options) {
          const optionElement = document.createElement('option')

          optionElement.value = option
          optionElement.text = `${option} x ${option}`

          preferenceElement.appendChild(optionElement)
        }

        // Select option
        preferenceElement.value = preferenceObj.status
      }
    }
  }
}

async function buildGrid () {
  const storedPreferences = await storage
    .load('preferences', storage.preferenceDefaults)
    .catch((error) => {
      console.error('An error occurred:', error)
    })

  const gridSize = parseInt(storedPreferences.grid_size.status)
  const table = document.getElementById('grid')

  table.innerHTML = ''

  for (let i = 0; i < gridSize; i++) {
    const row = document.createElement('tr')
    for (let j = 0; j < gridSize; j++) {
      const cell = document.createElement('td')
      cell.classList.add('cell')
      row.appendChild(cell)
    }
    table.appendChild(row)
  }
}

function setupGrid () {
  const table = document.getElementById('grid')

  const maxrextangles = 10
  const rectanglesDrawn = []

  let ghostCount = 0
  let startCell
  let endCell
  let isDragging = false

  const on = (target, event, handler) => {
    if (typeof target === 'string') {
      document.getElementById(target).addEventListener(event, handler, false)
    } else {
      target.addEventListener(event, handler, false)
    }
  }

  const onAll = (target, event, handler) => {
    const elements = document.querySelectorAll(target)

    for (const el of elements) {
      el.addEventListener(event, handler, false)
    }
  }

  onAll('select', 'change', onSelectChanged)
  on('grid', 'mousedown', onTableMousedown)
  on('grid', 'mousemove', onTableMousemove)
  on(document, 'mouseup', onDocumentMouseup)
  on(document, 'keydown', onDocumentKeydown)
  onAll('div.nav-index', 'click', onActionClicked)

  const allCells = document.querySelectorAll('.cell')

  for (const cell of allCells) {
    cell.addEventListener('mouseenter', onCellMouseenter)
  }

  function onActionClicked(e) {
    const target = e.target
    const targetId = target.id

    if (targetId === 'apply') {
      applyLayout()
    } else if (targetId === 'undo') {
      undo()
    } else if (targetId === 'save') {
      saveLayout()
    } else if (targetId === 'clear') {
      clearAllSelections()
    }
  }

  async function onSelectChanged (e) {
    const target = e.target
    const targetId = target.id

    const storedPreferences = await storage
      .load('preferences', storage.preferenceDefaults)
      .catch((error) => {
        console.error('An error occurred:', error)
        target.checked = !target.checked
      })

    const preference = storedPreferences[targetId]

    if (!preference) {
      return
    }

    preference.status = target.value

    try {
      await storage.save('preferences', storedPreferences)
    } catch (error) {
      console.error('An error occurred:', error)
    }

    if (target.id === 'grid_size') {
      try {
        await buildGrid()
        clearAllSelections()
      } catch (error) {
        console.error('An error occurred:', error)
      }
    }
  }

  function clearAllSelections () {
    const numberOfRectangles = rectanglesDrawn.length

    if (numberOfRectangles === 0) {
      playSound('error')
      return
    }

    for (let i = 0; i < numberOfRectangles; i++) {
      removePreviousSelection()
    }
  }

  // This is required for resizing cells once dragging begins
  function onCellMouseenter (e) {
    if (!isDragging || e.buttons !== 1) return
    removeAllSelections()
  }

  function onTableMousedown (e) {
    if (e.buttons !== 1 || rectanglesDrawn.length >= maxrextangles) return

    removeAllSelections()

    if (e.target.classList.contains('cell')) {
      startCell = e.target
      endCell = e.target
      isDragging = true
    }
  }

  function onTableMousemove (e) {
    if (!isDragging) return

    // If the mouse is over a cell, set the endCell variable to that cell
    if (e.target.classList.contains('cell')) endCell = e.target

    // Get the row and column indices of the start and end cells
    const startRow = startCell.parentElement.rowIndex
    const startCol = startCell.cellIndex
    const endRow = endCell.parentElement.rowIndex
    const endCol = endCell.cellIndex

    // Loop through all rows between the start and end rows
    for (const row of Array.from(table.rows).slice(
      Math.min(startRow, endRow),
      Math.max(startRow, endRow) + 1
    )) {
      // Loop through all cells between the start and end columns for the current row
      for (const cell of Array.from(row.cells).slice(
        Math.min(startCol, endCol),
        Math.max(startCol, endCol) + 1
      )) {
        cell.classList.add('highlight')
      }
    }
  }

  function removeAllSelections () {
    const cells = document.querySelectorAll('.cell')

    for (const cell of cells) {
      cell.classList.remove('highlight')
    }
  }

  function removePreviousSelection () {
    const selection = rectanglesDrawn[rectanglesDrawn.length - 1]
    clearGhost(selection, ghostCount)
    ghostCount--
    rectanglesDrawn.pop()
  }

  function transformSelectionToGhost () {
    ghostCount++

    const cells = document.querySelectorAll('.highlight')

    for (const cell of cells) {
      cell.classList.remove('highlight')
      cell.classList.add('ghost_' + ghostCount)
    }

    const finalSelection = document.querySelectorAll('.ghost_' + ghostCount)
    const boundingBox = getBoundingBox(finalSelection)

    createRectangle(boundingBox, ghostCount)
  }

  function createRectangle (boundingBox, number) {
    const rectangle = document.createElement('div')
    const rectangleInner = document.createElement('div')
    const stage = document.getElementById('stage')

    rectangle.style.left = `${boundingBox.left}px`
    rectangle.style.top = `${boundingBox.top}px`
    rectangle.style.width = `${boundingBox.right - boundingBox.left}px`
    rectangle.style.height = `${boundingBox.bottom - boundingBox.top}px`
    rectangle.style.zIndex = number + 10
    rectangle.classList.add('rect_' + number)

    rectangle.prepend(rectangleInner)
    stage.prepend(rectangle)
  }

  async function applyLayout () {
    if (!rectanglesDrawn.length) {
      playSound('error')
      return
    }

    const gridSize = table.rows[0].cells.length

    const currentWindow = await windows.getCurrentWindow().catch((error) => {
      console.error('An error occurred:', error)
    })

    const storedPreferences = await storage
      .load('preferences', storage.preferenceDefaults)
      .catch((error) => {
        console.error('An error occurred:', error)
      })

    try {
      await message.send({
        rectangles: rectanglesDrawn,
        gridSize,
        currentWindowId: currentWindow.id,
        padding: storedPreferences.win_padding.status
      })
    } catch (error) {
      console.error('An error occurred:', error)
    }

    clearAllSelections()
  }

  function undo () {
    if (!rectanglesDrawn.length) {
      playSound('error')
      return
    }

    removePreviousSelection()
  }

  async function saveLayout () {
    if (!rectanglesDrawn.length) {
      playSound('error')
      return
    }

    const maxLayoutsAllowed = 50

    const storedLayouts = await storage.load('layouts', []).catch((error) => {
      console.error('An error occurred:', error)
    })

    if (storedLayouts.length >= maxLayoutsAllowed) {
      playSound('error')
      window.alert(chrome.i18n.getMessage('MAXIMUM_SAVED_ALERT'))
      return
    }

    // Prompt for a name
    const name = window.prompt(chrome.i18n.getMessage('TITLE_PROMPT'))

    if (name === null) {
      return
    }

    const gridSize = table.rows[0].cells.length

    const storedPreferences = await storage
      .load('preferences', storage.preferenceDefaults)
      .catch((error) => {
        console.error('An error occurred:', error)
      })

    const layoutObj = {
      name,
      id: uid.create(),
      layout: rectanglesDrawn,
      gridSize,
      padding: storedPreferences.win_padding.status
    }

    storedLayouts.push(layoutObj)

    try {
      await storage.save('layouts', storedLayouts)
    } catch (error) {
      console.error('An error occurred:', error)
    }

    clearAllSelections()
    renderLayoutItem(layoutObj)
  }

  async function onDocumentMouseup () {
    const highlight = document.querySelectorAll('.highlight')

    if (!highlight.length || !startCell || !endCell) {
      removeAllSelections()
      isDragging = false
      return
    }

    // Calculate the start and end row and column indices
    const startRow = startCell.parentElement.rowIndex
    const startCol = startCell.cellIndex
    const endRow = endCell.parentElement.rowIndex
    const endCol = endCell.cellIndex

    // Calculate the width and height of the selection
    const width = Math.abs(endCol - startCol) + 1
    const height = Math.abs(endRow - startRow) + 1

    // Calculate the x and y positions of the selection
    const x = Math.min(startCol, endCol)
    const y = Math.min(startRow, endRow)

    const selectionObject = {
      width,
      height,
      x,
      y
    }

    isDragging = false

    rectanglesDrawn.push(selectionObject)

    transformSelectionToGhost()
    startCell = null
    endCell = null
  }

  function onDocumentKeydown (e) {
    if (e.key === 'Escape') {
      if (isDragging) {
        e.preventDefault()
        isDragging = false
        startCell = null
        endCell = null
        removeAllSelections()
      }
    }
  }

  function clearGhost (selection, number) {
    const table = document.getElementById('grid')

    // Loop over the cells within the selection
    for (const row of Array.from(table.rows).slice(
      selection.y,
      selection.y + selection.height
    )) {
      for (const cell of Array.from(row.cells).slice(
        selection.x,
        selection.x + selection.width
      )) {
        cell.classList.remove('ghost_' + number) // Remove the "ghost" class from each cell
      }
    }

    // Remove rect from DOM
    const rectangle = document.querySelector('.rect_' + number)
    rectangle.remove()
  }

  function getBoundingBox (elements) {
    if (elements.length === 0) {
      return null
    }

    const parentContainer = document.getElementById('stage')
    const parentRect = parentContainer.getBoundingClientRect()
    let left = Infinity
    let top = Infinity
    let right = -Infinity
    let bottom = -Infinity

    for (const element of elements) {
      const rect = element.getBoundingClientRect()
      const relativeLeft = rect.left - parentRect.left
      const relativeTop = rect.top - parentRect.top
      const relativeRight = rect.right - parentRect.left
      const relativeBottom = rect.bottom - parentRect.top

      if (relativeLeft < left) left = relativeLeft
      if (relativeTop < top) top = relativeTop
      if (relativeRight > right) right = relativeRight
      if (relativeBottom > bottom) bottom = relativeBottom
    }

    return { left, top, right, bottom }
  }
}

function registerListeners () {
  const on = (target, event, handler) => {
    if (typeof target === 'string') {
      document.getElementById(target).addEventListener(event, handler, false)
    } else {
      target.addEventListener(event, handler, false)
    }
  }

  const onAll = (target, event, handler) => {
    const elements = document.querySelectorAll(target)

    for (const el of elements) {
      el.addEventListener(event, handler, false)
    }
  }

  onAll('input[type="checkbox"]', 'change', onCheckBoxChanged)
  on('savedLayouts', 'click', onSavedLayoutClicked)
  on(document, 'keydown', onDocumentKeydown)
}

async function onCheckBoxChanged (e) {
  const target = e.target
  const targetId = target.id

  const storedPreferences = await storage
    .load('preferences', storage.preferenceDefaults)
    .catch((error) => {
      console.error('An error occurred:', error)
      target.checked = !target.checked
    })

  const preference = storedPreferences[targetId]

  if (!preference) {
    return
  }

  preference.status = target.checked

  try {
    await storage.save('preferences', storedPreferences)
  } catch (error) {
    console.error('An error occurred:', error)
    target.checked = !target.checked
  }
}

function onDocumentKeydown (e) {
  if (e.key === 'Enter') {
    const navElements = document.querySelectorAll('.nav-index:not(.selected)')

    if (navElements.length === 0) {
      document.getElementById('apply').click()
    }
  } else if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    document.getElementById('save').click()
  } else if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    document.getElementById('undo').click()
  } else if (e.key === 'Backspace' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    document.getElementById('clear').click()
  } else if (e.key === 'Tab') {
    e.preventDefault()
  }
}

function playSound (sound) {
  const playable = new Audio(chrome.runtime.getURL(`audio/${sound}.mp3`))
  playable.play()
}

async function renderLayoutItem (layout) {
  const savedLayoutsElement = document.getElementById('savedLayouts')
  const pathToPredefinedHtml = chrome.runtime.getURL('../html/fragment.html')

  const response = await fetch(pathToPredefinedHtml).catch((error) => {
    console.error('An error occurred:', error)
  })

  const html = await response.text().catch((error) => {
    console.error('An error occurred:', error)
  })

  const fragment = document.createRange().createContextualFragment(html)

  const itemElement = fragment.querySelector('.item')
  itemElement.dataset.id = layout.id
  itemElement.title = layout.name

  const labelElement = fragment.querySelector('.label')
  labelElement.innerText = layout.name

  savedLayoutsElement.appendChild(fragment)
}

async function onSavedLayoutClicked (e) {
  const target = e.target

  if (target.classList.contains('item')) {
    const itemId = target.dataset.id

    const storedLayouts = await storage.load('layouts', []).catch((error) => {
      console.error('An error occurred:', error)
    })

    const foundObjIndex = storedLayouts.findIndex((obj) => obj.id === itemId)

    if (foundObjIndex === -1) {
      return
    }

    const foundObj = storedLayouts[foundObjIndex]

    const currentWindow = await windows.getCurrentWindow().catch((error) => {
      console.error('An error occurred:', error)
    })

    try {
      await message.send({
        rectangles: foundObj.layout,
        gridSize: foundObj.gridSize,
        currentWindowId: currentWindow.id,
        padding: foundObj.padding
      })
    } catch (error) {
      console.error('An error occurred:', error)
    }
  } else if (target.classList.contains('delete')) {
    const itemElement = target.closest('.item')

    if (!itemElement) {
      return
    }

    const itemId = itemElement.dataset.id

    const storedLayouts = await storage.load('layouts', []).catch((error) => {
      console.error('An error occurred:', error)
    })

    const foundObjIndex = storedLayouts.findIndex((obj) => obj.id === itemId)

    if (foundObjIndex === -1) {
      return
    }

    storedLayouts.splice(foundObjIndex, 1)

    await storage.save('layouts', storedLayouts).catch((error) => {
      console.error('An error occurred:', error)
    })

    // Remove closest parent element with class 'item' from DOM
    itemElement.remove()

    const parentElement = document.getElementById('savedLayouts')
    parentElement.innerHTML = parentElement.innerHTML.trim()
  }
}