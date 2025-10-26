const { execSync } = require('child_process');
execSync('mkdir ".next/standalone/.next" 2>nul & xcopy ".next/static" ".next/standalone/.next/static" /E /I /Y', { stdio: 'inherit' });
execSync('xcopy "public" ".next/standalone/public" /E /I /Y', { stdio: 'inherit' });
execSync('node .next/standalone/server.js', { stdio: 'inherit' });
