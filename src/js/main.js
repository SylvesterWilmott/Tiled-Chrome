'use strict'

import * as windows from './windows.js'
import * as message from './message.js'
import * as storage from './storage.js'
import * as i18n from './localize.js'

document.addEventListener('DOMContentLoaded', init)

async function init () {
  try {
    await buildGrid()
    setupGrid()
  } catch (error) {
    console.error('An error occurred:', error)
  }

  i18n.localize()
}

async function buildGrid () {
  const userPreferences = await storage
    .load('preferences', storage.preferenceDefaults)
    .catch((error) => {
      console.error('An error occurred:', error)
    })

  const gridSize = parseInt(userPreferences.grid_size.status)
  const table = document.getElementById('grid')

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
  const doneButton = document.getElementById('done')
  const undoButton = document.getElementById('undo')
  const table = document.getElementById('grid')

  const maxrextangles = 10
  const rectanglesDrawn = []

  let ghostCount = 0
  let startCell
  let endCell
  let isDragging = false

  table.addEventListener('mousedown', onTableMousedown)
  table.addEventListener('mousemove', onTableMousemove)
  document.addEventListener('mouseup', onDocumentMouseup)
  document.addEventListener('keydown', onDocumentKeydown)
  doneButton.addEventListener('click', onDoneButtonPressed)
  undoButton.addEventListener('click', onUndoButtonPressed)

  const allCells = document.querySelectorAll('.cell')

  for (const cell of allCells) {
    cell.addEventListener('mouseenter', onCellMouseenter)
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

    if (!rectanglesDrawn.length && !undoButton.disabled) {
      undoButton.disabled = true
    }

    if (!rectanglesDrawn.length && !doneButton.disabled) {
      doneButton.disabled = true
    }
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

    rectangle.style.left = `${boundingBox.left}px`
    rectangle.style.top = `${boundingBox.top}px`
    rectangle.style.width = `${boundingBox.right - boundingBox.left}px`
    rectangle.style.height = `${boundingBox.bottom - boundingBox.top}px`
    rectangle.style.zIndex = number
    rectangle.classList.add('rect_' + number)

    document.body.appendChild(rectangle)
  }

  async function onDoneButtonPressed () {
    if (!rectanglesDrawn.length) {
      window.close()
      return
    }

    const gridSize = table.rows[0].cells.length

    const currentWindow = await windows.getCurrentWindow()
      .catch((error) => {
        console.error('An error occurred:', error)
      })

    try {
      await message.send({
        rectangles: rectanglesDrawn,
        gridSize,
        currentWindowId: currentWindow.id
      })
    } catch (error) {
      console.error('An error occurred:', error)
    }
  }

  function onUndoButtonPressed () {
    undo()
  }

  function undo() {
    if (rectanglesDrawn.length) {
      removePreviousSelection()
    }
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

    if (rectanglesDrawn.length && undoButton.disabled) {
      undoButton.disabled = false
    }

    if (rectanglesDrawn.length && doneButton.disabled) {
      doneButton.disabled = false
    }

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
      } else if (rectanglesDrawn.length) {
        e.preventDefault()
        undo()
      } else {
        window.close()
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

    let left = Infinity
    let top = Infinity
    let right = -Infinity
    let bottom = -Infinity

    for (const element of elements) {
      const rect = element.getBoundingClientRect()
      if (rect.left < left) left = rect.left
      if (rect.top < top) top = rect.top
      if (rect.right > right) right = rect.right
      if (rect.bottom > bottom) bottom = rect.bottom
    }

    return { left, top, right, bottom }
  }
}
