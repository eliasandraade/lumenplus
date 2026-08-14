/**
 * Validadores por campo do cadastro.
 *
 * Extraídos da tela para serem funções puras e testáveis. Antes, as regras
 * viviam dentro de `validateStep1`/`validateStep2`, que só rodavam no submit —
 * o que impedia validar um campo isolado quando o usuário sai dele (onBlur).
 *
 * A LÓGICA É A MESMA de antes, campo a campo. O que mudou é QUANDO ela pode
 * ser chamada, não O QUE ela considera válido: nenhuma regra foi afrouxada.
 */

export type CampoPasso1 = 'fullName' | 'email' | 'password' | 'confirmPassword';

export interface ValoresPasso1 {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

/**
 * Retorna a mensagem de erro do campo, ou `null` se estiver válido.
 *
 * `confirmPassword` depende de `password`, por isso a assinatura recebe o
 * conjunto e não só o valor do campo.
 */
export function validarCampoPasso1(
  campo: CampoPasso1,
  v: ValoresPasso1
): string | null {
  switch (campo) {
    case 'fullName':
      return v.fullName.trim().length < 3
        ? 'Nome deve ter pelo menos 3 caracteres'
        : null;

    case 'email':
      return !v.email.includes('@') || !v.email.includes('.')
        ? 'Email inválido'
        : null;

    case 'password':
      return v.password.length < 6
        ? 'Senha deve ter pelo menos 6 caracteres'
        : null;

    case 'confirmPassword':
      return v.password !== v.confirmPassword ? 'Senhas não conferem' : null;

    default:
      return null;
  }
}

export const CAMPOS_PASSO1: CampoPasso1[] = [
  'fullName',
  'email',
  'password',
  'confirmPassword',
];

/** Valida o passo inteiro. Usado no submit. */
export function validarPasso1(v: ValoresPasso1): Record<string, string> {
  const erros: Record<string, string> = {};
  for (const campo of CAMPOS_PASSO1) {
    const msg = validarCampoPasso1(campo, v);
    if (msg) erros[campo] = msg;
  }
  return erros;
}

/**
 * Decide se o erro de um campo deve APARECER.
 *
 * Existir erro e mostrar erro são coisas diferentes. A regra do produto é:
 * o usuário não pode ser repreendido por um campo em que ainda não mexeu.
 * Mostra-se o erro quando ele já saiu do campo (`touched`) ou quando tentou
 * enviar o formulário (`submitAttempted`).
 */
export function deveMostrarErro(
  campo: string,
  touched: Record<string, boolean>,
  submitAttempted: boolean
): boolean {
  return submitAttempted || touched[campo] === true;
}
