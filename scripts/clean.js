import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, '../package.json');
const manifestJsonPath = path.join(__dirname, '../manifest.json');
const binFolderPath = path.join(__dirname, '../bin');
const changelogPath = path.join(__dirname, '../CHANGELOG.md');

function resetVersion() {
  try {
    // Reset package.json version
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    packageJson.version = '0.0.0';
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    // Reset manifest.json version
    const manifestJson = JSON.parse(fs.readFileSync(manifestJsonPath, 'utf8'));
    manifestJson.version = '0.0.0';
    fs.writeFileSync(manifestJsonPath, JSON.stringify(manifestJson, null, 2));

    console.log('Version reset to 0.0.0 in package.json and manifest.json');
  } catch (error) {
    console.error('Error resetting version:', error);
  }
}

function deleteGitTags() {
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
}

function cleanBinFolder() {
  try {
    if (fs.existsSync(binFolderPath)) {
      fs.rmSync(binFolderPath, { recursive: true, force: true });
      fs.mkdirSync(binFolderPath);
      console.log('Bin folder cleaned.');
    }
  } catch (error) {
    console.error('Error cleaning bin folder:', error);
  }
}

function deleteChangelog() {
  try {
    if (fs.existsSync(changelogPath)) {
      fs.rmSync(changelogPath, { force: true });
      console.log('CHANGELOG.md deleted.');
    } else {
      console.log('CHANGELOG.md does not exist, skipping deletion.');
    }
  } catch (error) {
    console.error('Error deleting CHANGELOG.md:', error);
  }
}

function main() {
  resetVersion();
  deleteGitTags();
  cleanBinFolder();
  deleteChangelog();
}

main();
