import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, '../package.json');
const manifestJsonPath = path.join(__dirname, '../manifest.json');
const binFolderPath = path.join(__dirname, '../bin');
const changelogPath = path.join(__dirname, '../CHANGELOG.md');
const extensionDir = path.join(__dirname, '..');

async function incrementVersion(versionType) {
  try {
    // Read and update package.json version
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const currentVersion = packageJson.version;
    const newVersion = incrementVersionPart(currentVersion, versionType);

    packageJson.version = newVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    // Read and update manifest.json version
    const manifestJson = JSON.parse(fs.readFileSync(manifestJsonPath, 'utf8'));
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
      const zipFileName = `chad-v${newVersion}.zip`;
      const outputZip = path.join(binFolderPath, zipFileName);
      const output = fs.createWriteStream(outputZip);
      const archive = archiver('zip', { zlib: { level: 9 } });

      archive.pipe(output);

      archive.directory(path.join(extensionDir, 'assets'), 'assets');
      archive.directory(path.join(extensionDir, 'src'), 'src');
      archive.file(path.join(extensionDir, 'manifest.json'), { name: 'manifest.json' });

      output.on('close', () => {
        console.log(`Extension zipped successfully: ${archive.pointer()} total bytes`);
        console.log(`Zip file saved to: ${outputZip}`);
        resolve(zipFileName);
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

function generateChangelog(newVersion, versionType, changes) {
  try {
    const date = new Date().toISOString().split('T')[0];

    // Create initial changelog content if file doesn't exist
    if (!fs.existsSync(changelogPath)) {
      const initialContent = '# Changelog\n\n';
      fs.writeFileSync(changelogPath, initialContent);
    }

    // Generate changelog entry based on version type
    let changelogEntry = `## ${newVersion} - ${date}\n`;

    if (versionType === 'patch') {
      changelogEntry += `### Patch Changes\n`;
    } else if (versionType === 'minor') {
      changelogEntry += `### Minor Changes\n`;
    } else if (versionType === 'major') {
      changelogEntry += `### Major Changes\n`;
    }

    // Add changes to the changelog
    changelogEntry += changes.map(change => `- ${change}\n`).join('');
    changelogEntry += `\n[Download v${newVersion}](https://github.com/wajeht/chad/raw/refs/heads/main/bin/chad-v${newVersion}.zip)\n\n`;

    // Read existing changelog
    let existingChangelog = fs.readFileSync(changelogPath, 'utf8');

    // Find the position after the header
    const insertPosition = existingChangelog.indexOf('\n\n') + 2;

    // Insert the new changelog entry
    const newChangelog = existingChangelog.slice(0, insertPosition) +
                        changelogEntry +
                        existingChangelog.slice(insertPosition);

    // Write the updated changelog to the file
    fs.writeFileSync(changelogPath, newChangelog);
    console.log(`CHANGELOG.md updated for version ${newVersion}`);
  } catch (error) {
    console.error('Error generating CHANGELOG:', error);
    throw error;
  }
}

async function main() {
  try {
    const versionType = process.argv[2] || 'patch';
    if (!['major', 'minor', 'patch'].includes(versionType)) {
      throw new Error('Invalid version type. Use major, minor, or patch.');
    }

    const changes = [
      'docs: update types definition',
      'fix: return on production env',
      'feat: add new feature X',
    ];

    const newVersion = await incrementVersion(versionType);
    createBinFolder();
    await zipExtension(newVersion);
    generateChangelog(newVersion, versionType, changes);
    process.exit(0);
  } catch (error) {
    console.error('Error in main function:', error);
    process.exit(1);
  }
}

main();
