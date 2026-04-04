const fs = require('fs');
const RENDER = 'https://gig-worker-parametric-insurance.onrender.com';
const files = [
  'frontend/src/pages/DashboardPage.js',
  'frontend/src/pages/RegisterPage.js',
  'frontend/src/pages/SelectPlanPage.js',
  'frontend/src/offlineQueue.js',
];
files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/fetch\('\/api/g, `fetch('${RENDER}/api`);
  c = c.replace(/fetch\(`\/api/g, `fetch(\`${RENDER}/api`);
  fs.writeFileSync(f, c);
  console.log('Updated', f);
});
