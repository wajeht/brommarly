const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Function to increment the version in package.json and manifest.json
const incrementVersion = () => {
  const packageJsonPath = path.join(__dirname, '../package.json');
  const manifestJsonPath = path.join(__dirname, '../manifest.json');

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
};

// Main function
const main = async () => {
  try {
    // Step 1: Increment the version in package.json and manifest.json
    const newVersion = incrementVersion();

    // Step 2: Ensure /bin folder exists
    console.log('Creating /bin folder...');
    if (!fs.existsSync(path.join(__dirname, '../bin'))) {
      fs.mkdirSync(path.join(__dirname, '../bin'));
    }

    // Step 3: Zip the extension
    console.log('Zipping extension...');
    const extensionDir = path.join(__dirname, '..'); // Root of your project
    const outputZip = path.join(__dirname, '../bin', `extension-v${newVersion}.zip`); // Output zip file with new version

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
    archive.glob('**/*', {
      cwd: extensionDir, // Current working directory
      ignore: [
        'node_modules/**', // Exclude node_modules
        'bin/**', // Exclude bin folder
        'scripts/**', // Exclude scripts folder
        'docs/**', // Exclude docs folder
        '.git/**', // Exclude .git folder
        'package-lock.json', // Exclude package-lock.json
        'package.json', // Exclude package.json
        '.DS_Store', // Exclude macOS .DS_Store files
        '*.log', // Exclude log files
        'LICENSE', // Exclude LICENSE
        'README.md', // Exclude README.md
        '*.zip', // Exclude zip files
      ],
    });
    archive.finalize();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

// Run the script
main();
