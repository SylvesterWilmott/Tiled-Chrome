'use strict'

const gulp = require('gulp')
const zip = require('gulp-zip')
const imagemin = require('gulp-imagemin')
const pkg = require('./package.json')
const jsonEditor = require('gulp-json-editor')
const path = require('path')
const { exec } = require('child_process')

gulp.task('build', function () {
  // Get the path to the manifest file
  const manifestPath = path.join(__dirname, 'src', 'manifest.json')

  // Read the version from the extension manifest
  const manifest = require(manifestPath)
  const version = manifest.version

  // Update the version in package.json
  return gulp.src('./package.json')
    .pipe(jsonEditor({ version }))
    .pipe(gulp.dest('./'))
    .on('end', function () {
      const filename = `${pkg.name}-v${version}.zip`
      gulp.src(['src/**', '!src/**/*.map'])
        .pipe(imagemin([imagemin.optipng({ optimizationLevel: 5 })]))
        .pipe(zip(filename))
        .pipe(gulp.dest('build'))
        .on('end', function () {
          // Run npm install
          console.log('Running npm install...')
          exec('npm install', function (err, stdout, stderr) {
            if (err) {
              console.error(`Error running npm install: ${err}`)
              return
            }
            console.log(stdout)
            console.error(stderr)
          })
        })
    })
})
