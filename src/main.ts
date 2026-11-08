import './styles/app-page.css';
import { mountMagid } from './mount';

// The full app: Magid owns the page. Embedding pages use the embed build's mountMagid instead (src/index.ts).
mountMagid(document.getElementById('root')!, { mode: 'app' });
