# Meu Norte

Aplicação web de controle financeiro pessoal feita com Node.js, Express, Prisma e SQLite. Toda a interação é feita pelo navegador, com HTML, CSS e JavaScript.

## Requisitos

- Node.js 20.19+ (necessário para a versão do Prisma deste projeto)
- npm

## Como executar

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Opcionalmente, crie um arquivo `.env` na raiz usando `.env.example` como modelo. Sem configuração adicional, o banco SQLite local fica em `prisma/dev.db`.
3. Aplique as migrações e gere o Prisma Client:

   ```bash
   npm run db:migrate -- --name controle_financeiro
   npm run db:generate
   ```

4. Inicie o servidor:

   ```bash
   npm run dev
   ```

5. Acesse <http://localhost:3000> e crie uma conta.

## Funcionalidades

- Cadastro e login com senha armazenada usando `scrypt`; sessão aleatória persistida no banco e enviada em cookie `HttpOnly`.
- Contas: criar, listar, editar e excluir.
- Categorias de receita e despesa: criar, listar, editar e excluir.
- Lançamentos: criar, listar, editar e excluir, associados a uma conta e a uma categoria do mesmo tipo.
- Visão geral do saldo e das quantidades cadastradas.
- Os dados financeiros são isolados por usuário. Contas e categorias com lançamentos vinculados não podem ser excluídas; o sistema informa o motivo.

Valores monetários são guardados em centavos inteiros para evitar erros de arredondamento. O banco contém os modelos `Usuario` e `Sessao` para autenticação e as três tabelas CRUD `Conta`, `Categoria` e `Lancamento`.

## Rotas principais

| Método | Rota | Ação |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Criar conta e iniciar sessão |
| `POST` | `/api/auth/login` | Entrar |
| `POST` | `/api/auth/logout` | Encerrar sessão |
| `GET` | `/api/auth/session` | Consultar sessão atual |
| `GET`, `POST` | `/api/contas` | Listar e criar contas |
| `PUT`, `DELETE` | `/api/contas/:id` | Editar e excluir conta |
| `GET`, `POST` | `/api/categorias` | Listar e criar categorias |
| `PUT`, `DELETE` | `/api/categorias/:id` | Editar e excluir categoria |
| `GET`, `POST` | `/api/lancamentos` | Listar e criar lançamentos |
| `PUT`, `DELETE` | `/api/lancamentos/:id` | Editar e excluir lançamento |
