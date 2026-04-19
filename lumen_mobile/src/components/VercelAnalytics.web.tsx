// Vercel Analytics — carregado apenas no bundle web
// @vercel/analytics v2 exporta Analytics pelo caminho raiz (não /react)
import { Analytics } from '@vercel/analytics';
export function VercelAnalytics() {
  return <Analytics />;
}
