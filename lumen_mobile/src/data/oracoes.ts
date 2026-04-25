export type Oracao = { id: string; titulo: string; texto: string };

const PAI_NOSSO = 'Pai nosso que estais no céu,\nsantificado seja o vosso nome,\nvenha a nós o vosso reino,\nseja feita a vossa vontade,\nassim na terra como no céu.\n\nO pão nosso de cada dia nos dai hoje,\nperdoai-nos as nossas ofensas,\nassim como nós perdoamos a quem nos tem ofendido,\ne não nos deixeis cair em tentação,\nmas livrai-nos do mal.\nAmém.';

const AVE_MARIA = 'Ave Maria, cheia de graça,\no Senhor é convosco,\nbendita sois vós entre as mulheres\ne bendito é o fruto do vosso ventre, Jesus.\n\nSanta Maria, Mãe de Deus,\nrogai por nós, pecadores,\nagora e na hora da nossa morte.\nAmém.';

const GLORIA = 'Glória ao Pai, ao Filho e ao Espírito Santo,\ncomo era no princípio, agora e sempre,\npor todos os séculos dos séculos.\nAmém.';

const FATIMA = 'Ó meu Jesus, perdoai-nos, livrai-nos do fogo do inferno,\nlevai as almas todas para o Céu,\nespecialmente as que mais precisarem da vossa misericórdia.\nAmém.';

const SALVE_RAINHA = 'Salve Rainha, Mãe de misericórdia,\nvida, doçura e esperança nossa, salve!\n\nA vós bradamos, os degredados filhos de Eva;\na vós suspiramos, gemendo e chorando\nneste vale de lágrimas.\n\nEia, pois, advogada nossa,\nessas vossas misericordiosas vistas a nós volveis,\ne depois deste desterro,\nmostrai-nos Jesus, fruto bendito do vosso ventre.\n\nÓ clemente, ó piedosa,\nó doce sempre Virgem Maria!\nAmém.';

const CREDO = 'Creio em Deus Pai todo-poderoso,\nCriador do céu e da terra.\n\nCreio em Jesus Cristo,\nseu único Filho, nosso Senhor,\nque foi concebido pelo poder do Espírito Santo,\nnasceu da Virgem Maria,\npadeceu sob Pôncio Pilatos,\nfoi crucificado, morto e sepultado,\ndesceu à mansão dos mortos,\nressuscitou ao terceiro dia,\nsubiu aos céus,\nestá sentado à direita de Deus Pai todo-poderoso,\nonde há de vir a julgar os vivos e os mortos.\n\nCreio no Espírito Santo,\nna santa Igreja Católica,\nna comunhão dos santos,\nna remissão dos pecados,\nna ressurreição da carne,\nna vida eterna.\nAmém.';

const CONFITEOR = 'Confesso a Deus todo-poderoso,\ne a vós, irmãos,\nque pequei muitas vezes\npor pensamentos e palavras,\natos e omissões,\npor minha culpa, minha culpa,\nminha tão grande culpa.\n\nE peço à Virgem Maria,\naos anjos e santos,\ne a vós, irmãos,\nque rogueis por mim\na Deus, nosso Senhor.\nAmém.';

const TOMAI_SENHOR = 'Tomai, Senhor, e recebei toda a minha liberdade,\na minha memória, o meu entendimento e toda a minha vontade.\nTudo o que tenho e possuo Vós me destes;\na Vós, Senhor, o restituo.\nTudo é vosso, disponde de tudo segundo a Vossa vontade,\nisso me basta.\nAmém.';

const ABANDONO_FOUCAULD = 'Pai, eu me abandono a Ti.\nFaze de mim o que quiseres.\nO que fizeres de mim, eu Te agradeço.\nEstou pronto para tudo, aceito tudo,\ncontanto que a tua vontade se faça em mim\ne em todas as tuas criaturas.\n\nNão desejo nada mais, meu Deus.\nEntrego minha alma em tuas mãos.\nEu a dou a Ti, meu Deus, com todo o amor do meu coração,\nporque eu te amo, e é para mim uma necessidade de amor dar-me,\nentregar-me em tuas mãos sem medida,\ncom infinita confiança, porque Tu és meu Pai.\nAmém.';

const SAO_FRANCISCO = 'Senhor, fazei-me instrumento de vossa paz.\nOnde houver ódio, que eu leve o amor;\nonde houver ofensa, que eu leve o perdão;\nonde houver discórdia, que eu leve a união;\nonde houver dúvida, que eu leve a fé;\nonde houver erro, que eu leve a verdade;\nonde houver desespero, que eu leve a esperança;\nonde houver tristeza, que eu leve a alegria;\nonde houver trevas, que eu leve a luz.\n\nÓ Mestre, fazei que eu procure mais\nconsolar que ser consolado,\ncompreender que ser compreendido,\namar que ser amado.\n\nPois é dando que se recebe,\né perdoando que se é perdoado,\ne é morrendo que se vive para a vida eterna.\nAmém.';

const ALMA_DE_CRISTO = 'Alma de Cristo, santificai-me.\nCorpo de Cristo, salvai-me.\nSangue de Cristo, inebriai-me.\nÁgua do lado de Cristo, lavai-me.\nPaixão de Cristo, confortai-me.\n\nÓ bom Jesus, ouvi-me.\nDentro de vossas chagas, escondei-me.\nNão permitais que eu me separe de vós.\nDo espírito maligno defendei-me.\nNa hora da minha morte, chamai-me\ne mandai-me ir para vós,\npara que com vossos santos vos louve\npor todos os séculos dos séculos.\nAmém.';

