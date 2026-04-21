import fs from 'fs';
import path from 'path';

const moduleNames = process.argv.slice(2);

if (moduleNames.length === 0) {
  console.error('❌ Please provide at least one module name');
  process.exit(1);
}

const toPascalCase = (str: string) =>
  str.replace(/(^\w|_\w)/g, s => s.replace('_', '').toUpperCase());

moduleNames.forEach(moduleName => {
  const lowerCaseName = moduleName.toLowerCase();
  const pascalName = toPascalCase(moduleName);
  const baseDir = path.join('src', 'app', 'modules', moduleName); // Keep original casing for folder

  const files = [
    { name: `${moduleName}.route.ts`, type: 'route' },
    { name: `${moduleName}.service.ts`, type: 'service' },
    { name: `${moduleName}.validation.ts`, type: 'validation' },
  ];

  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
    console.log(`📁 Created directory: ${baseDir}`);
  }

  files.forEach(({ name, type }) => {
    const filePath = path.join(baseDir, name);
    let content = '';

    switch (type) {
      case 'service':
        content =
          `import httpStatus from 'http-status';\n\n` +
          `import { prisma } from '../../utils/prisma';\n\n` +
          `import sendResponse from '../../utils/sendResponse';\n\n` +
          `import catchAsync from '../../utils/catchAsync';\n\n` +
          `export const ${pascalName}${capitalize(type)} = {}\n`;
        break;
      case 'validation':
        content = `export const ${pascalName}${capitalize(type)} = {};\n`;
        break;
      case 'route':
        content =
          `import express from 'express';\n` +
          `const router = express.Router();\n\n` +
          `export const ${pascalName}Routes = router;\n`;
        break;
      case 'interface':
        content = `// Define ${pascalName} interfaces here\n`;
        break;
      default:
        content = '';
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`📄 Created file: ${filePath}`);
  });
});

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
