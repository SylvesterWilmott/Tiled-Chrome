'use strict'

/* global chrome, Audio */

import * as display from './display.js'
import * as navigation from './navigation.js'
import * as windows from './windows.js'
import * as message from './message.js'
import * as storage from './storage.js'
import * as i18n from './localize.js'
import * as uid from './uid.js'

document.addEventListener('DOMContentLoaded', init)

let gridInstance

async function init () {
  try {
    await Promise.all([
      restorePreferences(),
      renderSavedLayouts(),
      i18n.localize()
    ])
  } catch (error) {
    console.error('An error occurred:', error)
  }

  const storedPreferences = await storage
    .load('preferences', storage.preferenceDefaults)
    .catch((error) => {
      console.error('An error occurred:', error)
    })

  const gridSize = parseInt(storedPreferences.grid_size.status)

  const currentWindow = await windows.getCurrentWindow().catch((error) => {
    console.error('An error occurred:', error)
  })

  const connectedDisplays = await display.getDisplayInfo().catch((error) => {
    console.error('An error occurred:', error)
  })

  const currentDisplay = display.getDisplayContainingCurrentWindow(connectedDisplays, currentWindow)

  gridInstance = new Grid()
  gridInstance.setup(gridSize, currentDisplay)

  registerListeners()
  navigation.init()
  ready()
}

