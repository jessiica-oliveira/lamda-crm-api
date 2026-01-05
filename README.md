# RD CRM – AWS Lambda Integration

Lambda em Node.js para integração com o **RD Station CRM**, responsável por:

- Buscar contatos por **telefone** ou **telefone + email**
- Buscar **deals ativos** relacionados aos contatos
- **Reatribuir automaticamente o owner** das negociações em aberto ou ...
- Retornar deals já **enriquecidos com nome e email do owner** novo

---

## 📌 Visão geral do fluxo

1. Recebe `phone` (obrigatório) e `email` (opcional)
2. Normaliza o telefone
3. Resolve `access_token` (env → refresh → fallback)
4. Busca contatos no RD CRM
5. Busca deals ativos por contato
6. Reatribui owner para um usuário visível aleatório
7. Enriquce cada deal com `owner_name` e `owner_email`
8. Retorna resposta consolidada

---

## 📥 Input esperado

```json
{
  "contact": {
    "phone": "11984196634",
    "email": "sabrina.honorato19@gmail.com"
  }
}
```
