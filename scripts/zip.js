const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const packageJsonPath = path.join(__dirname, '../package.json');
const manifestJsonPath = path.join(__dirname, '../manifest.json');
const binFolderPath = path.join(__dirname, '../bin');
const extensionDir = path.join(__dirname, '..');

const incrementVersion = () => {
  try {
    // Read package.json
    const packageJson = require(packageJsonPath);
    const currentVersion = packageJson.version;

    // Increment the version (e.g., 1.0.0 -> 1.0.1)
    const versionParts = currentVersion.split('.').map(Number);
    versionParts[2] += 1; // Increment patch version
    const newVersion = versionParts.join('.');

    // Update package.json
    packageJson.version = newVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    // Update manifest.json
    const manifestJson = require(manifestJsonPath);
    manifestJson.version = newVersion;
    fs.writeFileSync(manifestJsonPath, JSON.stringify(manifestJson, null, 2));

    console.log(`Version incremented to: ${newVersion}`);
    return newVersion;
  } catch (error) {
    console.error('Error incrementing version:', error);
    throw error;
  }
};

const createBinFolder = () => {
  try {
    if (!fs.existsSync(binFolderPath)) {
      console.log('Creating /bin folder...');
      fs.mkdirSync(binFolderPath);
    }
  } catch (error) {
    console.error('Error creating /bin folder:', error);
    throw error;
  }
};

const zipExtension = (newVersion) => {
  try {
    console.log('Zipping extension...');

    const outputZip = path.join(binFolderPath, `extension-v${newVersion}.zip`);
    const output = fs.createWriteStream(outputZip);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`Extension zipped successfully: ${archive.pointer()} total bytes`);
      console.log(`Zip file saved to: ${outputZip}`);
    });

    archive.on('error', (err) => {
      throw err;
    });

    // Add files to the zip (exclude unnecessary files/folders)
    archive.pipe(output);

    archive.glob([
      'assets/**/*',     // Include all files inside assets folder
      'src/**/*',         // Include all files inside src folder
      'manifest.json',    // Include manifest.json file
    ], { cwd: extensionDir });  // Working directory for the glob patterns

    archive.finalize();
  } catch (error) {
    console.error('Error zipping extension:', error);
    throw error;
  }
};

const main = async () => {
  try {
    const newVersion = incrementVersion();

    createBinFolder();

    zipExtension(newVersion);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

main();
