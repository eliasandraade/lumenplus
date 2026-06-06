/**
 * Conteúdo vocacional adaptado por etapa formativa e estado de vida.
 * Usado pelo módulo Projeto de Vida para personalizar a experiência do usuário.
 */

// ── Motivação ─────────────────────────────────────────────────────────────────

export interface MotivacaoContent {
  saudacao: string;
  reflexao: string;
  escritura: string;
  questaoMeditacao: string;
}

export const MOTIVACAO_CONTENT: Record<string, MotivacaoContent> = {
  ACOLHIDA: {
    saudacao: 'Bem-vindo ao seu Projeto de Vida, {nome}.',
    reflexao: 'Você está dando os primeiros passos neste caminho. Deus te chama a conhecer Seu amor e a descobrir Sua presença em cada detalhe da sua vida.',
    escritura: '"Vinde a mim, todos os que estais cansados e oprimidos, e Eu vos aliviarei." (Mt 11,28)',
    questaoMeditacao: 'Como Deus está me chamando a confiar mais nEle neste mês?',
  },
  APROFUNDAMENTO: {
    saudacao: 'Seja bem-vindo ao seu novo ciclo, {nome}.',
    reflexao: 'Nesta etapa de aprofundamento, você é convidado a mergulhar mais fundo no amor de Deus e a discernir Sua vontade para a sua vida.',
    escritura: '"O Senhor é meu pastor e nada me faltará." (Sl 23,1)',
    questaoMeditacao: 'Em que área da minha vida Deus está me pedindo maior entrega neste mês?',
  },
  VOCACIONAL: {
    saudacao: 'Que este ciclo seja um tempo de graça, {nome}.',
    reflexao: 'Como membro vocacional, você está num momento especial de discernimento. Deixe que o Senhor ilumine cada decisão deste mês.',
    escritura: '"Não fostes vós que me escolhestes, mas fui Eu que vos escolhi." (Jo 15,16)',
    questaoMeditacao: 'Como estou respondendo ao chamado de Deus na minha vida concreta hoje?',
  },
  POSTULANTADO: {
    saudacao: 'Que Deus guie cada passo seu neste ciclo, {nome}.',
    reflexao: 'O postulantado é um tempo de preparação e discernimento. Cada comprometimento que você assume neste mês é uma resposta concreta ao chamado que ouviu.',
    escritura: '"Aqui estou, envia-me." (Is 6,8)',
    questaoMeditacao: 'Como estou vivendo a disponibilidade que Deus me pede neste momento da minha formação?',
  },
  DISCIPULADO: {
    saudacao: 'Bem-vindo ao seu novo ciclo de discipulado, {nome}.',
    reflexao: 'Como discípulo vocacional, você é chamado a seguir Jesus de perto, a aprender com Ele e a irradiar Sua presença ao redor.',
    escritura: '"Segue-me." (Jo 1,43)',
    questaoMeditacao: 'Como Jesus está me convidando a crescer como Seu discípulo neste mês?',
  },
  CONSAGRADO_FILHO_DA_LUZ: {
    saudacao: 'Que o Emanuel renove seu coração neste ciclo, {nome}.',
    reflexao: 'Como consagrado Filho da Luz, seu Projeto de Vida é expressão de um amor total. Cada área planejada aqui é uma oferta concreta ao Senhor.',
    escritura: '"Não sou mais eu que vivo, é Cristo que vive em mim." (Gl 2,20)',
    questaoMeditacao: 'Como minha consagração está se tornando mais concreta e mais viva neste mês?',
  },
  GENERICO: {
    saudacao: 'Seja bem-vindo ao seu Projeto de Vida, {nome}.',
    reflexao: 'Este é um tempo sagrado. Antes de planejar, coloque-se diante de Deus e deixe que Ele ilumine suas escolhas.',
    escritura: '"Eu vim para que tenham vida, e a tenham em abundância." (Jo 10,10)',
    questaoMeditacao: 'Como Deus está me chamando a viver melhor Sua vontade neste mês?',
  },
};

