# Tiled

Tiled is a Chrome extension that lets you arrange your windows using a grid-based interface.

## Installation

1. Download and uncompress zip.
2. In Chrome, go to the extensions page at `chrome://extensions/`.
3. Enable Developer Mode.
4. Choose `Load Unpacked` and select the folder.

## Build

1. `npm install` to install the necessary dependencies.
2. Update `version` in `manifest.json`.
3. `npm run build`.

## Usage

Once installed, you can access the extension by clicking the icon in the Chrome toolbar.

- Drag rectangles on the grid. Each rectangle represents a window.
- Press `Undo` to undo the last rectangle.
- Press `Done` to update your workspace.
- If there are enough windows open, they will be resized to match your layout. Otherwise, new windows will be created.
- Right-click the extension icon to access preferences.