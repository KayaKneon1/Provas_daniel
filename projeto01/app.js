require('dotenv').config()

const crypto = require('node:crypto')
const path = require('node:path')
const { promisify } = require('node:util')
const express = require('express')
const prisma = require('./lib/prisma')

const app = express()
const port = Number(process.env.PORT) || 3000
const SESSION_DAYS = 7
const scrypt = promisify(crypto.scrypt)

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

app.use(express.json({ limit: '16kb' }))
app.use(express.static(path.join(__dirname, 'public')))

function userView(usuario) {
  return { id: usuario.id, nome: usuario.nome, email: usuario.email }
}

function sessionCookie(token, maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`
}

function cookieToken(req) {
  const cookie = req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('session='))
  return cookie ? cookie.slice('session='.length) : null
}

async function startSession(usuario, res) {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)

  await prisma.sessao.create({
    data: {
      tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
      usuarioId: usuario.id,
      expiresAt
    }
  })

  res.setHeader('Set-Cookie', sessionCookie(token, SESSION_DAYS * 24 * 60 * 60))
}

async function requireAuth(req, res, next) {
  try {
    const token = cookieToken(req)
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      throw new HttpError(401, 'Faça login para continuar.')
    }

    const sessao = await prisma.sessao.findUnique({
      where: { tokenHash: crypto.createHash('sha256').update(token).digest('hex') },
      include: { usuario: true }
    })

    if (!sessao || sessao.expiresAt <= new Date()) {
      if (sessao) {
        await prisma.sessao.delete({ where: { id: sessao.id } })
      }
      throw new HttpError(401, 'Sua sessão expirou. Faça login novamente.')
    }

    req.usuario = sessao.usuario
    next()
  } catch (error) {
    next(error)
  }
}

function requireText(value, field, maxLength = 100) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new HttpError(400, `${field} é obrigatório e deve ter até ${maxLength} caracteres.`)
  }
  return value.trim()
}

function requireEnum(value, allowed, field) {
  if (!allowed.includes(value)) {
    throw new HttpError(400, `Valor inválido para ${field}.`)
  }
  return value
}

function requireId(value, field) {
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new HttpError(400, `${field} inválido.`)
  }
  return id
}

function requireMoney(value, field) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0 || amount > 100000000 || !Number.isSafeInteger(Math.round(amount * 100))) {
    throw new HttpError(400, `${field} deve ser um valor válido e não negativo.`)
  }
  return Math.round(amount * 100)
}

function requireDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, 'Informe uma data válida.')
  }
  const date = new Date(`${value}T12:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, 'Informe uma data válida.')
  }
  return date
}

async function findOwned(model, id, usuarioId, resourceName) {
  const record = await model.findFirst({ where: { id, usuarioId } })
  if (!record) {
    throw new HttpError(404, `${resourceName} não encontrado(a).`)
  }
  return record
}

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const nome = requireText(req.body.nome, 'Nome', 80)
    const email = requireText(req.body.email, 'E-mail', 254).toLowerCase()
    const senha = req.body.senha

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpError(400, 'Informe um e-mail válido.')
    }
    if (typeof senha !== 'string' || senha.length < 8 || senha.length > 128) {
      throw new HttpError(400, 'A senha deve ter entre 8 e 128 caracteres.')
    }

    const salt = crypto.randomBytes(16).toString('hex')
    const hash = await scrypt(senha, salt, 64)
    const usuario = await prisma.usuario.create({
      data: { nome, email, senhaHash: `${salt}:${hash.toString('hex')}` }
    })

    await startSession(usuario, res)
    res.status(201).json({ usuario: userView(usuario) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const email = requireText(req.body.email, 'E-mail', 254).toLowerCase()
    const senha = req.body.senha
    if (typeof senha !== 'string' || !senha) {
      throw new HttpError(400, 'Informe a senha.')
    }

    const usuario = await prisma.usuario.findUnique({ where: { email } })
    if (!usuario) {
      throw new HttpError(401, 'E-mail ou senha incorretos.')
    }

    const [salt, storedHash] = usuario.senhaHash.split(':')
    const submittedHash = await scrypt(senha, salt, 64)
    const expectedHash = Buffer.from(storedHash, 'hex')
    if (submittedHash.length !== expectedHash.length || !crypto.timingSafeEqual(submittedHash, expectedHash)) {
      throw new HttpError(401, 'E-mail ou senha incorretos.')
    }

    await startSession(usuario, res)
    res.json({ usuario: userView(usuario) })
  } catch (error) {
    next(error)
  }
})

