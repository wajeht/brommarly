const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const packageJsonPath = path.join(__dirname, '../package.json');
const manifestJsonPath = path.join(__dirname, '../manifest.json');
const binFolderPath = path.join(__dirname, '../bin');
const extensionDir = path.join(__dirname, '..');

function incrementVersion() {
  try {
    // Read and update package.json version
    const packageJson = require(packageJsonPath);
    const currentVersion = packageJson.version;
    const newVersion = incrementPatchVersion(currentVersion);

    packageJson.version = newVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    // Read and update manifest.json version
    const manifestJson = require(manifestJsonPath);
    manifestJson.version = newVersion;
    fs.writeFileSync(manifestJsonPath, JSON.stringify(manifestJson, null, 2));

    console.log(`Version incremented to: ${newVersion}`);
    return newVersion;
  } catch (error) {
    console.error('Error incrementing version:', error);
    throw error;
  }
}

function incrementPatchVersion(currentVersion) {
  const versionParts = currentVersion.split('.').map(Number);
  versionParts[2] += 1;  // Increment patch version
  return versionParts.join('.');
}

function createBinFolder() {
  try {
    if (!fs.existsSync(binFolderPath)) {
      console.log('Creating /bin folder...');
      fs.mkdirSync(binFolderPath);
    }
  } catch (error) {
    console.error('Error creating bin folder:', error);
    throw error;
  }
}

function zipExtension(newVersion) {
  try {
    const outputZip = path.join(binFolderPath, `extension-v${newVersion}.zip`);
    const output = fs.createWriteStream(outputZip);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);

    archive.glob([
      './assets/**/*',
      './src/**/*',
      './manifest.json',
    ], { cwd: extensionDir });

    output.on('close', () => {
      console.log(`Extension zipped successfully: ${archive.pointer()} total bytes`);
      console.log(`Zip file saved to: ${outputZip}`);
    });

    archive.on('error', (err) => {
      throw err;
    });

    archive.finalize();
  } catch (error) {
    console.error('Error zipping extension:', error);
    throw error;
  }
}

function main() {
  try {
    const newVersion = incrementVersion();
    createBinFolder();
    zipExtension(newVersion);
    process.exit(0);
  } catch (error) {
    console.error('Error in main function:', error);
    process.exit(1);
  }
}

main();
