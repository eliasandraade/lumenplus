/**
 * BrasilAPI — estados e municípios do Brasil.
 * Sem chave de API. Fonte: brasilapi.com.br
 */

const BASE_URL = 'https://brasilapi.com.br/api';

export interface Estado {
  sigla: string;
  nome: string;
  regiao?: { id: number; sigla: string; nome: string };
}

export interface Municipio {
  nome: string;
  codigo_ibge?: string;
}

export const brasilApi = {
  /** Retorna os 27 estados + DF ordenados por nome. */
  getEstados: async (): Promise<Estado[]> => {
    const res = await fetch(`${BASE_URL}/ibge/estados/v1?orderBy=nome`);
    if (!res.ok) throw new Error('Falha ao buscar estados');
    const data: Estado[] = await res.json();
    return data;
  },

  /** Retorna municípios de uma UF (sigla, ex: "CE"). */
  getMunicipios: async (uf: string): Promise<Municipio[]> => {
    const res = await fetch(
      `${BASE_URL}/ibge/municipios/v1/${uf.toUpperCase()}?providers=dados-abertos-br,gov,wikipedia`
    );
    if (!res.ok) throw new Error('Falha ao buscar municípios');
    const data: Municipio[] = await res.json();
    return data.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  },
};

export default brasilApi;
