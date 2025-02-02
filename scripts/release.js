const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const packageJsonPath = path.join(__dirname, '../package.json');
const manifestJsonPath = path.join(__dirname, '../manifest.json');
const binFolderPath = path.join(__dirname, '../bin');
const changelogPath = path.join(__dirname, '../CHANGELOG.md');
const extensionDir = path.join(__dirname, '..');

function incrementVersion(versionType) {
  try {
    // Read and update package.json version
    const packageJson = require(packageJsonPath);
    const currentVersion = packageJson.version;
    const newVersion = incrementVersionPart(currentVersion, versionType);

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

function incrementVersionPart(currentVersion, versionType) {
  const versionParts = currentVersion.split('.').map(Number);

  switch (versionType) {
    case 'major':
      versionParts[0] += 1;
      versionParts[1] = 0;
      versionParts[2] = 0;
      break;
    case 'minor':
      versionParts[1] += 1;
      versionParts[2] = 0;
      break;
    case 'patch':
      versionParts[2] += 1;
      break;
    default:
      throw new Error('Invalid version type. Use major, minor, or patch.');
  }

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
  return new Promise((resolve, reject) => {
    try {
      const outputZip = path.join(binFolderPath, `chad-v${newVersion}.zip`);
      const output = fs.createWriteStream(outputZip);
      const archive = archiver('zip', { zlib: { level: 9 } });

      archive.pipe(output);

      archive.directory(path.join(extensionDir, 'assets'), 'assets');
      archive.directory(path.join(extensionDir, 'src'), 'src');
      archive.file(path.join(extensionDir, 'manifest.json'), { name: 'manifest.json' });

      output.on('close', () => {
        console.log(`Extension zipped successfully: ${archive.pointer()} total bytes`);
        console.log(`Zip file saved to: ${outputZip}`);
        resolve(outputZip);
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.finalize();
    } catch (error) {
      reject(error);
    }
  });
}

function generateChangelog(newVersion, zipFilePath) {
  try {
    const date = new Date().toISOString().split('T')[0]; // Get current date in YYYY-MM-DD format
    const fileName = path.basename(zipFilePath);
    const relativeLink = `./bin/${fileName}`; // Relative link to the zipped file
    const changelogEntry = `## ${newVersion} - ${date}\n\n- Initial release\n- [Download](${relativeLink})\n\n`;

    if (!fs.existsSync(changelogPath)) {
      fs.writeFileSync(changelogPath, '# CHANGELOG\n\n');
    }

    const currentChangelog = fs.readFileSync(changelogPath, 'utf8');
    const newChangelog = changelogEntry + currentChangelog;

    fs.writeFileSync(changelogPath, newChangelog);
    console.log(`CHANGELOG.md updated for version ${newVersion}`);
  } catch (error) {
    console.error('Error generating CHANGELOG:', error);
    throw error;
  }
}

async function main() {
  try {
    const versionType = process.argv[2];
    if (!['major', 'minor', 'patch'].includes(versionType)) {
      throw new Error('Invalid version type. Use major, minor, or patch.');
    }

    const newVersion = incrementVersion(versionType);
    createBinFolder();
    const zipFilePath = await zipExtension(newVersion); // Wait for the zip process to complete
    generateChangelog(newVersion, zipFilePath);
    process.exit(0);
  } catch (error) {
    console.error('Error in main function:', error);
    process.exit(1);
  }
}

main();
