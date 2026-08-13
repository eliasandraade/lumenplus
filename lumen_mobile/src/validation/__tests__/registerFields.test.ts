/**
 * Cobre a tabela de comportamento exigida para o cadastro:
 * inicial sem erro · onBlur mostra · submit mostra tudo · corrigir limpa.
 *
 * O ponto central é a separação entre **existir** erro e **mostrar** erro.
 * Um formulário que valida certo mas repreende o usuário antes de ele digitar
 * qualquer coisa está errado do ponto de vista de produto — e foi por isso que
 * `deveMostrarErro` existe como função separada e testável.
 */

import {
  validarCampoPasso1,
  validarPasso1,
  deveMostrarErro,
  CAMPOS_PASSO1,
  type ValoresPasso1,
} from '../registerFields';

const vazio: ValoresPasso1 = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
};

const valido: ValoresPasso1 = {
  fullName: 'Maria de Nazaré',
  email: 'maria@lumen.org',
  password: 'senhaforte',
  confirmPassword: 'senhaforte',
};

describe('estado inicial — nada foi tocado nem enviado', () => {
  it.each(CAMPOS_PASSO1)('não mostra erro em "%s" com o formulário vazio', (campo) => {
    // Este é o coração da correção: independentemente de o campo ser válido ou
    // não, nada deve APARECER antes de o usuário interagir.
    expect(deveMostrarErro(campo, {}, false)).toBe(false);
  });

  it('os campos vazios que de fato têm erro são nome, e-mail e senha', () => {
    // `confirmPassword` NÃO entra: com password e confirmPassword ambos vazios,
    // eles conferem, e a regra é justamente "iguais". O erro relevante nesse
    // caso é o da própria senha ser curta.
    expect(validarCampoPasso1('fullName', vazio)).not.toBeNull();
    expect(validarCampoPasso1('email', vazio)).not.toBeNull();
    expect(validarCampoPasso1('password', vazio)).not.toBeNull();
    expect(validarCampoPasso1('confirmPassword', vazio)).toBeNull();
  });
});

describe('depois de tocar e sair do campo', () => {
  it('mostra erro de nome curto', () => {
    const v = { ...vazio, fullName: 'Jo' };
    expect(validarCampoPasso1('fullName', v)).toBe('Nome deve ter pelo menos 3 caracteres');
    expect(deveMostrarErro('fullName', { fullName: true }, false)).toBe(true);
  });

  it('mostra erro de e-mail inválido', () => {
    const v = { ...vazio, email: 'maria' };
    expect(validarCampoPasso1('email', v)).toBe('Email inválido');
    expect(deveMostrarErro('email', { email: true }, false)).toBe(true);
  });

  it('mostra erro de senha curta', () => {
    const v = { ...vazio, password: '123' };
    expect(validarCampoPasso1('password', v)).toBe('Senha deve ter pelo menos 6 caracteres');
    expect(deveMostrarErro('password', { password: true }, false)).toBe(true);
  });

  it('tocar um campo NÃO revela o erro dos outros', () => {
    const touched = { fullName: true };
    expect(deveMostrarErro('fullName', touched, false)).toBe(true);
    expect(deveMostrarErro('email', touched, false)).toBe(false);
    expect(deveMostrarErro('password', touched, false)).toBe(false);
  });
});

describe('tentativa de envio', () => {
  it('revela todos os erros de uma vez, mesmo sem nenhum campo tocado', () => {
    const erros = validarPasso1(vazio);
    // confirmPassword fica de fora: vazio == vazio, então confere.
    expect(Object.keys(erros).sort()).toEqual(['email', 'fullName', 'password']);
    // E o submit libera a exibição de todos, tocados ou não.
    for (const campo of CAMPOS_PASSO1) {
      expect(deveMostrarErro(campo, {}, true)).toBe(true);
    }
  });

  it('senha divergente aparece no submit', () => {
    const erros = validarPasso1({ ...valido, confirmPassword: 'diferente' });
    expect(erros).toEqual({ confirmPassword: 'Senhas não conferem' });
  });

  it('formulário válido não produz erro nenhum', () => {
    expect(validarPasso1(valido)).toEqual({});
  });
});

describe('correção do valor', () => {
  it('erro some quando o campo passa a ser válido', () => {
    expect(validarCampoPasso1('email', { ...vazio, email: 'x' })).not.toBeNull();
    expect(validarCampoPasso1('email', { ...vazio, email: 'x@y.z' })).toBeNull();
  });

  it('nome deixa de acusar ao atingir 3 caracteres', () => {
    expect(validarCampoPasso1('fullName', { ...vazio, fullName: 'Jo' })).not.toBeNull();
    expect(validarCampoPasso1('fullName', { ...vazio, fullName: 'Ana' })).toBeNull();
  });
});

describe('confirmação de senha', () => {
  it('acusa divergência', () => {
    const v = { ...valido, confirmPassword: 'outra-coisa' };
    expect(validarCampoPasso1('confirmPassword', v)).toBe('Senhas não conferem');
  });

  it('aceita quando as duas batem', () => {
    expect(validarCampoPasso1('confirmPassword', valido)).toBeNull();
  });

  it('depende de password — mudar a senha reavalia a confirmação', () => {
    // Regressão: se a validação olhasse só o próprio campo, trocar `password`
    // depois de confirmar deixaria uma confirmação obsoleta passar.
    const v: ValoresPasso1 = { ...valido, password: 'senha-nova' };
    expect(validarCampoPasso1('confirmPassword', v)).toBe('Senhas não conferem');
  });
});

describe('as regras não foram afrouxadas na extração', () => {
  // A lógica saiu de dentro da tela para um módulo puro. Estes casos travam
  // os limites exatos que existiam antes.
  it('nome com exatamente 3 caracteres é válido', () => {
    expect(validarCampoPasso1('fullName', { ...vazio, fullName: 'Ana' })).toBeNull();
  });

  it('nome só com espaços é inválido', () => {
    expect(validarCampoPasso1('fullName', { ...vazio, fullName: '     ' })).not.toBeNull();
  });

  it('senha com exatamente 6 caracteres é válida', () => {
    expect(validarCampoPasso1('password', { ...vazio, password: '123456' })).toBeNull();
  });

  it('e-mail precisa de arroba E ponto', () => {
    expect(validarCampoPasso1('email', { ...vazio, email: 'a@b' })).not.toBeNull();
    expect(validarCampoPasso1('email', { ...vazio, email: 'a.b' })).not.toBeNull();
    expect(validarCampoPasso1('email', { ...vazio, email: 'a@b.c' })).toBeNull();
  });
});
