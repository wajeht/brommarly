const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { exec } = require('child_process');

// Function to run shell commands
const runCommand = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (err, stdout, stderr) => {
      if (err) {
        reject(stderr);
      } else {
        resolve(stdout);
      }
    });
  });
};

// Function to check if Git working directory is clean
const checkGitStatus = async () => {
  try {
    const status = await runCommand('git status --porcelain');
    if (status.trim() !== '') {
      throw new Error('Git working directory is not clean. Commit or stash your changes before running this script.');
    }
  } catch (error) {
    console.error('Error checking Git status:', error.message);
    process.exit(1);
  }
};

// Main function
const main = async () => {
  try {
    // Step 1: Check if Git working directory is clean
    await checkGitStatus();

    // Step 2: Increment the version and create a Git tag
    console.log('Incrementing version and creating Git tag...');
    const versionOutput = await runCommand('npm version patch'); // Use 'patch', 'minor', or 'major' as needed
    const newVersion = versionOutput.trim().replace('v', ''); // Extract the new version (e.g., "v1.0.1" -> "1.0.1")
    console.log(`New version: ${newVersion}`);

    // Step 3: Ensure /bin folder exists
    console.log('Creating /bin folder...');
    await runCommand(`mkdir -p ${path.join(__dirname, '../bin')}`);

    // Step 4: Zip the extension
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
      ],
    });
    archive.finalize();

    // Step 5: Push the new tag to GitHub
    console.log('Pushing new tag to GitHub...');
    await runCommand('git push main main --tags'); // Use "main" as the remote name
    console.log('Tag pushed to GitHub successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

// Run the script
main();
