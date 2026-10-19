import { ImageSource } from 'expo-image';
import { bundledImages } from './manifest';

/**
 * Restituisce la versione inclusa nell'app dell'immagine (logo o foto) se presente,
 * altrimenti l'URL remoto. Le chiavi sono quelle del CDN LBA (ultimo segmento dell'URL).
 */
export function resolveImageSource(uri: string): ImageSource {
  const key = uri.slice(uri.lastIndexOf('/') + 1);
  return bundledImages[key] ?? { uri };
}
