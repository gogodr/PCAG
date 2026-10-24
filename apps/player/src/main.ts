import { startPlayer } from './app/startPlayer';
import './styles.css';

const dispose = await startPlayer();
if (import.meta.hot) import.meta.hot.dispose(dispose);
