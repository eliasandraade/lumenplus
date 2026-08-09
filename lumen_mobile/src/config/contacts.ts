/**
 * Contatos e URLs institucionais exigidos pelas lojas.
 *
 * As lojas exigem quatro coisas que NÃO são decisão de engenharia:
 *
 *   supportContactEmail      contato de suporte visível no app
 *   moderationContactEmail   canal de denúncia (App Store 1.2, para UGC)
 *   accountDeletionUrl       página pública, sem login (Google Play exige)
 *   privacyPolicyUrl         política de privacidade publicada
 *
 * Este módulo existe para que a única pendência seja **o valor**, e não a
 * implementação: leitura, tipagem, validação e o comportamento de tela quando
 * o valor falta já estão prontos.
 *
 * DELIBERADAMENTE SEM VALOR PADRÃO. Um fallback do tipo
 * `?? 'contato@exemplo.org'` seria pior que a ausência: a tela pareceria certa,
 * o `store:check` passaria, e o endereço errado só apareceria quando um usuário
 * — ou um revisor da Apple — tentasse usá-lo.
 *
 * Preenchimento: `expo.extra` no app.json, ou variáveis EXPO_PUBLIC_* no build.
 */

import Constants from 'expo-constants';

export type ChaveContato =
  | 'supportContactEmail'
  | 'moderationContactEmail'
  | 'accountDeletionUrl'
  | 'privacyPolicyUrl';

type Extra = Partial<Record<ChaveContato, string>>;

const extra: Extra = (Constants.expoConfig?.extra ?? {}) as Extra;

/** Valores obviamente não-institucionais que devem contar como ausentes. */
const PLACEHOLDER = /example\.com|exemplo\.|changeme|TODO|localhost/i;

function ler(chave: ChaveContato, envVar: string): string | null {
  const bruto = extra[chave] ?? process.env[envVar];
  if (!bruto || PLACEHOLDER.test(bruto)) return null;
  return bruto;
}

export const contatos = {
  suporte: ler('supportContactEmail', 'EXPO_PUBLIC_SUPPORT_EMAIL'),
  moderacao: ler('moderationContactEmail', 'EXPO_PUBLIC_MODERATION_EMAIL'),
  exclusaoUrl: ler('accountDeletionUrl', 'EXPO_PUBLIC_ACCOUNT_DELETION_URL'),
  privacidadeUrl: ler('privacyPolicyUrl', 'EXPO_PUBLIC_PRIVACY_POLICY_URL'),
} as const;

/** Contatos que ainda faltam. Vazio = pronto para submeter. */
export function contatosFaltando(): ChaveContato[] {
  const mapa: Array<[ChaveContato, string | null]> = [
    ['supportContactEmail', contatos.suporte],
    ['moderationContactEmail', contatos.moderacao],
    ['accountDeletionUrl', contatos.exclusaoUrl],
    ['privacyPolicyUrl', contatos.privacidadeUrl],
  ];
  return mapa.filter(([, v]) => v === null).map(([k]) => k);
}

/**
 * Um build de release com contato faltando não deve ser submetido. Em
 * desenvolvimento apenas avisa — travar o dev por causa de um e-mail
 * institucional que ainda não existe atrapalharia sem proteger nada.
 */
export function avisarSeIncompleto(): void {
  const faltando = contatosFaltando();
  if (faltando.length === 0) return;
  const msg =
    `[contatos] ${faltando.length} contato(s) institucional(is) ausente(s): ` +
    `${faltando.join(', ')}. As lojas exigem estes valores.`;
  if (__DEV__) {
    console.warn(msg);
  } else {
    console.error(msg);
  }
}