function ready () {
  postponeAnimationUntilReady()

  const hiddenElements = document.querySelectorAll('.hidden')

  for (const el of hiddenElements) {
    el.classList.remove('hidden')
  }
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

class Grid {
  constructor () {
    this.table = document.getElementById('grid')
    this.maxrectangles = 10
    this.rectanglesDrawn = []
    this.ghostCount = 0
    this.startCell = null
    this.endCell = null
    this.isDragging = false

    // Bound event handler references
    this.onTableMousedownBound = this.onTableMousedown.bind(this)
    this.onTableMousemoveBound = this.onTableMousemove.bind(this)
    this.onDocumentMouseupBound = this.onDocumentMouseup.bind(this)
    this.onDocumentKeydownBound = this.onDocumentKeydown.bind(this)
    this.onActionClickedBound = this.onActionClicked.bind(this)
    this.onCellMouseenterBound = this.onCellMouseenter.bind(this)
  }

  setup (gridSize, display) {
    this.buildGrid(gridSize)
    this.sizeGrid(display)
    this.attachEventListeners()
    this.attachCellListeners()
  }

  buildGrid (gridSize) {
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

  sizeGrid (display) {
    const table = document.getElementById('grid')
    const displayHeight = display.bounds.height
    const displayWidth = display.bounds.width

    // Calculate the aspect ratio
    const largerNumber = Math.max(displayHeight, displayWidth)
    const smallerNumber = Math.min(displayHeight, displayWidth)
    const aspectRatio = largerNumber / smallerNumber

    const gridFixedDimension = 350
    const variableDimension = Math.round(this.getVariableDimension(gridFixedDimension, aspectRatio))

    if (displayWidth >= displayHeight) {
      table.style.width = `${gridFixedDimension}px`
      table.style.height = `${variableDimension}px`
    } else {
      table.style.width = `${variableDimension}px`
      table.style.height = `${gridFixedDimension}px`
    }
  }

  getVariableDimension (fixedWidth, aspectRatio) {
    return fixedWidth / aspectRatio
  }

  attachEventListeners () {
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

    on('grid', 'mousedown', this.onTableMousedownBound)
    on('grid', 'mousemove', this.onTableMousemoveBound)
    on(document, 'mouseup', this.onDocumentMouseupBound)
    on(document, 'keydown', this.onDocumentKeydownBound)
    onAll('div.nav-index', 'click', this.onActionClickedBound)
  }

  detachEventListeners () {
    const off = (target, event, handler) => {
      if (typeof target === 'string') {
        const element = document.getElementById(target)
        if (element) {
          element.removeEventListener(event, handler, false)
        }
      } else {
        target.removeEventListener(event, handler, false)
      }
    }

    const offAll = (target, event, handler) => {
      const elements = document.querySelectorAll(target)

      elements.forEach((el) => {
        el.removeEventListener(event, handler, false)
      })
    }

    off('grid', 'mousedown', this.onTableMousedownBound)
    off('grid', 'mousemove', this.onTableMousemoveBound)
    off(document, 'mouseup', this.onDocumentMouseupBound)
    off(document, 'keydown', this.onDocumentKeydownBound)
    offAll('div.nav-index', 'click', this.onActionClickedBound)
  }

  attachCellListeners () {
    this.table.querySelectorAll('.cell').forEach((cell) => {
      cell.addEventListener('mouseenter', this.onCellMouseenterBound)
    })
  }

  detachCellListeners () {
    this.table.querySelectorAll('.cell').forEach((cell) => {
      cell.removeEventListener('mouseenter', this.onCellMouseenterBound)
    })
  }

  onActionClicked (e) {
    const target = e.target
    const targetId = target.id
    const numberOfRectangles = this.rectanglesDrawn.length

    if (!numberOfRectangles) {
      playSound('error')
      return
    }

    if (targetId === 'apply') {
      this.applyLayout()
    } else if (targetId === 'undo') {
      this.removePreviousSelection()
    } else if (targetId === 'save') {
      this.saveLayout()
    } else if (targetId === 'clear') {
      this.clearAllSelections()
    }
  }

  clearAllSelections () {
    const numberOfRectangles = this.rectanglesDrawn.length

    for (let i = 0; i < numberOfRectangles; i++) {
      this.removePreviousSelection()
    }
  }

  onCellMouseenter (e) {
    if (!this.isDragging || e.buttons !== 1) return
    this.removeAllSelections()
  }

  onTableMousedown (e) {
    if (e.buttons !== 1 || this.rectanglesDrawn.length >= this.maxrectangles) { return }

    this.removeAllSelections()

    if (e.target.classList.contains('cell')) {
      this.startCell = e.target
      this.endCell = e.target
      this.isDragging = true
    }
  }

  onTableMousemove (e) {
    if (!this.isDragging) return

    // If the mouse is over a cell, set the endCell variable to that cell
    if (e.target.classList.contains('cell')) this.endCell = e.target

    // Get the row and column indices of the start and end cells
    const startRow = this.startCell.parentElement.rowIndex
    const startCol = this.startCell.cellIndex
    const endRow = this.endCell.parentElement.rowIndex
    const endCol = this.endCell.cellIndex

    // Loop through all rows between the start and end rows
    for (const row of Array.from(this.table.rows).slice(
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

  removeAllSelections () {
    const cells = document.querySelectorAll('.cell')

    for (const cell of cells) {
      cell.classList.remove('highlight')
    }
  }

  removePreviousSelection () {
    const selection = this.rectanglesDrawn[this.rectanglesDrawn.length - 1]
    this.clearGhost(selection, this.ghostCount)
    this.ghostCount--
    console.log(this.ghostCount, this.rectanglesDrawn)
    this.rectanglesDrawn.pop()
  }

  transformSelectionToGhost () {
    this.ghostCount++

    const cells = document.querySelectorAll('.highlight')

    for (const cell of cells) {
      cell.classList.remove('highlight')
      cell.classList.add('ghost_' + this.ghostCount)
    }

    const finalSelection = document.querySelectorAll(
      '.ghost_' + this.ghostCount
    )
    const boundingBox = this.getBoundingBox(finalSelection)

    this.createRectangle(boundingBox, this.ghostCount)
  }

  createRectangle (boundingBox, number) {
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

  async applyLayout () {
    const gridSize = this.table.rows[0].cells.length

    const currentWindow = await windows.getCurrentWindow().catch((error) => {
      console.error('An error occurred:', error)
    })

    try {
      await message.send({
        msg: 'layout',
        rectangles: this.rectanglesDrawn,
        gridSize,
        currentWindowId: currentWindow.id
      })
    } catch (error) {
      console.error('An error occurred:', error)
    }

    this.clearAllSelections()
  }

  async saveLayout () {
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

    const gridSize = this.table.rows[0].cells.length

    const layoutObj = {
      name,
      id: uid.create(),
      layout: this.rectanglesDrawn,
      gridSize
    }

    storedLayouts.push(layoutObj)

    try {
      await storage.save('layouts', storedLayouts)
    } catch (error) {
      console.error('An error occurred:', error)
    }

    this.clearAllSelections()
    renderLayoutItem(layoutObj)
  }

  async onDocumentMouseup () {
    const highlight = document.querySelectorAll('.highlight')

    if (!highlight.length || !this.startCell || !this.endCell) {
      this.removeAllSelections()
      this.isDragging = false
      return
    }

    // Calculate the start and end row and column indices
    const startRow = this.startCell.parentElement.rowIndex
    const startCol = this.startCell.cellIndex
    const endRow = this.endCell.parentElement.rowIndex
    const endCol = this.endCell.cellIndex

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

    this.isDragging = false
    this.rectanglesDrawn.push(selectionObject)
    this.transformSelectionToGhost()
    this.startCell = null
    this.endCell = null
  }

  onDocumentKeydown (e) {
    if (e.key === 'Escape') {
      if (this.isDragging) {
        e.preventDefault()
        this.isDragging = false
        this.startCell = null
        this.endCell = null
        this.removeAllSelections()
      }
    }
  }

  clearGhost (selection, number) {
    // Loop over the cells within the selection
    for (const row of Array.from(this.table.rows).slice(
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

  getBoundingBox (elements) {
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
  onAll('select', 'change', onSelectChanged)
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

  savedLayoutsElement.prepend(fragment)
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
        msg: 'layout',
        rectangles: foundObj.layout,
        gridSize: foundObj.gridSize,
        currentWindowId: currentWindow.id
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
    gridInstance.detachEventListeners()
    gridInstance.detachCellListeners()
    gridInstance.clearAllSelections()
    gridInstance.buildGrid(target.value)
    gridInstance.attachEventListeners()
    gridInstance.attachCellListeners()
  }
}
