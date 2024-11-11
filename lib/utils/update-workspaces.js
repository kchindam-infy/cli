'use strict'

const fs = require('fs')
const path = require('path')
const Arborist = require('@npmcli/arborist')

async function updateWorkspaces ({
  flatOptions,
  localPrefix,
  workspaces,
}) {
  if (!flatOptions.workspacesUpdate || !workspaces.length) {
    return
  }

  // collect updated workspace package versions
  const workspacePackages = new Map()

  // get the updated versions of workspace packages
  for (const [, workspacePath] of workspaces) {
    const pkgPath = path.join(workspacePath, 'package.json')
    const pkgData = await fs.promises.readFile(pkgPath, 'utf8')
    const pkg = JSON.parse(pkgData)
    workspacePackages.set(pkg.name, pkg.version)
  }

  // update dependencies in all workspace packages
  for (const [, workspacePath] of workspaces) {
    const pkgPath = path.join(workspacePath, 'package.json')
    const pkgData = await fs.promises.readFile(pkgPath, 'utf8')
    const pkg = JSON.parse(pkgData)

    // list of dependency fields to update
    const depFields = [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ]

    let updated = false

    for (const field of depFields) {
      if (pkg[field]) {
        for (const depName of Object.keys(pkg[field])) {
          if (workspacePackages.has(depName)) {
            // update the version spec to match the new version
            pkg[field][depName] = workspacePackages.get(depName)
            updated = true
          }
        }
      }
    }

    if (updated) {
      // write the updated package.json back to disk
      const updatedPkgData = JSON.stringify(pkg, null, 2) + '\n'
      await fs.promises.writeFile(pkgPath, updatedPkgData, 'utf8')
    }
  }

  // after done with updating package.json files, use arborist.reify() to update node_modules
  const opts = {
    ...flatOptions,
    audit: false,
    fund: false,
    path: localPrefix,
    save: false, // since the package.json is already updated, so no need to save changes again
  }
  const arb = new Arborist(opts)
  await arb.reify()
}

module.exports = updateWorkspaces
