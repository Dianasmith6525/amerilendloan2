// Patches fs.realpathSync.native to avoid EPERM on Windows when Defender scans files
const fs = require('fs');
fs.realpathSync.native = fs.realpathSync;
