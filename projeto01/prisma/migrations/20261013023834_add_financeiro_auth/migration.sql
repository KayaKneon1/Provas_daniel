-- CreateTable
CREATE TABLE "Usuario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Sessao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sessao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Conta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "saldoInicialCentavos" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    CONSTRAINT "Conta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    CONSTRAINT "Categoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Lancamento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "descricao" TEXT NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "data" DATETIME NOT NULL,
    "tipo" TEXT NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "contaId" INTEGER NOT NULL,
    "categoriaId" INTEGER NOT NULL,
    CONSTRAINT "Lancamento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Lancamento_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Lancamento_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Sessao_tokenHash_key" ON "Sessao"("tokenHash");

-- CreateIndex
CREATE INDEX "Sessao_expiresAt_idx" ON "Sessao"("expiresAt");

-- CreateIndex
CREATE INDEX "Conta_usuarioId_idx" ON "Conta"("usuarioId");

-- CreateIndex
CREATE INDEX "Categoria_usuarioId_idx" ON "Categoria"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nome_tipo_usuarioId_key" ON "Categoria"("nome", "tipo", "usuarioId");

-- CreateIndex
CREATE INDEX "Lancamento_usuarioId_data_idx" ON "Lancamento"("usuarioId", "data");

-- CreateIndex
CREATE INDEX "Lancamento_contaId_idx" ON "Lancamento"("contaId");

-- CreateIndex
CREATE INDEX "Lancamento_categoriaId_idx" ON "Lancamento"("categoriaId");