// ── Dever de Estado ───────────────────────────────────────────────────────────

export interface DeveEstadoCategoria {
  label: string;
  placeholder: string;
}

export interface DeveEstadoTemplate {
  titulo: string;
  descricao: string;
  categorias: DeveEstadoCategoria[];
}

export const DEVER_ESTADO_TEMPLATES: Record<string, DeveEstadoTemplate> = {
  CASADO: {
    titulo: 'Dever de Estado — Casado(a)',
    descricao: 'Como pessoa casada, seu dever de estado perante Deus envolve viver a aliança matrimonial como caminho de santificação.',
    categorias: [
      { label: 'Cônjuge', placeholder: 'Que momentos concretos vou reservar para minha esposa/marido esta semana?' },
      { label: 'Filhos', placeholder: 'Como cuidarei da educação e presença com meus filhos?' },
      { label: 'Lar e Família', placeholder: 'Que responsabilidades familiares assumirei?' },
      { label: 'Oração em Família', placeholder: 'Como organizarei a vida de oração da minha família?' },
    ],
  },
  SOLTEIRO: {
    titulo: 'Dever de Estado — Solteiro(a)',
    descricao: 'Como pessoa solteira, seu dever de estado envolve cultivar a vida interior, as relações familiares e o serviço comunitário.',
    categorias: [
      { label: 'Vida de Oração', placeholder: 'Como cuidarei da minha vida interior esta semana?' },
      { label: 'Família de Origem', placeholder: 'Que presença concreta oferecerei à minha família?' },
      { label: 'Trabalho e Estudo', placeholder: 'Como viverei meu trabalho/estudo com espírito de serviço?' },
      { label: 'Serviço na Comunidade', placeholder: 'Como contribuirei com a comunidade esta semana?' },
    ],
  },
  CELIBATARIO: {
    titulo: 'Dever de Estado — Celibatário(a)',
    descricao: 'Seu celibato é uma entrega total ao Senhor. Seu dever de estado envolve fidelidade à vida consagrada e à missão.',
    categorias: [
      { label: 'Fidelidade à Consagração', placeholder: 'Como viverei minha entrega ao Senhor esta semana?' },
      { label: 'Missão', placeholder: 'Que ações concretas de missão assumirei?' },
      { label: 'Vida Comunitária', placeholder: 'Como cultivarei os vínculos fraternos?' },
      { label: 'Vida Interior', placeholder: 'Como aprofundarei minha vida de oração?' },
    ],
  },
  SEMINARISTA: {
    titulo: 'Dever de Estado — Seminarista',
    descricao: 'Como seminarista, seu dever de estado envolve formação integral para o sacerdócio.',
    categorias: [
      { label: 'Formação', placeholder: 'Como me dedicarei à formação esta semana?' },
      { label: 'Oração', placeholder: 'Como aprofundarei minha vida de oração?' },
      { label: 'Estudos', placeholder: 'Quais são meus compromissos acadêmicos desta semana?' },
      { label: 'Pastoral', placeholder: 'Como viverei os compromissos pastorais?' },
    ],
  },
  DIACONO: {
    titulo: 'Dever de Estado — Diácono',
    descricao: 'Como diácono, seu dever de estado envolve serviço litúrgico, caritativo e evangelizador.',
    categorias: [
      { label: 'Serviço Litúrgico', placeholder: 'Quais ministérios litúrgicos exercerei esta semana?' },
      { label: 'Serviço Caritativo', placeholder: 'Como servirei os pobres e necessitados?' },
      { label: 'Família', placeholder: 'Como cuidarei da minha família?' },
      { label: 'Formação Permanente', placeholder: 'Como cuidarei da minha formação contínua?' },
    ],
  },
  DIACONO_PERMANENTE: {
    titulo: 'Dever de Estado — Diácono Permanente',
    descricao: 'Como diácono permanente, você vive a tensão fecunda entre família, trabalho e ministério.',
    categorias: [
      { label: 'Família', placeholder: 'Como cuidarei da minha família esta semana?' },
      { label: 'Ministério Diaconal', placeholder: 'Quais serviços diaconais assumirei?' },
      { label: 'Trabalho', placeholder: 'Como viverei o trabalho como missão?' },
      { label: 'Oração', placeholder: 'Como sustentarei minha vida interior?' },
    ],
  },
  SACERDOTE: {
    titulo: 'Dever de Estado — Sacerdote',
    descricao: 'Como sacerdote, seu dever de estado centra-se na Eucaristia, no confessionário e no serviço ao povo de Deus.',
    categorias: [
      { label: 'Vida Eucarística', placeholder: 'Como cuidarei da celebração e adoração?' },
      { label: 'Serviço Sacramental', placeholder: 'Quais sacramentos administrarei esta semana?' },
      { label: 'Pregação e Catequese', placeholder: 'Como prepararei minha pregação?' },
      { label: 'Paróquia e Comunidade', placeholder: 'Quais são meus compromissos comunitários?' },
    ],
  },
  BISPO: {
    titulo: 'Dever de Estado — Bispo',
    descricao: 'Como bispo, seu dever de estado é ser sinal de unidade, pai e pastor da Igreja.',
    categorias: [
      { label: 'Magistério e Governo', placeholder: 'Quais decisões pastorais assumirei esta semana?' },
      { label: 'Vida de Oração', placeholder: 'Como sustentarei minha vida interior?' },
      { label: 'Serviço à Diocese', placeholder: 'Como servirei concretamente a diocese?' },
      { label: 'Presença Fraterna', placeholder: 'Como me farei presente ao clero e ao povo?' },
    ],
  },
  LEIGO_CONSAGRADO: {
    titulo: 'Dever de Estado — Leigo(a) Consagrado(a)',
    descricao: 'Como leigo consagrado, você vive no mundo com coração totalmente entregue a Deus.',
    categorias: [
      { label: 'Fidelidade aos Direcionamentos', placeholder: 'Como viverei os direcionamentos da minha consagração?' },
      { label: 'Missão no Mundo', placeholder: 'Como exercerei minha missão no ambiente onde vivo?' },
      { label: 'Vida Comunitária', placeholder: 'Como cultivarei a comunhão com meus irmãos?' },
      { label: 'Vida Interior', placeholder: 'Como aprofundarei minha vida de oração?' },
    ],
  },
  GENERICO: {
    titulo: 'Dever de Estado',
    descricao: 'Seu dever de estado são as responsabilidades concretas que Deus lhe confia pelo seu estado de vida.',
    categorias: [
      { label: 'Relações Primárias', placeholder: 'Como cuidarei das pessoas mais próximas a mim?' },
      { label: 'Trabalho e Missão', placeholder: 'Como viverei minhas responsabilidades com espírito de serviço?' },
      { label: 'Vida Interior', placeholder: 'Como cuidarei da minha vida de oração?' },
      { label: 'Serviço', placeholder: 'Como servirei o próximo esta semana?' },
    ],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getMotivacaoContent(
  vocationalRealityCode: string | null | undefined,
  nome: string,
): MotivacaoContent {
  const key = vocationalRealityCode ?? 'GENERICO';
  const content = MOTIVACAO_CONTENT[key] ?? MOTIVACAO_CONTENT.GENERICO;
  return { ...content, saudacao: content.saudacao.replace('{nome}', nome.split(' ')[0]) };
}

export function getDeveEstadoTemplate(lifeStateCode: string | null | undefined): DeveEstadoTemplate {
  const key = lifeStateCode ?? 'GENERICO';
  return DEVER_ESTADO_TEMPLATES[key] ?? DEVER_ESTADO_TEMPLATES.GENERICO;
}