const ORACAO_MISSIONARIA = 'Senhor, fazei de mim um missionário do vosso amor.\nQue eu não viva para mim, mas para levar-vos aos que não vos conhecem.\nDai-me coragem para sair de mim,\npara ir ao encontro dos pobres, dos esquecidos e dos que sofrem.\nQue eu vos reconheça em cada pessoa\nespecialmente nos mais necessitados.\nAmém.';

const TERESA_CALCUTA = 'Senhor, quando eu tiver fome,\ndai-me alguém que precise de alimento.\nQuando eu tiver sede,\ndai-me alguém que precise de água.\nQuando eu estiver só,\ndai-me alguém que precise de companhia.\nQuando eu estiver triste,\ndai-me alguém que precise de consolo.\n\nFazei-me digno de servir os pobres e os que sofrem,\npara que eu vos encontre neles.\nAmém.';

const STABAT_MATER_COMPLETA = 'Estava a Mãe dolorosa\nJunto da Cruz, lacrimosa,\nDa qual pendia o seu Filho.\nBanhada em pranto amoroso,\nNeste transe doloroso,\nA dor lhe rasgava o peito.\n\nÓ quão triste e quão aflita\nSe encontrava a Mãe bendita,\nChorando o seu Unigênito.\n\nEstava triste e sofria\nE porque ela mesma via\nAs dores do Filho amado.\n\nQuem não chora, vendo isto,\nContemplando a Mãe do Cristo\nEm tão grande sofrimento?\n\nQuem não se contristaria\nVendo a Mãe de Deus, Maria,\nPadecendo com seu Filho?\n\nPor culpa de sua gente\nViu a Jesus inocente\nCruelmente flagelado.\n\nViu seu Filho muito amado,\nQue morria abandonado\nEntregando o seu espírito.\n\nDá-me, ó Mãe, fonte de amor,\nQue eu sinta a força da dor,\nPara que eu chore contigo.\n\nFaze arder meu coração\nDo Cristo Deus na paixão,\nPara que eu sofra com Ele.\n\nMinha Mãe, ó dá-me isto:\nTrazer as chagas do Cristo\nGravadas no coração.\n\nDo teu Filho as feridas,\nPara meu perdão sofridas,\nVem reparti-las comigo.\n\nQuero contigo chorar\nE a cruz compartilhar,\nPor toda a minha vida.\n\nJunto à Cruz contigo estar,\nAo teu pranto me associar,\nDesejo de coração.\n\nVirgem das virgens, preclara,\nNão me negues, Mãe tão cara,\nPoder contigo chorar.\n\nQue eu viva de Cristo a morte,\nDa Paixão seja consorte,\nCelebrando suas chagas.\n\nQue meu coração magoado,\nPela Cruz apaixonado,\nSeja em seu Sangue remido.\n\nPor Maria amparado,\nQue eu não seja condenado\nNo dia de minha morte.\n\nÓ Cristo, que eu tenha a sorte,\nNo dia de minha morte,\nSer levado por Maria.\n\nE no dia em que eu morrer,\nFaze com que eu possa ter\nA glória do Paraíso.\n\nAmém.';

const MAGNIFICAT = 'A minha alma engrandece o Senhor,\ne meu espírito se alegra em Deus, meu Salvador,\nporque olhou para a humildade de sua serva.\n\nDoravante todas as gerações me chamarão bem-aventurada,\nporque o Todo-Poderoso fez grandes coisas em meu favor.\nO seu nome é santo.\n\nA sua misericórdia se estende de geração em geração\nsobre os que o temem.\nManifestou o poder do seu braço,\ndispersou os soberbos de coração.\n\nDerrubou do trono os poderosos\ne exaltou os humildes.\nEncheu de bens os famintos\ne despediu os ricos de mãos vazias.\n\nAcolheu Israel, seu servo,\nlembrado da sua misericórdia,\nconforme prometera a nossos pais,\nem favor de Abraão e de sua descendência, para sempre.\nAmém.';


export const ORACOES: Oracao[] = [
  { id: 'pai-nosso', titulo: 'Pai Nosso', texto: PAI_NOSSO },
  { id: 'ave-maria', titulo: 'Ave Maria', texto: AVE_MARIA },
  { id: 'gloria', titulo: 'Glória', texto: GLORIA },
  { id: 'fatima', titulo: 'Oração de Fátima', texto: FATIMA },
  { id: 'salve-rainha', titulo: 'Salve Rainha', texto: SALVE_RAINHA },
  { id: 'credo', titulo: 'Credo Apostólico', texto: CREDO },
  { id: 'confiteor', titulo: 'Confiteor', texto: CONFITEOR },
  { id: 'abandono-foucauld', titulo: 'Ato de Abandono', texto: ABANDONO_FOUCAULD },
  { id: 'sao-francisco', titulo: 'Senhor, fazei-me instrumento de vossa paz', texto: SAO_FRANCISCO },
  { id: 'alma-de-cristo', titulo: 'Alma de Cristo', texto: ALMA_DE_CRISTO },
  { id: 'oracao-missionaria', titulo: 'Oração Missionária', texto: ORACAO_MISSIONARIA },
  { id: 'teresa-calcuta', titulo: 'Oração de Santa Teresa de Calcutá', texto: TERESA_CALCUTA },
  { id: 'stabat-mater', titulo: 'Stabat Mater (trecho)', texto: STABAT_MATER },
  { id: 'magnificat', titulo: 'Magnificat', texto: MAGNIFICAT },
  { id: 'tomai-senhor', titulo: 'Tomai, Senhor, e recebei toda a minha liberdade', texto: TOMAI_SENHOR },
];

// TODO: Adicionar orações personalizadas da Obra Lumen
export const ORACOES_LUMEN: Oracao[] = [];
