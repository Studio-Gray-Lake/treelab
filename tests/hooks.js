import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { workshopDir } from '../workshop.config.js';

// Lets the tests resolve imports the way vite.config.js does:
//   - `@workshop/...` is the copies in vendor/workshop/ (TREELAB_LIVE=1:
//     the workshop's own src folder, as `npm run dev:live` reads it);
//   - `three` imported by the workshop's own files comes from TreeLab's
//     node_modules, so there's one three.js, as on the page.
const dir = workshopDir(process.env.TREELAB_LIVE === '1');
const workshopURL = pathToFileURL(dir + path.sep).href;
const treelabURL = new URL('../package.json', import.meta.url).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@workshop/')) {
      return nextResolve(new URL(specifier.slice('@workshop/'.length), workshopURL).href, context);
    }
    const isThree = specifier === 'three' || specifier.startsWith('three/');
    if (isThree && context.parentURL?.startsWith(workshopURL)) {
      return nextResolve(specifier, { ...context, parentURL: treelabURL });
    }
    return nextResolve(specifier, context);
  },
});
