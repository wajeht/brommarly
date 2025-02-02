const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Paths to package.json and manifest.json
const packageJsonPath = path.join(__dirname, '../package.json');
const manifestJsonPath = path.join(__dirname, '../manifest.json');
const binFolderPath = path.join(__dirname, '../bin');

// Function to reset version in package.json and manifest.json
const resetVersion = () => {
  try {
    // Reset package.json version
    const packageJson = require(packageJsonPath);
    packageJson.version = '0.0.1';
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    // Reset manifest.json version
    const manifestJson = require(manifestJsonPath);
    manifestJson.version = '0.0.1';
    fs.writeFileSync(manifestJsonPath, JSON.stringify(manifestJson, null, 2));

    console.log('Version reset to 0.0.1 in package.json and manifest.json');
  } catch (error) {
    console.error('Error resetting version:', error);
  }
};

// Function to delete all local and remote git tags from all branches
const deleteGitTags = () => {
  try {
    // Delete local tags
    const tags = execSync('git tag', { encoding: 'utf-8' }).trim().split('\n');

    if (tags.length === 0 || (tags.length === 1 && tags[0] === '')) {
      console.log('No git tags found.');
      return;
    }

    console.log('Deleting all local git tags...');
    execSync(`git tag -d ${tags.join(' ')}`, { stdio: 'inherit' });

    // Delete remote tags from the 'main' remote
    const remotes = execSync('git remote', { encoding: 'utf-8' }).trim().split('\n');
    if (remotes.includes('main')) {
      console.log('Deleting remote git tags from all branches...');
      execSync(`git push --delete main ${tags.join(' ')}`, { stdio: 'inherit' });
    } else {
      console.log('No remote "main" found, skipping remote tag deletion.');
    }

    console.log('All git tags deleted.');
  } catch (error) {
    console.error('Error deleting git tags:', error.message);
  }
};




// Function to delete all contents inside bin folder
const cleanBinFolder = () => {
  try {
    if (fs.existsSync(binFolderPath)) {
      fs.rmSync(binFolderPath, { recursive: true, force: true });
      fs.mkdirSync(binFolderPath);
      console.log('Bin folder cleaned.');
    }
  } catch (error) {
    console.error('Error cleaning bin folder:', error);
  }
};

// Main function
const main = () => {
  resetVersion();
  deleteGitTags();
  cleanBinFolder();
};

main();