app.get('/api/auth/session', async (req, res, next) => {
  try {
    const token = cookieToken(req)
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      return res.json({ usuario: null })
    }

    const sessao = await prisma.sessao.findUnique({
      where: { tokenHash: crypto.createHash('sha256').update(token).digest('hex') },
      include: { usuario: true }
    })
    if (!sessao || sessao.expiresAt <= new Date()) {
      return res.json({ usuario: null })
    }
    res.json({ usuario: userView(sessao.usuario) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/logout', async (req, res, next) => {
  try {
    const token = cookieToken(req)
    if (token && /^[a-f0-9]{64}$/.test(token)) {
      await prisma.sessao.deleteMany({
        where: { tokenHash: crypto.createHash('sha256').update(token).digest('hex') }
      })
    }
    res.setHeader('Set-Cookie', sessionCookie('', 0))
    res.json({ message: 'Sessão encerrada.' })
  } catch (error) {
    next(error)
  }
})

app.use('/api', requireAuth)

app.get('/api/dashboard', async (req, res, next) => {
  try {
    const usuarioId = req.usuario.id
    const [contas, categorias, lancamentos] = await Promise.all([
      prisma.conta.findMany({ where: { usuarioId }, select: { saldoInicialCentavos: true } }),
      prisma.categoria.count({ where: { usuarioId } }),
      prisma.lancamento.findMany({ where: { usuarioId }, select: { valorCentavos: true, tipo: true } })
    ])
    const saldo = contas.reduce((total, conta) => total + conta.saldoInicialCentavos, 0)
      + lancamentos.reduce((total, lancamento) => total + (
        lancamento.tipo === 'RECEITA' ? lancamento.valorCentavos : -lancamento.valorCentavos
      ), 0)

    res.json({
      quantidadeContas: contas.length,
      quantidadeCategorias: categorias,
      quantidadeLancamentos: lancamentos.length,
      saldoCentavos: saldo
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/contas', async (req, res, next) => {
  try {
    res.json(await prisma.conta.findMany({
      where: { usuarioId: req.usuario.id },
      orderBy: { nome: 'asc' }
    }))
  } catch (error) {
    next(error)
  }
})

app.post('/api/contas', async (req, res, next) => {
  try {
    const conta = await prisma.conta.create({
      data: {
        nome: requireText(req.body.nome, 'Nome da conta', 80),
        tipo: requireEnum(req.body.tipo, ['CORRENTE', 'POUPANCA', 'INVESTIMENTO', 'DINHEIRO'], 'tipo da conta'),
        saldoInicialCentavos: requireMoney(req.body.saldoInicial, 'Saldo inicial'),
        usuarioId: req.usuario.id
      }
    })
    res.status(201).json(conta)
  } catch (error) {
    next(error)
  }
})

app.put('/api/contas/:id', async (req, res, next) => {
  try {
    const id = requireId(req.params.id, 'Conta')
    await findOwned(prisma.conta, id, req.usuario.id, 'Conta')
    await prisma.conta.update({
      where: { id },
      data: {
        nome: requireText(req.body.nome, 'Nome da conta', 80),
        tipo: requireEnum(req.body.tipo, ['CORRENTE', 'POUPANCA', 'INVESTIMENTO', 'DINHEIRO'], 'tipo da conta'),
        saldoInicialCentavos: requireMoney(req.body.saldoInicial, 'Saldo inicial')
      }
    })
    res.json(await prisma.conta.findUnique({ where: { id } }))
  } catch (error) {
    next(error)
  }
})

app.delete('/api/contas/:id', async (req, res, next) => {
  try {
    const id = requireId(req.params.id, 'Conta')
    await findOwned(prisma.conta, id, req.usuario.id, 'Conta')
    await prisma.conta.delete({ where: { id } })
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

app.get('/api/categorias', async (req, res, next) => {
  try {
    res.json(await prisma.categoria.findMany({
      where: { usuarioId: req.usuario.id },
      orderBy: [{ tipo: 'asc' }, { nome: 'asc' }]
    }))
  } catch (error) {
    next(error)
  }
})

app.post('/api/categorias', async (req, res, next) => {
  try {
    const categoria = await prisma.categoria.create({
      data: {
        nome: requireText(req.body.nome, 'Nome da categoria', 60),
        tipo: requireEnum(req.body.tipo, ['RECEITA', 'DESPESA'], 'tipo da categoria'),
        usuarioId: req.usuario.id
      }
    })
    res.status(201).json(categoria)
  } catch (error) {
    next(error)
  }
})

app.put('/api/categorias/:id', async (req, res, next) => {
  try {
    const id = requireId(req.params.id, 'Categoria')
    const categoriaAtual = await findOwned(prisma.categoria, id, req.usuario.id, 'Categoria')
    const tipo = requireEnum(req.body.tipo, ['RECEITA', 'DESPESA'], 'tipo da categoria')
    if (tipo !== categoriaAtual.tipo) {
      const lancamentosVinculados = await prisma.lancamento.count({
        where: { categoriaId: id, usuarioId: req.usuario.id }
      })
      if (lancamentosVinculados > 0) {
        throw new HttpError(409, 'Não é possível alterar o tipo de uma categoria que já possui lançamentos.')
      }
    }
    const categoria = await prisma.categoria.update({
      where: { id },
      data: {
        nome: requireText(req.body.nome, 'Nome da categoria', 60),
        tipo
      }
    })
    res.json(categoria)
  } catch (error) {
    next(error)
  }
})

app.delete('/api/categorias/:id', async (req, res, next) => {
  try {
    const id = requireId(req.params.id, 'Categoria')
    await findOwned(prisma.categoria, id, req.usuario.id, 'Categoria')
    await prisma.categoria.delete({ where: { id } })
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

async function validateLancamentoRelations(req, tipo, contaId, categoriaId) {
  const [conta, categoria] = await Promise.all([
    prisma.conta.findFirst({ where: { id: contaId, usuarioId: req.usuario.id } }),
    prisma.categoria.findFirst({ where: { id: categoriaId, usuarioId: req.usuario.id } })
  ])
  if (!conta) {
    throw new HttpError(400, 'Selecione uma conta válida.')
  }
  if (!categoria || categoria.tipo !== tipo) {
    throw new HttpError(400, 'Selecione uma categoria do mesmo tipo do lançamento.')
  }
}

function lancamentoData(req) {
  const tipo = requireEnum(req.body.tipo, ['RECEITA', 'DESPESA'], 'tipo do lançamento')
  const valorCentavos = requireMoney(req.body.valor, 'Valor')
  if (valorCentavos <= 0) {
    throw new HttpError(400, 'O valor do lançamento deve ser maior que zero.')
  }
  return {
    descricao: requireText(req.body.descricao, 'Descrição', 120),
    valorCentavos,
    data: requireDate(req.body.data),
    tipo,
    contaId: requireId(req.body.contaId, 'Conta'),
    categoriaId: requireId(req.body.categoriaId, 'Categoria')
  }
}

app.get('/api/lancamentos', async (req, res, next) => {
  try {
    const lancamentos = await prisma.lancamento.findMany({
      where: { usuarioId: req.usuario.id },
      include: {
        conta: { select: { nome: true } },
        categoria: { select: { nome: true } }
      },
      orderBy: [{ data: 'desc' }, { id: 'desc' }]
    })
    res.json(lancamentos)
  } catch (error) {
    next(error)
  }
})

app.post('/api/lancamentos', async (req, res, next) => {
  try {
    const data = lancamentoData(req)
    await validateLancamentoRelations(req, data.tipo, data.contaId, data.categoriaId)
    const lancamento = await prisma.lancamento.create({
      data: { ...data, usuarioId: req.usuario.id }
    })
    res.status(201).json(lancamento)
  } catch (error) {
    next(error)
  }
})

app.put('/api/lancamentos/:id', async (req, res, next) => {
  try {
    const id = requireId(req.params.id, 'Lançamento')
    await findOwned(prisma.lancamento, id, req.usuario.id, 'Lançamento')
    const data = lancamentoData(req)
    await validateLancamentoRelations(req, data.tipo, data.contaId, data.categoriaId)
    await prisma.lancamento.update({ where: { id }, data })
    res.json(await prisma.lancamento.findUnique({
      where: { id },
      include: {
        conta: { select: { nome: true } },
        categoria: { select: { nome: true } }
      }
    }))
  } catch (error) {
    next(error)
  }
})

app.delete('/api/lancamentos/:id', async (req, res, next) => {
  try {
    const id = requireId(req.params.id, 'Lançamento')
    await findOwned(prisma.lancamento, id, req.usuario.id, 'Lançamento')
    await prisma.lancamento.delete({ where: { id } })
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Rota da API não encontrada.' })
})

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error)
  }

  if (error.code === 'P2002') {
    return res.status(409).json({ message: 'Já existe um registro com esses dados.' })
  }
  if (error.code === 'P2003' || error.code === 'P2014') {
    return res.status(409).json({ message: 'Não é possível excluir este registro enquanto houver lançamentos vinculados.' })
  }
  if (error.code === 'P2025') {
    return res.status(404).json({ message: 'Registro não encontrado.' })
  }
  if (error instanceof HttpError) {
    return res.status(error.status).json({ message: error.message })
  }

  console.error(error)
  res.status(500).json({ message: 'Ocorreu um erro interno. Tente novamente.' })
})

app.listen(port, () => {
  console.log(`Servidor disponível em http://localhost:${port}`)
})
