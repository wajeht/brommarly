# Development

## Node.js Setup

### Prerequisites
- Install nvm (Node Version Manager):
  - For Linux/macOS:
    ```bash
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    ```
  - For Windows:
    Download and install [nvm-windows](https://github.com/coreybutler/nvm-windows/releases)

### Installation

1. After installing nvm, restart your terminal or run:
   ```bash
   source ~/.bashrc  # Linux/macOS
   ```

2. Install and use Node.js from .nvmrc:
   ```bash
   nvm install       # Installs version from .nvmrc (v22.3.0)
   nvm use          # Uses version from .nvmrc
   ```

3. Verify the installation:
   ```bash
   node --version   # Should output v22.3.0
   npm --version    # Should show the corresponding npm version
   ```

### Project Setup

1. Install dependencies:
   ```bash
   npm install
   ```

### Troubleshooting

If you encounter any issues:
- Make sure your terminal is restarted after installing nvm
- Run `nvm list` to see all installed versions
- For Windows users, run commands in an administrator PowerShell if needed
- If .nvmrc is not being read, manually run:
  ```bash
  nvm install v22.3.0
  nvm use v22.3.0
  ```

## Release


To clean all the files in the `bin` folder, delete `CHANGELOG.md`, reset version in `package.json` and `manifest.json`, run:
```bash
$ npm run clean
```

To release a new version, run:
```bash
$ npm run release <version-type>
```

Where `<version-type>` can be `major`, `minor`, or `patch`.

```bash
$ npm run release major # after the release update the CHANGELOG.md file
$ git add .
$ git commit -m "Release v2.1.3"
$ git push
```
