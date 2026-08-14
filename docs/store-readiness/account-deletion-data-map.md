# Exclusão de conta — matriz de dados

**Escopo:** o que acontece com cada dado quando o titular pede exclusão.
**Gates:** App Store Review Guideline 5.1.1(v) (excluir a conta, não apenas
desativar) e LGPD art. 18, VI (eliminação dos dados pessoais).

**Como esta matriz foi levantada:** enumerando as **45 chaves estrangeiras que
apontam para `users.id`**, em 28 tabelas, a partir do metadata do SQLAlchemy —
não por inspeção manual. O comando está no fim do documento.

**Onde vive a regra:** `backend/app/services/account_deletion.py`. A lista
`_PURGE` é a fonte da verdade em código; este documento a explica. O teste
`backend/tests/test_account_deletion_e2e.py::test_matriz_de_purga_nao_deixa_residuo`
percorre `_PURGE` e falha se qualquer tabela listada sobreviver — ou seja, a
matriz não pode divergir do comportamento sem quebrar o CI.

---

## Endpoint

`DELETE /auth/me` → **204**. Autenticado; o usuário só exclui a si próprio.
Também usado pela exclusão administrativa (`anonymize_user` é compartilhada).

---

## 1. Dados APAGADOS

| Tabela | Por que contém dado pessoal |
|---|---|
| `user_profiles` | nome, CPF (hash + cifrado), RG cifrado, telefone, foto, cidade, instagram, restrição alimentar, plano de saúde |
| `phone_verifications` | **telefone em claro** (`phone_e164`) |
| `email_verifications` | **e-mail em claro** |
| `push_subscriptions` | endpoint do dispositivo — sem apagar, a conta excluída **continua recebendo push** |
| `life_plan_cycles` | realidade vocacional |
| `projetos_vida_mensal` | tema e intenções espirituais do usuário |
| `user_permissions` | autoridade residual numa conta excluída |
| `user_blocks` | apagado nas **duas** direções (bloqueou / foi bloqueado) |
| `user_preferences` | preferências de analytics e push |
| `org_memberships`, `user_global_roles` | vínculos e papéis |
| `data_export_requests` | aponta para arquivos de exportação contendo PII |

> **Pendência operacional:** `data_export_requests.file_path` é removido do
> banco, mas o **arquivo em si** vive fora da transação. A remoção do arquivo
> físico ainda não é automática — ver "Lacunas conhecidas".

## 2. Conteúdo OCULTADO (soft delete)

| Tabela | Tratamento |
|---|---|
| `channel_posts` | `deleted_at` preenchido, `delete_reason = "account_deleted"` |
| `channel_replies` | idem |

Soft delete, e não `DELETE`, por uma razão concreta: apagar em cascata
destruiria **conversa de terceiros**. As respostas de outros membros na mesma
thread continuam existindo e legíveis. Coberto por
`test_ugc_sai_do_ar_sem_quebrar_thread_de_terceiro`.

## 3. Dados ANONIMIZADOS

| Tabela | Tratamento |
|---|---|
| `user_identities` | `email` e `provider_uid` → `deleted+<hex>@deleted.invalid` |

Este é o ponto que torna a exclusão real e não uma desativação: o
`provider_uid` do Firebase deixa de resolver para esta conta, então **não há
como reentrar nela**. Coberto por `test_nao_e_possivel_reentrar_na_conta`.

## 4. Dados RETIDOS (obrigação legal — 5 anos)

| Tabela | Base da retenção |
|---|---|
| `users` (linha, `is_active=false`) | âncora de integridade referencial; sem ela as 15 FKs `SET NULL` e os registros financeiros ficariam inconsistentes |
| `user_consents` | a evidência de aceite **é ela própria** o registro legal exigido; apagá-la destruiria a prova |
| `audit_log` | rastreabilidade de segurança |
| `retreat_registrations` | registro financeiro/de pagamento. Fica **órfão de PII** — o perfil que o identificava foi apagado |

A retenção está declarada na Política de Privacidade. LGPD art. 16, II admite
conservação para cumprimento de obrigação legal ou regulatória.

---

## 5. O conflito com a Apple — decisão pendente de humano

A Apple, na 5.1.1(v), espera exclusão do **registro da conta**. A retenção de
5 anos sobre registros financeiros e evidência de consentimento colide com a
leitura mais literal dessa exigência.

**Postura adotada:** excluir tudo que é dado pessoal e romper o vínculo de
identidade (o login deixa de funcionar), retendo apenas o mínimo com base
legal explícita e **declarado na Política de Privacidade** — que é o que a
própria Apple aceita quando a retenção é legal e divulgada.

**Não decidido — precisa de aprovação humana:**

1. Se a retenção de `retreat_registrations` deve ser reduzida a campos
   estritamente financeiros (valor, data, status), descartando `notes` e
   preferências.
2. Se o texto da Política de Privacidade descreve essa retenção com precisão
   suficiente para a revisão da Apple.

Ambas são decisões do Encarregado (Felipe Rocha Pinheiro Bastos —
`lgpd@lumenserfeliz.org`), não de engenharia. **Nada aqui deve ser declarado
aprovado sem o parecer dele.**

---

## 6. Lacunas conhecidas

| Lacuna | Situação |
|---|---|
| Arquivo físico de `data_export_requests.file_path` | a linha é apagada; o arquivo não. Requer rotina de limpeza no storage |
| `data_export_requests` no teste automatizado | a tabela usa coluna `ARRAY`, que não existe em SQLite. O teste **declara** a lacuna em `TABELAS_SEM_COBERTURA_SQLITE` em vez de fingir cobertura. Cobrir exige rodar a suíte contra PostgreSQL |
| Revogação do token do Firebase | o `provider_uid` é anonimizado, então o token não resolve mais para a conta. A revogação explícita no Firebase Admin ainda não é chamada |
| Fluxo de exclusão pela web | `lumen_mobile/app/excluir-conta.tsx` **não** exclui por e-mail (evita enumeração de contas) — encaminha ao canal do Encarregado. Processo manual, por decisão |

---

## Como reproduzir o levantamento

```bash
cd backend && .venv/Scripts/python.exe -c "
from app.db.models import Base
for t in Base.metadata.sorted_tables:
    for fk in t.foreign_keys:
        if fk.column.table.name == 'users':
            print(t.name, fk.parent.name, fk.ondelete or '(sem ondelete)')
"
```

Resultado no momento deste documento: **45 FKs / 28 tabelas** — 30 com
`ON DELETE CASCADE`, 15 com `SET NULL`.
